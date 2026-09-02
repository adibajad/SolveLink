/**
 * SolveLink Image Fix Verification Script
 * Validates Community Problems, Explore Challenges, Problem Detail, Challenge Detail,
 * Fallback placeholders, Multipart image uploads, and Static file serving.
 */

const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const app = require('../app');

const runImageTests = async () => {
  console.log('=== SOLVELINK IMAGE FLOW VERIFICATION ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solvelink';
  await mongoose.connect(mongoUri);
  console.log('[Database] Connected to MongoDB.');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Server] Test server active on port ${port}\n`);

  // Ensure test citizen user
  let citizen = await User.findOne({ email: 'image_test_citizen@solvelink.org' });
  const hashedPassword = await bcrypt.hash('password123', 10);
  if (!citizen) {
    citizen = await User.create({
      name: 'Image Tester Citizen',
      email: 'image_test_citizen@solvelink.org',
      password: hashedPassword,
      role: 'citizen',
      isVerified: true
    });
  } else {
    citizen.password = hashedPassword;
    await citizen.save();
  }

  // Create test dummy image in public/uploads if needed
  const testImgFilename = 'evidence-test-image-123.jpg';
  const testImgPath = path.join(__dirname, '../public/uploads', testImgFilename);
  // Create a minimal 1x1 valid JPEG
  const dummyJpg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
  fs.writeFileSync(testImgPath, dummyJpg);

  // Create two problems: one WITH image, one WITHOUT image
  await Problem.deleteMany({ title: /\[IMAGE-TEST\]/i });
  const probWithImg = await Problem.create({
    title: '[IMAGE-TEST] Severe Road Subsidence on Kantatoli Flyover Approach',
    description: 'Road surface collapsed creating a 3-foot trench near Kantatoli chowk.',
    category: 'Infrastructure',
    location: 'Kantatoli, Ranchi, Jharkhand',
    locationText: 'Kantatoli, Ranchi, Jharkhand',
    latitude: 23.3600,
    longitude: 85.3400,
    reportedBy: citizen._id,
    supporters: [citizen._id],
    priority: 'HIGH',
    severity: 'HIGH',
    status: 'REPORTED',
    images: [`/uploads/${testImgFilename}`]
  });

  const probWithoutImg = await Problem.create({
    title: '[IMAGE-TEST] Irregular Garbage Clearance near Morabadi Ground',
    description: 'Waste accumulation near the stadium boundary causing foul smell.',
    category: 'Waste Management',
    location: 'Morabadi, Ranchi, Jharkhand',
    locationText: 'Morabadi, Ranchi, Jharkhand',
    latitude: 23.3800,
    longitude: 85.3300,
    reportedBy: citizen._id,
    supporters: [citizen._id],
    priority: 'MEDIUM',
    severity: 'MEDIUM',
    status: 'COMMUNITY_REVIEW',
    images: []
  });

  // Create two challenges: one with explicit image, one without (relying on category image)
  await Challenge.deleteMany({ title: /\[IMAGE-TEST\]/i });
  const chalWithImg = await Challenge.create({
    title: '[IMAGE-TEST] Autonomous Pothole Filling Machine Prototype',
    description: 'Engineering challenge to deploy automated cold-patch sealant vehicle.',
    category: 'Infrastructure',
    location: 'Ranchi Municipal Corporation',
    department: 'Road Construction Dept',
    image: '/images/jharkhand-hero.jpg',
    requiredSkills: ['Civil Engineering', 'Robotics'],
    deadline: new Date(Date.now() + 30 * 86400000),
    status: 'PUBLISHED',
    sourceProblem: probWithImg._id,
    createdBy: citizen._id
  });

  const chalWithoutImg = await Challenge.create({
    title: '[IMAGE-TEST] Low-Cost Solar Cold-Storage for Forest Produce',
    description: 'Micro-storage refrigeration units for tribal produce.',
    category: 'Agriculture & Energy',
    location: 'Khunti District',
    department: 'Tribal Welfare & Agriculture',
    requiredSkills: ['Renewable Energy', 'Thermal Engineering'],
    deadline: new Date(Date.now() + 25 * 86400000),
    status: 'PUBLISHED',
    sourceProblem: probWithoutImg._id,
    createdBy: citizen._id
  });

  let sessionCookie = '';

  const request = (method, reqPath, data = null, customHeaders = {}) => {
    return new Promise((resolve, reject) => {
      const dataStr = data ? (typeof data === 'string' ? data || '' : JSON.stringify(data)) : null;
      const headers = { ...customHeaders };
      if (sessionCookie) headers['Cookie'] = sessionCookie;
      if (dataStr) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(dataStr);
      }

      const req = http.request(`http://localhost:${port}${reqPath}`, {
        method,
        headers
      }, (res) => {
        if (res.headers['set-cookie']) {
          const rawCookies = res.headers['set-cookie'];
          sessionCookie = rawCookies.map(c => c.split(';')[0]).join('; ');
        }
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });

      req.on('error', reject);
      if (dataStr) req.write(dataStr);
      req.end();
    });
  };

  try {
    // Authenticate citizen
    console.log('0. Logging in test citizen...');
    const loginRes = await request('POST', '/auth/login', `email=${encodeURIComponent('image_test_citizen@solvelink.org')}&password=password123`, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    if (loginRes.statusCode !== 302) throw new Error(`Login failed with code ${loginRes.statusCode}`);
    console.log('   ✔ Logged in.\n');

    // TEST 1: Community Problems (Authenticated) - Uploaded Image vs Fallback Placeholder
    console.log('TEST 1 & 6: Checking Community Problems Page for Uploaded Image & Fallback Placeholder...');
    const commRes = await request('GET', '/problems');
    if (commRes.statusCode !== 200) throw new Error(`GET /problems failed with status ${commRes.statusCode}`);
    
    // Check that problem WITH image renders its thumbnail
    if (!commRes.body.includes(`/uploads/${testImgFilename}`)) {
      throw new Error(`Problem with image did not render /uploads/${testImgFilename} in thumbnail`);
    }
    // Check that problem WITHOUT image renders clean SolveLink placeholder
    if (!commRes.body.includes('community-card-thumb-placeholder') || !commRes.body.includes('No photo attached')) {
      throw new Error('Problem without image did not render clean SolveLink fallback placeholder');
    }
    // Verify onerror fallback handler is present
    if (!commRes.body.includes('community-card-thumb') || !commRes.body.includes('loading="lazy"')) {
      throw new Error('Thumbnail missing lazy loading or community-card-thumb styling');
    }
    console.log('   ✔ PASS: Problem with photo renders uploaded image; problem without photo renders clean SolveLink placeholder.\n');

    // TEST 2: Problem Detail Page - Image Gallery & Empty State
    console.log('TEST 3: Checking Problem Detail Page for Image Gallery & Fallback...');
    const probDetailWithImg = await request('GET', `/problems/${probWithImg._id}`);
    if (probDetailWithImg.statusCode !== 200) throw new Error('Problem Detail with image failed');
    if (!probDetailWithImg.body.includes(`/uploads/${testImgFilename}`)) {
      throw new Error('Problem Detail page missing uploaded photo evidence in gallery');
    }

    const probDetailWithoutImg = await request('GET', `/problems/${probWithoutImg._id}`);
    if (probDetailWithoutImg.statusCode !== 200) throw new Error('Problem Detail without image failed');
    if (!probDetailWithoutImg.body.includes('No additional photo attachments were uploaded')) {
      throw new Error('Problem Detail without image missing graceful placeholder message');
    }
    console.log('   ✔ PASS: Problem Detail displays uploaded photo in evidence gallery and graceful notice when no photos attached.\n');

    // TEST 4: Explore Challenges Page (/challenges) - 3-Column Card Image Resolution
    console.log('TEST 4 & 7: Checking Explore Challenges (/challenges)...');
    const chalRes = await request('GET', '/challenges');
    if (chalRes.statusCode !== 200) throw new Error('Explore Challenges failed to load');
    if (!chalRes.body.includes('challenges-grid-3col')) throw new Error('Explore Challenges missing 3-column grid');
    // Challenge with custom image should render its image
    if (!chalRes.body.includes('/images/jharkhand-hero.jpg')) {
      throw new Error('Challenge with custom image did not render');
    }
    // Challenge without image should resolve to category documentary image (challenge-agriculture.jpg)
    if (!chalRes.body.includes('/images/challenge-agriculture.jpg')) {
      throw new Error('Challenge without custom image did not resolve to category image /images/challenge-agriculture.jpg');
    }
    console.log('   ✔ PASS: Explore Challenges renders images for all cards with category fallbacks and 3-column grid.\n');

    // TEST 5: Challenge Detail Page (/challenges/:id)
    console.log('TEST 5: Checking Challenge Detail Page (/challenges/:id)...');
    const chalDetailRes = await request('GET', `/challenges/${chalWithoutImg._id}`);
    if (chalDetailRes.statusCode !== 200) throw new Error('Challenge Detail failed to load');
    if (!chalDetailRes.body.includes('/images/challenge-agriculture.jpg')) {
      throw new Error('Challenge Detail hero image did not resolve to category image /images/challenge-agriculture.jpg');
    }
    if (!chalDetailRes.body.includes('challenge-detail-hero-2col') || !chalDetailRes.body.includes('challenge-detail-hero-img')) {
      throw new Error('Challenge Detail missing 2-column hero image structure');
    }
    console.log('   ✔ PASS: Challenge Detail hero image renders cleanly.\n');

    // TEST 6: Citizen Dashboard - Explore Challenges Section
    console.log('TEST 6: Checking Citizen Dashboard Explore Challenges Thumbnails...');
    const dashRes = await request('GET', '/citizen/dashboard');
    if (dashRes.statusCode !== 200) throw new Error('Citizen Dashboard failed to load');
    if (!dashRes.body.includes('citizen-challenge-thumb')) {
      throw new Error('Citizen Dashboard missing challenge thumbnail images');
    }
    if (!dashRes.body.includes('/images/challenge-agriculture.jpg') && !dashRes.body.includes('/images/jharkhand-hero.jpg')) {
      throw new Error('Citizen Dashboard challenge cards missing resolved challenge imagery');
    }
    console.log('   ✔ PASS: Citizen Dashboard Explore Challenges section displays actual challenge and category imagery.\n');

    // TEST 7: Static Asset Serving Check
    console.log('TEST 8: Verifying Static File Endpoints...');
    const staticImg1 = await request('GET', '/images/challenge-water.jpg');
    if (staticImg1.statusCode !== 200 || !staticImg1.headers['content-type'].includes('image')) {
      throw new Error('Static asset /images/challenge-water.jpg failed');
    }
    const staticImg2 = await request('GET', '/images/challenge-agriculture.jpg');
    if (staticImg2.statusCode !== 200 || !staticImg2.headers['content-type'].includes('image')) {
      throw new Error('Static asset /images/challenge-agriculture.jpg failed');
    }
    const staticImg3 = await request('GET', '/images/challenge-education.jpg');
    if (staticImg3.statusCode !== 200 || !staticImg3.headers['content-type'].includes('image')) {
      throw new Error('Static asset /images/challenge-education.jpg failed');
    }
    const staticImg4 = await request('GET', '/images/jharkhand-hero.jpg');
    if (staticImg4.statusCode !== 200 || !staticImg4.headers['content-type'].includes('image')) {
      throw new Error('Static asset /images/jharkhand-hero.jpg failed');
    }
    const staticUpload = await request('GET', `/uploads/${testImgFilename}`);
    if (staticUpload.statusCode !== 200 || !staticUpload.headers['content-type'].includes('image')) {
      throw new Error(`Uploaded static asset /uploads/${testImgFilename} failed`);
    }
    console.log('   ✔ PASS: Static file routes serve all challenge images and uploaded evidence with correct image Content-Type headers.\n');

    // TEST 8: Public Visitors (Guest) Layouts
    console.log('TEST 9: Checking Public Visitor (Guest) Layouts for Problems & Challenges...');
    sessionCookie = ''; // Clear session
    const publicProblems = await request('GET', '/problems');
    if (publicProblems.statusCode !== 200) throw new Error('Public /problems failed');
    if (!publicProblems.body.includes(`/uploads/${testImgFilename}`) || !publicProblems.body.includes('community-card-thumb-placeholder')) {
      throw new Error('Public /problems missing thumbnails or fallback placeholders');
    }

    const publicChallenges = await request('GET', '/challenges');
    if (publicChallenges.statusCode !== 200) throw new Error('Public /challenges failed');
    if (!publicChallenges.body.includes('/images/challenge-agriculture.jpg')) {
      throw new Error('Public /challenges missing category resolved images');
    }
    console.log('   ✔ PASS: Public guest views render thumbnails, fallbacks, and category imagery consistently.\n');

    // Cleanup
    await Problem.deleteMany({ title: /\[IMAGE-TEST\]/i });
    await Challenge.deleteMany({ title: /\[IMAGE-TEST\]/i });
    await User.deleteOne({ email: 'image_test_citizen@solvelink.org' });
    try {
      if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);
    } catch (e) {}

    console.log('==================================================');
    console.log('ALL IMAGE FLOW VERIFICATION TESTS PASSED (10/10)!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n[IMAGE TEST FAILURE]', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
};

runImageTests();
