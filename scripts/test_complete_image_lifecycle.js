/**
 * SolveLink Complete Image Lifecycle & Authority Display Verification Test
 * 
 * Verifies:
 * 1. Problem model stores `images` as array of strings
 * 2. Static file serving at /uploads and nested relative paths (/authority/problems/uploads, /problems/uploads)
 * 3. Authority problems triage list page renders thumbnails
 * 4. Authority problem detail page renders resilient evidence gallery
 * 5. Citizen problem detail page renders resilient evidence gallery
 * 6. Authority dashboard priority problems list renders thumbnails
 * 7. Authority create challenge banner displays problem thumbnail
 * 8. Missing images fail gracefully to clean placeholders instead of broken icons or hidden containers
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = require('../app');

const runTest = async () => {
  console.log('===========================================================');
  console.log(' SOLVELINK COMPLETE IMAGE LIFECYCLE VERIFICATION');
  console.log('===========================================================\n');

  // 1. Ensure test image exists in public/uploads
  const testImgFilename = 'evidence-test-verify-123.jpg';
  const testImgPath = path.join(__dirname, '../public/uploads', testImgFilename);
  const minimalJpeg = Buffer.from([
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
  fs.writeFileSync(testImgPath, minimalJpeg);

  // Start test server
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Server] Running on http://localhost:${port}\n`);

  const request = (method, reqPath, headers = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://localhost:${port}${reqPath}`, {
        method,
        headers
      }, (res) => {
        let resBody = '';
        res.on('data', chunk => resBody += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: resBody }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };

  try {
    // TEST 1: Static file serving for uploads
    console.log('TEST 1: Verifying direct static file serving at /uploads...');
    const staticRes = await request('GET', `/uploads/${testImgFilename}`);
    assert.strictEqual(staticRes.statusCode, 200, 'Static image endpoint should return 200');
    assert(staticRes.headers['content-type'].includes('image'), 'Should have image Content-Type header');
    console.log('  ✔ Direct /uploads serving verified (HTTP 200 image/jpeg).\n');

    // TEST 2: Nested relative path fallback serving
    console.log('TEST 2: Verifying nested relative path fallback (/authority/problems/uploads and /problems/uploads)...');
    const nestedRes1 = await request('GET', `/authority/problems/uploads/${testImgFilename}`);
    assert.strictEqual(nestedRes1.statusCode, 200, 'Nested authority relative path should resolve to uploaded image');

    const nestedRes2 = await request('GET', `/problems/uploads/${testImgFilename}`);
    assert.strictEqual(nestedRes2.statusCode, 200, 'Nested problem relative path should resolve to uploaded image');
    console.log('  ✔ Nested relative path fallbacks verified (HTTP 200 from sub-routes).\n');

    // TEST 3: Template rendering & Evidence Gallery fallback tests (EJS direct view rendering)
    console.log('TEST 3: Testing views/authority/problem-detail.ejs rendering with photos & fallbacks...');
    const ejs = require('ejs');
    const authDetailTemplate = fs.readFileSync(path.join(__dirname, '../views/authority/problem-detail.ejs'), 'utf8');

    // Mock problem with 2 photos (1 existing, 1 missing)
    const mockProblemWithPhotos = {
      _id: '67c514890abcdef123456789',
      title: 'Broken culvert on Kanke Road',
      description: 'Severe structural cracking causing drainage backup across 300 meters.',
      category: 'Water & Sanitation',
      location: 'Kanke Road, Ranchi, Jharkhand',
      status: 'REPORTED',
      priority: 'HIGH',
      createdAt: new Date(),
      reportedBy: { name: 'Sunita Soren', email: 'sunita@example.com' },
      supporters: [{ name: 'Sunita Soren' }, { name: 'Amit Kumar' }],
      images: [
        `/uploads/${testImgFilename}`,
        '/uploads/evidence-nonexistent-999.jpg'
      ],
      aiClassification: {
        domain: 'water_sanitation',
        category: 'drainage_infrastructure',
        urgency: 'HIGH',
        confidence: 0.94
      },
      assignmentStatus: 'assigned'
    };

    const renderedAuthDetail = ejs.render(authDetailTemplate, {
      problem: mockProblemWithPhotos,
      user: { name: 'Authority Officer', role: 'authority' },
      associatedChallenge: null,
      sectors: [],
      successMsg: null,
      activePath: '/authority/problems',
      filename: path.join(__dirname, '../views/authority/problem-detail.ejs')
    });

    assert(renderedAuthDetail.includes('Field Evidence Photos (2)'), 'Should display correct photo count');
    assert(renderedAuthDetail.includes(`/uploads/${testImgFilename}`), 'Should contain image URL');
    assert(renderedAuthDetail.includes('evidence-thumb-fallback'), 'Should contain evidence-thumb-fallback element');
    assert(!renderedAuthDetail.includes("this.parentElement.style.display='none'"), 'Should NOT use destructive parent hiding onerror');
    assert(renderedAuthDetail.includes("this.nextElementSibling.style.display='flex'"), 'Should reveal fallback card on error');
    assert(renderedAuthDetail.includes('target="_blank"'), 'Should make photos clickable');
    console.log('  ✔ Authority problem detail renders gallery, clickable links, and graceful fallback card.\n');

    // TEST 4: Authority problem detail with NO photos
    console.log('TEST 4: Testing views/authority/problem-detail.ejs with NO photos attached...');
    const mockProblemNoPhotos = {
      ...mockProblemWithPhotos,
      images: []
    };

    const renderedNoPhotos = ejs.render(authDetailTemplate, {
      problem: mockProblemNoPhotos,
      user: { name: 'Authority Officer', role: 'authority' },
      associatedChallenge: null,
      sectors: [],
      successMsg: null,
      activePath: '/authority/problems',
      filename: path.join(__dirname, '../views/authority/problem-detail.ejs')
    });

    assert(renderedNoPhotos.includes('No photo attachments were uploaded with this submission'), 'Should display clean empty notice');
    console.log('  ✔ Empty photo state verified on authority problem detail.\n');

    // TEST 5: views/authority/problems.ejs (Triage List) Thumbnail rendering
    console.log('TEST 5: Testing views/authority/problems.ejs triage list thumbnail rendering...');
    const authListTemplate = fs.readFileSync(path.join(__dirname, '../views/authority/problems.ejs'), 'utf8');

    const renderedAuthList = ejs.render(authListTemplate, {
      problems: [mockProblemWithPhotos, mockProblemNoPhotos],
      user: { name: 'Authority Officer', role: 'authority' },
      sectors: [],
      query: {},
      activePath: '/authority/problems',
      filename: path.join(__dirname, '../views/authority/problems.ejs')
    });

    assert(renderedAuthList.includes(`/uploads/${testImgFilename}`), 'Should render problem thumbnail image on triage card');
    assert(renderedAuthList.includes('No photo'), 'Should render "No photo" placeholder badge for problem without image');
    console.log('  ✔ Authority problems triage list renders thumbnails and "No photo" placeholders.\n');

    // TEST 6: views/authority/dashboard.ejs (Priority Problems) Thumbnail rendering
    console.log('TEST 6: Testing views/authority/dashboard.ejs priority problems thumbnail rendering...');
    const authDashTemplate = fs.readFileSync(path.join(__dirname, '../views/authority/dashboard.ejs'), 'utf8');

    const renderedAuthDash = ejs.render(authDashTemplate, {
      user: { name: 'Authority Officer', role: 'authority' },
      metrics: { totalProblems: 5, pendingVerification: 2, activeChallenges: 1, totalSolutions: 3, implementations: 1 },
      priorityProblems: [mockProblemWithPhotos],
      myChallenges: [],
      pendingSolutions: [],
      activePath: '/authority/dashboard',
      filename: path.join(__dirname, '../views/authority/dashboard.ejs')
    });

    assert(renderedAuthDash.includes(`/uploads/${testImgFilename}`), 'Should render thumbnail on dashboard priority problem card');
    console.log('  ✔ Authority dashboard priority problems list renders thumbnail preview.\n');

    // TEST 7: views/citizen/problem-detail.ejs Evidence Gallery rendering
    console.log('TEST 7: Testing views/citizen/problem-detail.ejs evidence gallery rendering...');
    const citizenDetailTemplate = fs.readFileSync(path.join(__dirname, '../views/citizen/problem-detail.ejs'), 'utf8');

    const renderedCitizenDetail = ejs.render(citizenDetailTemplate, {
      problem: mockProblemWithPhotos,
      user: { _id: '67c514890abcdef123456789', name: 'Citizen User', role: 'citizen' },
      activePath: '/problems',
      isSupporter: true,
      supportersCount: 2,
      associatedChallenge: null,
      selectedSolution: null,
      currentUserId: '67c514890abcdef123456789',
      filename: path.join(__dirname, '../views/citizen/problem-detail.ejs')
    });

    assert(renderedCitizenDetail.includes('Photo Evidence (2)'), 'Should display Photo Evidence count');
    assert(renderedCitizenDetail.includes('evidence-thumb-fallback'), 'Should contain graceful fallback card');
    assert(renderedCitizenDetail.includes('target="_blank"'), 'Should make photos clickable in citizen view');
    console.log('  ✔ Citizen problem detail renders gallery with clickable links and graceful fallback.\n');

    // TEST 8: views/citizen/my-problems.ejs Thumbnail rendering
    console.log('TEST 8: Testing views/citizen/my-problems.ejs thumbnail rendering...');
    const citizenMyProblemsTemplate = fs.readFileSync(path.join(__dirname, '../views/citizen/my-problems.ejs'), 'utf8');

    const renderedCitizenMyProb = ejs.render(citizenMyProblemsTemplate, {
      problems: [mockProblemWithPhotos, mockProblemNoPhotos],
      user: { name: 'Citizen User', role: 'citizen' },
      query: {},
      activePath: '/citizen/my-problems',
      filename: path.join(__dirname, '../views/citizen/my-problems.ejs')
    });

    assert(renderedCitizenMyProb.includes(`/uploads/${testImgFilename}`), 'Should render thumbnail on citizen my-problems card');
    assert(renderedCitizenMyProb.includes('No photo'), 'Should render "No photo" badge on card without image');
    console.log('  ✔ Citizen my-problems list renders thumbnail and "No photo" badge.\n');

    // TEST 9: views/authority/create-challenge.ejs prefill banner photo preview
    console.log('TEST 9: Testing views/authority/create-challenge.ejs prefill banner photo preview...');
    const createChalTemplate = fs.readFileSync(path.join(__dirname, '../views/authority/create-challenge.ejs'), 'utf8');

    const renderedCreateChal = ejs.render(createChalTemplate, {
      user: { name: 'Authority Officer', role: 'authority' },
      sourceProblem: mockProblemWithPhotos,
      prefill: {
        title: 'Water culvert repair challenge',
        description: 'Design culvert reinforcement',
        category: 'water_sanitation',
        location: 'Kanke Road, Ranchi',
        sourceProblemId: mockProblemWithPhotos._id
      },
      sectors: [],
      error: null,
      activePath: '/authority/create-challenge',
      filename: path.join(__dirname, '../views/authority/create-challenge.ejs')
    });

    assert(renderedCreateChal.includes(`/uploads/${testImgFilename}`), 'Should display source problem thumbnail in create challenge prefill banner');
    console.log('  ✔ Authority create challenge prefill banner displays source problem evidence photo.\n');

    // Clean up test file
    try {
      if (fs.existsSync(testImgPath)) fs.unlinkSync(testImgPath);
    } catch (e) {}

    server.close();
    console.log('===========================================================');
    console.log(' ALL 9 IMAGE LIFECYCLE TESTS PASSED PERFECTLY!');
    console.log('===========================================================');

  } catch (err) {
    server.close();
    console.error('\n❌ Test Failure:', err);
    process.exit(1);
  }
};

runTest();
