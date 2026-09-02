/**
 * Detailed Logout Verification Test Suite
 */
const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const app = require('../app');

const testLogout = async () => {
  console.log('=== LOGOUT FUNCTIONALITY & MODAL VERIFICATION TEST ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solvelink';
  await mongoose.connect(mongoUri);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  // Create test citizen
  const email = 'logout_test_user@solvelink.org';
  await User.deleteOne({ email });
  const hashedPassword = await bcrypt.hash('password123', 10);
  await User.create({
    name: 'Logout Tester',
    email,
    password: hashedPassword,
    role: 'citizen',
    isVerified: true
  });

  let sessionCookie = '';

  const request = (method, path, data = null, customHeaders = {}) => {
    return new Promise((resolve, reject) => {
      const dataStr = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
      const headers = { ...customHeaders };
      if (sessionCookie) headers['Cookie'] = sessionCookie;
      if (dataStr) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(dataStr);
      }

      const req = http.request(`http://localhost:${port}${path}`, {
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
    // 1. Login
    console.log('1. Logging in as Citizen...');
    const loginRes = await request('POST', '/auth/login', `email=${encodeURIComponent(email)}&password=password123`, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    if (loginRes.statusCode !== 302) throw new Error('Login failed');
    console.log('   [PASS] Login successful, session established.');

    // 2. Verify dashboard accessible
    console.log('2. Accessing /citizen/dashboard with active session...');
    const dashRes = await request('GET', '/citizen/dashboard');
    if (dashRes.statusCode !== 200 || !dashRes.body.includes('Logout Tester')) {
      throw new Error('Could not access dashboard');
    }
    if (!dashRes.body.includes('logoutConfirmModal')) {
      throw new Error('Logout confirmation modal markup missing on dashboard');
    }
    if (!dashRes.body.includes('logoutConfirmForm') || !dashRes.body.includes('btnConfirmLogout')) {
      throw new Error('Logout confirmation form missing');
    }
    console.log('   [PASS] Dashboard accessible and logout modal markup intact.');

    // 3. Test POST /auth/logout
    console.log('3. Executing POST /auth/logout (modal confirmation action)...');
    const logoutRes = await request('POST', '/auth/logout');
    if (logoutRes.statusCode !== 302 || !logoutRes.headers.location.includes('/auth/login?loggedOut=true')) {
      throw new Error('POST /auth/logout did not redirect to /auth/login?loggedOut=true');
    }
    console.log('   [PASS] POST /auth/logout succeeded and redirected to login.');

    // 4. Verify protected routes are blocked after logout
    console.log('4. Verifying protected citizen routes are blocked post-logout...');
    const postDash = await request('GET', '/citizen/dashboard');
    if (postDash.statusCode !== 302 || !postDash.headers.location.includes('/auth/login')) {
      throw new Error('Protected route /citizen/dashboard accessible after logout!');
    }
    const postMyProblems = await request('GET', '/citizen/my-problems');
    if (postMyProblems.statusCode !== 302 || !postMyProblems.headers.location.includes('/auth/login')) {
      throw new Error('Protected route /citizen/my-problems accessible after logout!');
    }
    const postReport = await request('GET', '/citizen/report-problem');
    if (postReport.statusCode !== 302 || !postReport.headers.location.includes('/auth/login')) {
      throw new Error('Protected route /citizen/report-problem accessible after logout!');
    }
    console.log('   [PASS] All protected routes securely block access after logout.');

    // 5. Test GET /auth/logout fallback
    console.log('5. Logging back in to test GET /auth/logout fallback...');
    await request('POST', '/auth/login', `email=${encodeURIComponent(email)}&password=password123`, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    const getLogoutRes = await request('GET', '/auth/logout');
    if (getLogoutRes.statusCode !== 302 || !getLogoutRes.headers.location.includes('/auth/login?loggedOut=true')) {
      throw new Error('GET /auth/logout fallback did not redirect to /auth/login?loggedOut=true');
    }
    console.log('   [PASS] GET /auth/logout fallback works smoothly.');

    // Cleanup
    await User.deleteOne({ email });
    console.log('\n==================================================');
    console.log('ALL LOGOUT TESTS COMPLETED SUCCESSFULLY!');
    console.log('==================================================\n');
  } catch (err) {
    console.error('[TEST FAILURE]', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
};

testLogout();
