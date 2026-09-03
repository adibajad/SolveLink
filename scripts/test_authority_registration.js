const assert = require('assert');
const User = require('../models/User');
const authController = require('../controllers/authController');

console.log('=== TEST SUITE: AUTHORITY REGISTRATION & SAFE TYPE VALIDATION ===\n');

// Mock User.findOne and User.create
const originalFindOne = User.findOne;
const originalCreate = User.create;

let createdUserPayload = null;

User.findOne = async function (query) {
  if (query.email === 'duplicate@example.com') {
    return { email: 'duplicate@example.com' };
  }
  return null;
};

User.create = async function (payload) {
  createdUserPayload = payload;
  return {
    _id: 'mock_user_id_12345',
    ...payload
  };
};

function createMockReqRes(body) {
  let resStatus = 200;
  let renderTarget = null;
  let renderData = null;
  let redirectTarget = null;

  const req = {
    body,
    session: {
      save: (cb) => cb(null)
    }
  };

  const res = {
    status: (code) => {
      resStatus = code;
      return res;
    },
    render: (view, data) => {
      renderTarget = view;
      renderData = data;
      return { status: resStatus, view, data };
    },
    redirect: (url) => {
      redirectTarget = url;
      return { status: 302, url };
    }
  };

  return { req, res, getResult: () => ({ status: resStatus, renderTarget, renderData, redirectTarget }) };
}

async function runTests() {
  let passed = 0;
  let total = 0;

  function check(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${desc}:`, err.message);
    }
  }

  // TEST 1: Authority registration with duplicate organization array ['', ''] (The exact reported bug)
  console.log('1. Testing Authority registration with duplicate organization array [\'\', \'\'] (Root cause scenario)...');
  createdUserPayload = null;
  const t1 = createMockReqRes({
    name: 'Dr. Rajesh Kumar',
    email: 'rajesh@rmc.gov.in',
    password: 'password123',
    role: 'authority',
    organization: ['', ''],
    authoritySector: 'municipal_corporation',
    department: 'Municipal Water Supply Department',
    jurisdiction: 'Ranchi District',
    location: 'Ranchi, Jharkhand'
  });

  await authController.postRegister(t1.req, t1.res);
  const r1 = t1.getResult();

  check('Does not throw TypeError on organization.trim()', () => {
    assert.strictEqual(r1.redirectTarget, '/authority/dashboard');
  });

  check('Successfully created Authority user with organization="Ranchi Municipal Corporation"', () => {
    assert(createdUserPayload !== null, 'User should be created');
    assert.strictEqual(createdUserPayload.role, 'authority');
    assert.strictEqual(createdUserPayload.organization, 'Ranchi Municipal Corporation');
    assert.strictEqual(createdUserPayload.department, 'Municipal Water Supply Department');
    assert.strictEqual(createdUserPayload.authoritySector, 'municipal_corporation');
    assert.strictEqual(createdUserPayload.jurisdiction, 'Ranchi District');
    assert.strictEqual(createdUserPayload.location, 'Ranchi, Jharkhand');
  });

  check('Session user has organization="Ranchi Municipal Corporation"', () => {
    assert.strictEqual(t1.req.session.user.organization, 'Ranchi Municipal Corporation');
    assert.strictEqual(t1.req.session.user.department, 'Municipal Water Supply Department');
  });

  // TEST 2: Authority with explicit organization string
  console.log('\n2. Testing Authority registration with explicit organization string...');
  createdUserPayload = null;
  const t2 = createMockReqRes({
    name: 'Municipal Officer',
    email: 'officer@gov.in',
    password: 'password123',
    role: 'authority',
    organization: 'Urban Development Department',
    authoritySector: 'municipal_corporation',
    department: 'Engineering Wing',
    jurisdiction: 'Ranchi District',
    location: 'Ranchi, Jharkhand'
  });

  await authController.postRegister(t2.req, t2.res);
  const r2 = t2.getResult();

  check('Preserves explicit organization string', () => {
    assert.strictEqual(r2.redirectTarget, '/authority/dashboard');
    assert.strictEqual(createdUserPayload.organization, 'Urban Development Department');
    assert.strictEqual(createdUserPayload.department, 'Engineering Wing');
  });

  // TEST 3: Safe type validation - Malformed object organization
  console.log('\n3. Testing safe type validation with malformed organization object...');
  const t3 = createMockReqRes({
    name: 'Test Officer',
    email: 'test@gov.in',
    password: 'password123',
    role: 'authority',
    organization: { malicious: 'object' }
  });

  await authController.postRegister(t3.req, t3.res);
  const r3 = t3.getResult();

  check('Returns 400 Bad Request on malformed object organization', () => {
    assert.strictEqual(r3.status, 400);
    assert.strictEqual(r3.renderData.error, 'Organization must be a valid text string.');
  });

  // TEST 4: Safe type validation - Malformed array containing non-string
  console.log('\n4. Testing safe type validation with array containing non-string...');
  const t4 = createMockReqRes({
    name: 'Test Officer',
    email: 'test@gov.in',
    password: 'password123',
    role: 'authority',
    organization: [123, 456]
  });

  await authController.postRegister(t4.req, t4.res);
  const r4 = t4.getResult();

  check('Returns 400 Bad Request on array containing numbers', () => {
    assert.strictEqual(r4.status, 400);
    assert.strictEqual(r4.renderData.error, 'Organization must be a valid text string.');
  });

  // TEST 5: Safe type validation - Conflicting multiple organizations in array
  console.log('\n5. Testing safe type validation with multiple conflicting organizations...');
  const t5 = createMockReqRes({
    name: 'Test Officer',
    email: 'test@gov.in',
    password: 'password123',
    role: 'authority',
    organization: ['Municipal Corporation', 'State Power Board']
  });

  await authController.postRegister(t5.req, t5.res);
  const r5 = t5.getResult();

  check('Returns 400 Bad Request on conflicting organizations array', () => {
    assert.strictEqual(r5.status, 400);
    assert(r5.renderData.error.includes('conflicting organization values'));
  });

  // TEST 6: University registration flow preserved
  console.log('\n6. Testing University registration flow...');
  createdUserPayload = null;
  const t6 = createMockReqRes({
    name: 'Dr. A. Sharma',
    email: 'sharma@bitmesra.ac.in',
    password: 'password123',
    role: 'university',
    organization: 'AquaTech Innovation Lab, BIT Mesra',
    domains: 'water_sanitation, iot',
    skills: 'IoT, Sensors',
    technologies: 'ESP32, LoRaWAN',
    location: 'Ranchi, Jharkhand'
  });

  await authController.postRegister(t6.req, t6.res);
  const r6 = t6.getResult();

  check('University user created and redirected to /university/dashboard', () => {
    assert.strictEqual(r6.redirectTarget, '/university/dashboard');
    assert.strictEqual(createdUserPayload.role, 'university');
    assert.strictEqual(createdUserPayload.organization, 'AquaTech Innovation Lab, BIT Mesra');
    assert.deepStrictEqual(createdUserPayload.domains, ['water_sanitation', 'iot']);
  });

  // TEST 7: Industry registration flow preserved
  console.log('\n7. Testing Industry registration flow...');
  createdUserPayload = null;
  const t7 = createMockReqRes({
    name: 'Industrial Lead',
    email: 'contact@smartsystems.com',
    password: 'password123',
    role: 'industry',
    organization: 'Smart Systems Industrial Solutions Pvt Ltd',
    industrySector: 'water_sanitation',
    capabilities: 'Pilot Implementation, Fabrication',
    technologies: 'PCB Assembly, CNC Machining',
    location: 'Jamshedpur, Jharkhand'
  });

  await authController.postRegister(t7.req, t7.res);
  const r7 = t7.getResult();

  check('Industry user created and redirected to /industry/dashboard', () => {
    assert.strictEqual(r7.redirectTarget, '/industry/dashboard');
    assert.strictEqual(createdUserPayload.role, 'industry');
    assert.strictEqual(createdUserPayload.organization, 'Smart Systems Industrial Solutions Pvt Ltd');
    assert.strictEqual(createdUserPayload.industrySector, 'water_sanitation');
  });

  // TEST 8: Citizen registration flow preserved
  console.log('\n8. Testing Citizen registration flow...');
  createdUserPayload = null;
  const t8 = createMockReqRes({
    name: 'Citizen Resident',
    email: 'citizen@example.com',
    password: 'password123',
    role: 'citizen',
    location: 'Ranchi, Jharkhand'
  });

  await authController.postRegister(t8.req, t8.res);
  const r8 = t8.getResult();

  check('Citizen user created and redirected to /citizen/dashboard', () => {
    assert.strictEqual(r8.redirectTarget, '/citizen/dashboard');
    assert.strictEqual(createdUserPayload.role, 'citizen');
    assert.strictEqual(createdUserPayload.organization, '');
  });

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
