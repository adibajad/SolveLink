/**
 * SolveLink Persistent Storage Service
 * 
 * Provides resilient, restart-proof file storage for evidence photos:
 * 1. Cloudinary (if environment variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set)
 * 2. MongoDB GridFS (default durable storage on Render using the existing MongoDB Atlas cluster)
 * 3. Local disk cache (public/uploads) for ultra-fast local read access
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Readable } = require('stream');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    console.warn('[StorageService] Could not create local uploads dir:', e.message);
  }
}

const storageService = {};

/**
 * Get GridFS bucket instance if MongoDB is connected
 */
function getGridFSBucket() {
  if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'problem_photos'
    });
  }
  return null;
}

/**
 * Save file buffer to durable storage.
 * 
 * @param {Object} file - { buffer, originalname, mimetype }
 * @returns {Promise<string>} - Stored URL or path, e.g. "/uploads/evidence-123.jpg"
 */
async function saveFile({ buffer, originalname, mimetype }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('File buffer is required for persistent storage.');
  }

  // Validate extension
  const rawExt = path.extname(originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = allowedExts.includes(rawExt) ? rawExt : '.jpg';

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = `evidence-${uniqueSuffix}${ext}`;
  const resolvedMime = mimetype || (ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg'));

  // 1. Optional External Cloudinary Storage
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'solvelink/evidence',
            public_id: `evidence-${uniqueSuffix}`,
            resource_type: 'image'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
      });

      return uploadResult.secure_url;
    } catch (cloudErr) {
      console.warn('[StorageService] Cloudinary upload failed, falling back to GridFS:', cloudErr.message);
    }
  }

  // 2. Always write to local disk as well (serves as fast read cache)
  try {
    const localFilePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(localFilePath, buffer);
  } catch (diskErr) {
    console.warn('[StorageService] Local disk cache write notice:', diskErr.message);
  }

  // 3. Persist to MongoDB GridFS (Survives Render container redeployments and restarts)
  const bucket = storageService.getGridFSBucket();
  if (bucket) {
    await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: resolvedMime,
        metadata: {
          originalname: originalname || filename,
          mimetype: resolvedMime,
          size: buffer.length,
          uploadedAt: new Date()
        }
      });

      uploadStream.on('finish', () => resolve());
      uploadStream.on('error', (err) => {
        console.error('[StorageService] GridFS upload error:', err);
        // If local disk write succeeded, don't break the user request
        resolve();
      });

      uploadStream.end(buffer);
    });
  } else {
    console.log('[StorageService] MongoDB not currently connected; file saved locally to disk.');
  }

  return `/uploads/${filename}`;
}

/**
 * Retrieve a file stream and metadata for serving via Express
 * 
 * @param {string} filename
 * @returns {Promise<{ stream: Readable, mimetype: string, size?: number } | null>}
 */
async function getFileStream(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const safeFilename = path.basename(filename);

  // 1. Check local disk first (fast path)
  const localFilePath = path.join(UPLOADS_DIR, safeFilename);
  if (fs.existsSync(localFilePath)) {
    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    try {
      const stat = fs.statSync(localFilePath);
      return {
        stream: fs.createReadStream(localFilePath),
        mimetype: mimeMap[ext] || 'application/octet-stream',
        size: stat.size
      };
    } catch (err) {
      console.warn('[StorageService] Local read warning:', err.message);
    }
  }

  // 2. Check MongoDB GridFS (Durable fallback after Render restart/redeploy)
  const bucket = storageService.getGridFSBucket();
  if (bucket) {
    try {
      const files = await bucket.find({ filename: safeFilename }).limit(1).toArray();
      if (files && files.length > 0) {
        const fileDoc = files[0];
        const stream = bucket.openDownloadStreamByName(safeFilename);
        const mimetype = (fileDoc.metadata && fileDoc.metadata.mimetype) || fileDoc.contentType || 'image/jpeg';
        return {
          stream,
          mimetype,
          size: fileDoc.length
        };
      }
    } catch (gridErr) {
      console.error('[StorageService] GridFS lookup error:', gridErr.message);
    }
  }

  return null;
}

/**
 * Delete a file from disk and GridFS
 * 
 * @param {string} fileUrlOrPath
 */
async function deleteFile(fileUrlOrPath) {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return;
  const filename = path.basename(fileUrlOrPath);

  // Remove from local disk
  try {
    const localFilePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (e) {
    console.warn('[StorageService] Disk delete warning:', e.message);
  }

  // Remove from GridFS
  const bucket = storageService.getGridFSBucket();
  if (bucket) {
    try {
      const files = await bucket.find({ filename }).toArray();
      for (const file of files) {
        await bucket.delete(file._id);
      }
    } catch (e) {
      console.warn('[StorageService] GridFS delete warning:', e.message);
    }
  }
}

storageService.saveFile = saveFile;
storageService.getFileStream = getFileStream;
storageService.deleteFile = deleteFile;
storageService.getGridFSBucket = getGridFSBucket;
storageService.UPLOADS_DIR = UPLOADS_DIR;

module.exports = storageService;
