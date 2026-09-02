const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const app = require('../app');
const User = require('../models/User');
const Problem = require('../models/Problem');

let server;
let port;

function makeRequest({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    let bodyData = null;

    if (body) {
      if (typeof body === 'object') {
        bodyData = new URLSearchParams(body).toString();
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
      } else {
        bodyData = body;
        reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
      }
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

function parseCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
}

async function runTests() {
  console.log('--- STARTING SOLVELINK NO-OTP AUTH VERIFICATION SUITE ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Connect Mongo
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solvelink';
  await mongoose.connect(mongoUri);

  // Start HTTP Server on ephemeral port
  server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  port = server.address().port;
  console.log(`Test server active on port ${port}`);

  const timestamp = Date.now();
  const citizenEmail = `test_cit_${timestamp}@example.com`;
  const authorityEmail = `test_auth_${timestamp}@gov.in`;
  const universityEmail = `test_uni_${timestamp}@edu.in`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewSecretPassword456!';

  try {
    // TEST 1: Direct Citizen Registration (No OTP)
    console.log('\n1. Testing Direct Citizen Registration...');
    const regRes = await makeRequest({
      method: 'POST',
      path: '/auth/register',
      body: {
        name: 'Citizen Test User',
        email: citizenEmail,
        password: initialPassword,
        role: 'citizen',
        location: 'Ranchi, Jharkhand'
      }
    });

    assert(regRes.status === 302, 'Citizen Registration returned 302 redirect');
    assert(regRes.headers.location === '/citizen/dashboard', 'Citizen Registration redirected directly to /citizen/dashboard');
    const citizenCookie = parseCookie(regRes.headers);
    assert(!!citizenCookie, 'Session cookie issued immediately on registration');

    const citizenDbUser = await User.findOne({ email: citizenEmail });
    assert(!!citizenDbUser, 'User document created in MongoDB');
    assert(citizenDbUser.isVerified === true, 'User isVerified is true by default');
    assert(citizenDbUser.role === 'citizen', 'User role correctly assigned as citizen');

    // TEST 2: Direct Authority Registration (No OTP)
    console.log('\n2. Testing Direct Authority Registration...');
    const authRegRes = await makeRequest({
      method: 'POST',
      path: '/auth/register',
      body: {
        name: 'Municipal Officer',
        email: authorityEmail,
        password: initialPassword,
        role: 'authority',
        organization: 'Urban Development Department'
      }
    });
    assert(authRegRes.status === 302, 'Authority Registration returned 302 redirect');
    assert(authRegRes.headers.location === '/authority/dashboard', 'Authority Registration redirected directly to /authority/dashboard');

    // TEST 3: Direct University Registration (No OTP)
    console.log('\n3. Testing Direct University Registration...');
    const uniRegRes = await makeRequest({
      method: 'POST',
      path: '/auth/register',
      body: {
        name: 'Professor Rao',
        email: universityEmail,
        password: initialPassword,
        role: 'university',
        organization: 'Ranchi University'
      }
    });
    assert(uniRegRes.status === 302, 'University Registration returned 302 redirect');
    assert(uniRegRes.headers.location === '/university/dashboard', 'University Registration redirected directly to /university/dashboard');

    // TEST 4: Direct Login (No OTP)
    console.log('\n4. Testing Direct Login...');
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/auth/login',
      body: {
        email: citizenEmail,
        password: initialPassword
      }
    });
    assert(loginRes.status === 302, 'Login returned 302 redirect');
    assert(loginRes.headers.location === '/citizen/dashboard', 'Login redirected directly to /citizen/dashboard (no OTP step)');
    const loginCookie = parseCookie(loginRes.headers);
    assert(!!loginCookie, 'Active session cookie received');

    // Verify Dashboard access with session
    const dashRes = await makeRequest({
      method: 'GET',
      path: '/citizen/dashboard',
      headers: { Cookie: loginCookie }
    });
    assert(dashRes.status === 200, 'Authenticated citizen can view /citizen/dashboard');

    // TEST 5: Direct Password Reset (No OTP)
    console.log('\n5. Testing Direct Password Reset...');
    const resetRes = await makeRequest({
      method: 'POST',
      path: '/auth/reset-password',
      body: {
        email: citizenEmail,
        password: updatedPassword,
        confirmPassword: updatedPassword
      }
    });
    assert(resetRes.status === 302, 'Password reset returned 302 redirect');
    assert(resetRes.headers.location === '/auth/login?reset=true', 'Password reset redirected to /auth/login?reset=true');

    // Try login with old password (must fail)
    const oldLoginRes = await makeRequest({
      method: 'POST',
      path: '/auth/login',
      body: {
        email: citizenEmail,
        password: initialPassword
      }
    });
    assert(oldLoginRes.status === 401, 'Login with old password was rejected (401)');

    // Try login with new password (must succeed)
    const newLoginRes = await makeRequest({
      method: 'POST',
      path: '/auth/login',
      body: {
        email: citizenEmail,
        password: updatedPassword
      }
    });
    assert(newLoginRes.status === 302, 'Login with new password succeeded (302)');
    assert(newLoginRes.headers.location === '/citizen/dashboard', 'Login with new password redirected to dashboard');
    const newSessionCookie = parseCookie(newLoginRes.headers);

    // TEST 6: Direct Problem Deletion (No OTP)
    console.log('\n6. Testing Direct Problem Deletion...');
    const testProblem = await Problem.create({
      title: 'Water pipe leak on main road ' + timestamp,
      description: 'Leakage causing water wastage near community center',
      category: 'Water Supply',
      location: 'Ward 4, Ranchi',
      status: 'REPORTED',
      reportedBy: citizenDbUser._id,
      images: []
    });
    assert(!!testProblem, 'Created test problem report in MongoDB');

    const deleteRes = await makeRequest({
      method: 'POST',
      path: `/problems/${testProblem._id}/delete`,
      headers: {
        Cookie: newSessionCookie,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });
    assert(deleteRes.status === 200, 'Delete report endpoint returned 200 OK');
    const deleteData = JSON.parse(deleteRes.body);
    assert(deleteData.success === true, 'Response indicates success: true');
    assert(deleteData.redirectUrl === '/citizen/my-problems', 'Redirect URL points to /citizen/my-problems');

    const checkProblem = await Problem.findById(testProblem._id);
    assert(!checkProblem, 'Problem was permanently removed from MongoDB without OTP');

    // TEST 7: Verification that Obsolete OTP Routes Return 404
    console.log('\n7. Verifying Obsolete OTP Routes Return 404...');
    const verifyEmailGet = await makeRequest({ method: 'GET', path: '/auth/verify-email' });
    assert(verifyEmailGet.status === 404, 'GET /auth/verify-email returns 404');

    const verifyEmailPost = await makeRequest({ method: 'POST', path: '/auth/verify-email', body: { email: citizenEmail, otp: '123456' } });
    assert(verifyEmailPost.status === 404, 'POST /auth/verify-email returns 404');

    const resendOtpPost = await makeRequest({ method: 'POST', path: '/auth/resend-otp', body: { email: citizenEmail } });
    assert(resendOtpPost.status === 404, 'POST /auth/resend-otp returns 404');

    const deleteOtpRequest = await makeRequest({ method: 'POST', path: `/problems/${citizenDbUser._id}/request-delete-otp` });
    assert(deleteOtpRequest.status === 404, 'POST /problems/:id/request-delete-otp returns 404');

    const deleteOtpVerify = await makeRequest({ method: 'POST', path: `/problems/${citizenDbUser._id}/verify-delete-otp` });
    assert(deleteOtpVerify.status === 404, 'POST /problems/:id/verify-delete-otp returns 404');

    // TEST 8: Protected Routes Enforcement
    console.log('\n8. Verifying Protected Route Guards...');
    const unauthCitDash = await makeRequest({ method: 'GET', path: '/citizen/dashboard' });
    assert(unauthCitDash.status === 302, 'Unauthenticated /citizen/dashboard redirected (302)');
    assert(unauthCitDash.headers.location.includes('/auth/login'), 'Redirects to /auth/login for unauthenticated citizen');

    const unauthAuthDash = await makeRequest({ method: 'GET', path: '/authority/dashboard' });
    assert(unauthAuthDash.status === 302, 'Unauthenticated /authority/dashboard redirected (302)');

    // TEST 9: Logout Flow
    console.log('\n9. Verifying Logout Flow...');
    const logoutRes = await makeRequest({
      method: 'GET',
      path: '/auth/logout',
      headers: { Cookie: newSessionCookie }
    });
    assert(logoutRes.status === 302, 'Logout returns 302 redirect');
    assert(logoutRes.headers.location.includes('/auth/login?loggedOut=true'), 'Logout redirects to login with loggedOut query');

    // Accessing dashboard with destroyed session should now be rejected
    const afterLogoutDash = await makeRequest({
      method: 'GET',
      path: '/citizen/dashboard',
      headers: { Cookie: newSessionCookie }
    });
    assert(afterLogoutDash.status === 302, 'Dashboard access rejected after logout (302)');

    console.log(`\n========================================`);
    console.log(`SUCCESS: All ${passed}/${total} assertions passed!`);
    console.log(`========================================\n`);

  } finally {
    // Clean up test users
    await User.deleteMany({ email: { $in: [citizenEmail, authorityEmail, universityEmail] } });
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
