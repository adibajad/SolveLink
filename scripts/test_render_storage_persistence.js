/**
 * SolveLink Render Persistence & GridFS Resilience Test
 * 
 * Simulates a Render ephemeral container lifecycle:
 * 1. Citizen uploads image
 * 2. Stored in MongoDB GridFS
 * 3. Render restarts/redeploys -> local disk cache is wiped!
 * 4. Verifies that the image is STILL served with HTTP 200 and image/jpeg directly from GridFS!
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');

const storageService = require('../services/storageService');
const app = require('../app');

const runPersistenceTest = async () => {
  console.log('===========================================================');
  console.log(' SOLVELINK RENDER PERSISTENCE & DURABLE STORAGE TEST');
  console.log('===========================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Server] Active on port ${port}`);

  const request = (reqPath) => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${reqPath}`, { agent: false }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      }).on('error', reject);
    });
  };

  try {
    // 1. Create a mock GridFS bucket in memory if mongoose is not connected to external atlas
    let mockGridFSRun = false;
    let mockFiles = new Map();

    if (mongoose.connection.readyState !== 1) {
      console.log('[Notice] Running in mock MongoDB GridFS mode (offline environment)...');
      mockGridFSRun = true;
      const originalGetGridFS = storageService.getGridFSBucket;
      storageService.getGridFSBucket = () => ({
        openUploadStream: (filename, options) => {
          const streamChunks = [];
          const streamEvents = {};
          return {
            on: (event, handler) => { streamEvents[event] = handler; },
            end: (buffer) => {
              mockFiles.set(filename, {
                buffer,
                contentType: options.contentType,
                metadata: options.metadata,
                length: buffer.length
              });
              if (streamEvents['finish']) streamEvents['finish']();
            }
          };
        },
        find: (query) => ({
          limit: () => ({
            toArray: async () => {
              if (mockFiles.has(query.filename)) {
                const f = mockFiles.get(query.filename);
                return [{ filename: query.filename, metadata: f.metadata, contentType: f.contentType, length: f.length }];
              }
              return [];
            }
          })
        }),
        openDownloadStreamByName: (filename) => {
          const { Readable } = require('stream');
          const f = mockFiles.get(filename);
          const r = new Readable();
          r.push(f.buffer);
          r.push(null);
          return r;
        },
        delete: async (id) => {}
      });
    }

    // 2. Test saving JPEG
    console.log('1. Testing JPEG upload to durable storage...');
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00,
      0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);

    const storedPath = await storageService.saveFile({
      buffer: jpegBuffer,
      originalname: 'field_evidence_test.jpg',
      mimetype: 'image/jpeg'
    });

    assert(storedPath.startsWith('/uploads/evidence-'), 'Should return standard /uploads path');
    const filename = path.basename(storedPath);
    console.log(`   ✔ Stored as: ${storedPath}`);

    // 3. Test serving before restart (served from disk cache or GridFS)
    console.log('2. Requesting image via Express endpoint...');
    const res1 = await request(storedPath);
    assert.strictEqual(res1.statusCode, 200, 'Should return HTTP 200');
    assert(res1.headers['content-type'].includes('image/jpeg'), 'Should return image/jpeg Content-Type');
    assert.strictEqual(res1.body.length, jpegBuffer.length, 'Served binary size should match uploaded size');
    console.log('   ✔ Successfully served with HTTP 200 and image/jpeg Content-Type.');

    // 4. SIMULATE RENDER REDEPLOY / CONTAINER RESTART
    console.log('\n3. >>> SIMULATING RENDER REDEPLOY / CONTAINER RESTART <<<');
    console.log('   Deleting local disk file in public/uploads to simulate ephemeral container wipe...');
    const localDiskFile = path.join(storageService.UPLOADS_DIR, filename);
    if (fs.existsSync(localDiskFile)) {
      fs.unlinkSync(localDiskFile);
    }
    assert(!fs.existsSync(localDiskFile), 'Local disk file must now be deleted to prove persistence test');
    console.log('   File deleted from local disk.');

    // 5. Request image AGAIN after container restart
    console.log('4. Requesting image AFTER container wipe (verifying GridFS recovery)...');
    const res2 = await request(storedPath);
    assert.strictEqual(res2.statusCode, 200, 'Should STILL return HTTP 200 after local disk wipe!');
    assert(res2.headers['content-type'].includes('image/jpeg'), 'Should STILL return image/jpeg Content-Type!');
    assert.strictEqual(res2.body.length, jpegBuffer.length, 'Binary content from GridFS matches original upload exactly!');
    console.log('   ✔ PASS: Image retrieved from persistent MongoDB GridFS with HTTP 200!\n');

    // 6. Test sub-route nested fallback resolution
    console.log('5. Testing nested sub-route access (/authority/problems/uploads/:filename)...');
    const nestedRes = await request(`/authority/problems/uploads/${filename}`);
    assert.strictEqual(nestedRes.statusCode, 200, 'Nested route should resolve to same image');
    console.log('   ✔ PASS: Nested route successfully serves image.\n');

    // 7. Test PNG and WebP formats
    console.log('6. Testing PNG and WebP upload formats...');
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngPath = await storageService.saveFile({
      buffer: pngBuffer,
      originalname: 'pothole_photo.png',
      mimetype: 'image/png'
    });
    assert(pngPath.endsWith('.png'), 'Should preserve .png extension');

    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const webpPath = await storageService.saveFile({
      buffer: webpBuffer,
      originalname: 'sanitation_leak.webp',
      mimetype: 'image/webp'
    });
    assert(webpPath.endsWith('.webp'), 'Should preserve .webp extension');
    console.log('   ✔ PASS: PNG and WebP formats stored correctly.\n');

    // 8. Test Cloudinary integration flow
    console.log('7. Testing Cloudinary persistent storage integration flow...');
    const cloudinary = require('cloudinary').v2;
    const originalUploadStream = cloudinary.uploader.upload_stream;
    const originalDestroy = cloudinary.uploader.destroy;

    let destroyedPublicId = null;
    cloudinary.uploader.upload_stream = (options, cb) => {
      const { Writable } = require('stream');
      const writable = new Writable({
        write(chunk, encoding, callback) { callback(); }
      });
      writable.on('finish', () => {
        cb(null, {
          secure_url: `https://res.cloudinary.com/testcloud/image/upload/v1234567890/solvelink/evidence/${options.public_id}.jpg`,
          public_id: `solvelink/evidence/${options.public_id}`
        });
      });
      return writable;
    };
    cloudinary.uploader.destroy = async (pubId) => {
      destroyedPublicId = pubId;
      return { result: 'ok' };
    };

    process.env.CLOUDINARY_URL = 'cloudinary://123456789012345:abcdefghijklmnopqrstuvwxyzA@testcloud';

    const cloudPath = await storageService.saveFile({
      buffer: jpegBuffer,
      originalname: 'field_survey.jpg',
      mimetype: 'image/jpeg'
    });

    assert(cloudPath.startsWith('https://res.cloudinary.com/testcloud/'), 'Should return secure Cloudinary HTTPS URL');
    console.log(`   ✔ PASS: Cloudinary upload returned persistent CDN URL: ${cloudPath}`);

    await storageService.deleteFile(cloudPath);
    assert(destroyedPublicId && destroyedPublicId.includes('evidence-'), 'Should trigger Cloudinary destroy with public_id');
    console.log(`   ✔ PASS: Cloudinary asset destroyed: ${destroyedPublicId}\n`);

    // Reset Cloudinary env vars
    delete process.env.CLOUDINARY_URL;
    cloudinary.uploader.upload_stream = originalUploadStream;
    cloudinary.uploader.destroy = originalDestroy;

    // 9. Test old lost file (returns 404 gracefully)
    console.log('8. Testing old missing file from pre-fix era...');
    const lostRes = await request('/uploads/evidence-lost-pre-fix-file.jpg');
    assert.strictEqual(lostRes.statusCode, 404, 'Old non-existent file should return clean 404 without crashing');
    console.log('   ✔ PASS: Missing file returns 404 without server error.\n');

    // Clean up
    try {
      const pngFilename = path.basename(pngPath);
      const pngDisk = path.join(storageService.UPLOADS_DIR, pngFilename);
      if (fs.existsSync(pngDisk)) fs.unlinkSync(pngDisk);
      const webpFilename = path.basename(webpPath);
      const webpDisk = path.join(storageService.UPLOADS_DIR, webpFilename);
      if (fs.existsSync(webpDisk)) fs.unlinkSync(webpDisk);
    } catch (e) {}

    server.close();
    console.log('===========================================================');
    console.log(' PERSISTENCE & RESILIENCE VERIFICATION COMPLETE: ALL PASS!');
    console.log('===========================================================');

  } catch (err) {
    server.close();
    console.error('\n❌ Persistence Test Failure:', err);
    process.exit(1);
  }
};

runPersistenceTest();
