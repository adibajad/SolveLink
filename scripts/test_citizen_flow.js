/**
 * Comprehensive Verification Script for SolveLink Final Authenticated Citizen Portal Restructure
 */
const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const app = require('../app');

const runCitizenFlowTests = async () => {
  console.log('=== SOLVELINK CITIZEN PORTAL & NAVIGATION RESTRUCTURE TEST ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solvelink';
  await mongoose.connect(mongoUri);
  console.log('[Database] Connected to MongoDB.');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Server] Test server active on port ${port}\n`);

  // Ensure test citizen user
  let citizen = await User.findOne({ email: 'restructure_citizen@solvelink.org' });
  const hashedPassword = await bcrypt.hash('password123', 10);
  if (!citizen) {
    citizen = await User.create({
      name: 'Aditya Bajad',
      email: 'restructure_citizen@solvelink.org',
      password: hashedPassword,
      role: 'citizen',
      isVerified: true
    });
  } else {
    citizen.password = hashedPassword;
    citizen.name = 'Aditya Bajad';
    await citizen.save();
  }

  // Create test problems
  await Problem.deleteMany({ title: /\[RESTRUCTURE-TEST\]/i });
  const prob1 = await Problem.create({
    title: '[RESTRUCTURE-TEST] Streetlight Blackout on Hinoo Chowk',
    description: 'All 8 sodium-vapor streetlights near Hinoo Chowk have failed causing night hazard.',
    category: 'Infrastructure',
    location: 'Hinoo Chowk, Ranchi, Jharkhand',
    locationText: 'Hinoo Chowk, Ranchi, Jharkhand',
    latitude: 23.3250,
    longitude: 85.3180,
    reportedBy: citizen._id,
    supporters: [citizen._id],
    priority: 'HIGH',
    severity: 'HIGH',
    status: 'COMMUNITY_REVIEW',
    affectedPeople: '51–100 people'
  });

  const prob2 = await Problem.create({
    title: '[RESTRUCTURE-TEST] Water Main Leak on Doranda Bridge',
    description: 'Major leak on water supply line on Doranda Bridge.',
    category: 'Water & Sanitation',
    location: 'Doranda, Ranchi, Jharkhand',
    locationText: 'Doranda, Ranchi, Jharkhand',
    latitude: 23.3400,
    longitude: 85.3200,
    reportedBy: citizen._id,
    supporters: [citizen._id],
    priority: 'MEDIUM',
    severity: 'MEDIUM',
    status: 'REPORTED',
    affectedPeople: '11–50 people'
  });

  // Create test challenge
  await Challenge.deleteMany({ title: /\[RESTRUCTURE-TEST\]/i });
  const chal1 = await Challenge.create({
    title: '[RESTRUCTURE-TEST] Smart IoT Grid Sensor for Hinoo Water Pipelines',
    description: 'Deploy ultrasonic flowmeters to detect burst pipes before municipal water is wasted.',
    category: 'Water & Sanitation',
    location: 'Ranchi Municipal Corporation',
    department: 'Water Works Dept',
    requiredSkills: ['IoT', 'Embedded Systems', 'Data Analytics'],
    constraints: ['Low cost', 'Battery operated 2 years'],
    expectedOutcome: 'Working telemetry node',
    deadline: new Date(Date.now() + 20 * 86400000),
    status: 'PUBLISHED',
    sourceProblem: prob2._id,
    createdBy: citizen._id
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
    // 1. Test Public Homepage & Top Navbar
    console.log('1. Testing Public Homepage & Navbar Architecture...');
    const publicHome = await request('GET', '/');
    if (publicHome.statusCode !== 200) throw new Error('Public Homepage failed to load');
    if (!publicHome.body.includes('Home') || !publicHome.body.includes('About') || !publicHome.body.includes('Resources')) {
      throw new Error('Public navbar missing Home / About / Resources');
    }
    if (!publicHome.body.includes('Login') || !publicHome.body.includes('Get Started')) {
      throw new Error('Public navbar missing Login / Get Started buttons');
    }
    // Verify Problems & Challenges removed from navbar
    const navbarBlockMatch = publicHome.body.match(/<ul class="navbar-nav">([\s\S]*?)<\/ul>/);
    if (navbarBlockMatch && (navbarBlockMatch[1].includes('/problems') || navbarBlockMatch[1].includes('/challenges'))) {
      throw new Error('Problems or Challenges link found in top navbar! Must be sidebar-only.');
    }
    console.log('   [PASS] Public Navbar clean: Home, About, Resources, Search, Login, Get Started (No duplicated Problems/Challenges in top bar).');

    // 2. Test Unauthenticated Protected Route Access
    console.log('2. Testing Protection on /citizen/dashboard...');
    const unauthDash = await request('GET', '/citizen/dashboard');
    if (unauthDash.statusCode !== 302 || !unauthDash.headers.location.includes('/auth/login')) {
      throw new Error('Unauthenticated access to /citizen/dashboard was not redirected');
    }
    console.log('   [PASS] Unauthenticated access blocked and redirected to /auth/login.');

    // 3. Citizen Login
    console.log('3. Performing Citizen Login...');
    const loginRes = await request('POST', '/auth/login', `email=${encodeURIComponent('restructure_citizen@solvelink.org')}&password=password123`, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    if (loginRes.statusCode !== 302) throw new Error(`Login failed with status ${loginRes.statusCode}`);
    console.log('   [PASS] Logged in successfully. Session cookie received.');

    // 4. Test Dashboard Dispatcher
    console.log('4. Testing /dashboard Route Dispatcher...');
    const dashDispatch = await request('GET', '/dashboard');
    if (dashDispatch.statusCode !== 302 || !dashDispatch.headers.location.includes('/citizen/dashboard')) {
      throw new Error('Dashboard dispatcher did not redirect citizen to /citizen/dashboard');
    }
    console.log('   [PASS] /dashboard redirects to /citizen/dashboard.');

    // 5. Test Citizen Dashboard & Authenticated Top Navbar & Sidebar
    console.log('5. Testing Citizen Dashboard Shell...');
    const citizenDash = await request('GET', '/citizen/dashboard');
    if (citizenDash.statusCode !== 200) throw new Error('Citizen Dashboard failed to load');
    if (!citizenDash.body.includes('Dashboard') || !citizenDash.body.includes('Logout')) {
      throw new Error('Authenticated navbar missing Dashboard / Logout');
    }
    if (citizenDash.body.includes('Get Started')) {
      throw new Error('Get Started shown to authenticated user');
    }
    // Verify Citizen Portal Sidebar structure
    if (!citizenDash.body.includes('dashboardSidebar') || !citizenDash.body.includes('CITIZEN PORTAL')) {
      throw new Error('Citizen Dashboard missing Citizen Portal Sidebar');
    }
    if (!citizenDash.body.includes('Overview') || !citizenDash.body.includes('Report a Problem') || !citizenDash.body.includes('Community Problems') || !citizenDash.body.includes('My Reported Problems') || !citizenDash.body.includes('Explore Challenges')) {
      throw new Error('Citizen Sidebar missing required navigation items');
    }
    if (!citizenDash.body.includes('Aditya Bajad')) {
      throw new Error('Citizen Sidebar footer missing authenticated user name (Aditya Bajad)');
    }
    console.log('   [PASS] Citizen Dashboard rendered with unified Sidebar, User Profile, and Authenticated Top Navbar.');

    // 6. Test Authenticated Community Problems Page with Sidebar
    console.log('6. Testing Authenticated Community Problems (/problems)...');
    const commProblems = await request('GET', '/problems');
    if (commProblems.statusCode !== 200) throw new Error('Community Problems failed to load');
    if (!commProblems.body.includes('dashboardSidebar') || !commProblems.body.includes('Community Problems')) {
      throw new Error('Community Problems page missing Citizen Portal Sidebar');
    }
    if (!commProblems.body.includes('btn-card-support')) {
      throw new Error('Community Problems page missing 1-click card upvote buttons');
    }
    console.log('   [PASS] Community Problems page rendered inside authenticated Citizen Portal shell with Sidebar.');

    // 7. Test 1-Click Card Upvote Support API
    console.log('7. Testing 1-Click Upvote API on Problem Card...');
    const supportRes = await request('POST', `/problems/${prob1._id}/support`, {}, { 'Accept': 'application/json' });
    const supportData = JSON.parse(supportRes.body);
    if (!supportData.success) throw new Error('Support action failed');
    console.log(`   [PASS] Upvote response: isSupported=${supportData.isSupported}, count=${supportData.supporterCount}`);

    // 8. Test Authenticated Explore Challenges Page (3-Column Grid, Summary Stats & Sidebar)
    console.log('8. Testing Authenticated Explore Challenges (/challenges)...');
    const challengesRes = await request('GET', '/challenges');
    if (challengesRes.statusCode !== 200) throw new Error('Challenges page failed to load');
    if (!challengesRes.body.includes('dashboardSidebar')) throw new Error('Challenges page missing Citizen Sidebar');
    if (!challengesRes.body.includes('challenges-grid-3col')) throw new Error('Challenges page missing 3-column card grid');
    if (!challengesRes.body.includes('challenges-stats-grid')) throw new Error('Challenges page missing summary statistics row');
    if (!challengesRes.body.includes('Active Challenges') || !challengesRes.body.includes('Open for Solutions')) throw new Error('Challenges stats missing key metrics');
    console.log('   [PASS] Explore Challenges rendered inside Citizen Portal shell with 3-column card grid, statistics summary, and filters.');

    // 9. Test Authenticated Challenge Detail Page with Two-Column Hero, Metadata Bar & Lifecycle
    console.log('9. Testing Challenge Detail Page (/challenges/:id)...');
    const chalDetailRes = await request('GET', `/challenges/${chal1._id}`);
    if (chalDetailRes.statusCode !== 200) throw new Error('Challenge Detail failed to load');
    if (!chalDetailRes.body.includes('dashboardSidebar')) throw new Error('Challenge Detail missing Citizen Sidebar');
    if (!chalDetailRes.body.includes('challenge-detail-hero-2col')) throw new Error('Challenge Detail missing 2-column hero section');
    if (!chalDetailRes.body.includes('challenge-meta-grid')) throw new Error('Challenge Detail missing horizontal metadata bar');
    if (!chalDetailRes.body.includes('challenge-detail-2col')) throw new Error('Challenge Detail missing 2-column content layout');
    if (!chalDetailRes.body.includes('challenge-sticky-card')) throw new Error('Challenge Detail missing sticky overview card');
    if (!chalDetailRes.body.includes('challenge-lifecycle-track')) throw new Error('Challenge Detail missing lifecycle tracker');
    if (!chalDetailRes.body.includes('About This Challenge') || !chalDetailRes.body.includes('What Needs to Be Solved')) throw new Error('Challenge Detail missing structured problem sections');
    if (!chalDetailRes.body.includes('related-challenges-section')) throw new Error('Challenge Detail missing related challenges section');
    console.log('   [PASS] Challenge Detail rendered with 2-col hero, horizontal metadata, lifecycle timeline, sticky overview, and related challenges.');

    // 10. Test My Reported Problems Page
    console.log('10. Testing My Reported Problems (/citizen/my-problems)...');
    const myProblemsRes = await request('GET', '/citizen/my-problems');
    if (myProblemsRes.statusCode !== 200) throw new Error('My Reported Problems failed to load');
    if (!myProblemsRes.body.includes('dashboardSidebar') || !myProblemsRes.body.includes('Streetlight Blackout on Hinoo Chowk')) {
      throw new Error('My Reported Problems missing Sidebar or citizen problem reports');
    }
    console.log('   [PASS] My Reported Problems rendered inside Citizen Portal shell.');

    // 11. Test Report a Problem Page
    console.log('11. Testing Report a Problem (/citizen/report-problem)...');
    const reportProbRes = await request('GET', '/citizen/report-problem');
    if (reportProbRes.statusCode !== 200) throw new Error('Report Problem page failed to load');
    if (!reportProbRes.body.includes('dashboardSidebar') || !reportProbRes.body.includes('Report a Civic Problem')) {
      throw new Error('Report Problem page missing Citizen Sidebar');
    }
    console.log('   [PASS] Report Problem rendered inside Citizen Portal shell.');

    // 12. Test Problem Detail Page with Sidebar & Life-cycle Tracker
    console.log('12. Testing Problem Detail Page (/problems/:id)...');
    const probDetailRes = await request('GET', `/problems/${prob1._id}`);
    if (probDetailRes.statusCode !== 200) throw new Error('Problem Detail failed to load');
    if (!probDetailRes.body.includes('dashboardSidebar') || !probDetailRes.body.includes('SolveLink AI Analysis')) {
      throw new Error('Problem Detail missing Citizen Sidebar or AI Analysis');
    }
    console.log('   [PASS] Problem Detail rendered inside authenticated Citizen Portal shell with Sidebar.');

    // 13. Test Logout Flow & Confirmation Modal (POST & GET)
    console.log('13. Testing Logout Flow & Confirmation Modal...');
    if (!citizenDash.body.includes('logoutConfirmModal')) {
      throw new Error('Logout confirmation modal not present in navbar');
    }
    if (!citizenDash.body.includes('logoutConfirmForm') || !citizenDash.body.includes('btnConfirmLogout')) {
      throw new Error('Logout confirmation form or button missing in navbar');
    }
    const logoutRes = await request('POST', '/auth/logout');
    if (logoutRes.statusCode !== 302 || !logoutRes.headers.location.includes('/auth/login?loggedOut=true')) {
      throw new Error('POST /auth/logout did not destroy session and redirect to /auth/login?loggedOut=true');
    }
    console.log('   [PASS] POST /auth/logout destroyed session and redirected to login with loggedOut=true.');

    // 14. Test Access Blocked After Logout
    console.log('14. Testing Protected Access Post-Logout...');
    const postLogoutDash = await request('GET', '/citizen/dashboard');
    if (postLogoutDash.statusCode !== 302 || !postLogoutDash.headers.location.includes('/auth/login')) {
      throw new Error('Post-logout access to dashboard was not redirected');
    }
    console.log('   [PASS] Post-logout access blocked successfully.');

    // Cleanup
    await Problem.deleteMany({ title: /\[RESTRUCTURE-TEST\]/i });
    await Challenge.deleteMany({ title: /\[RESTRUCTURE-TEST\]/i });
    await User.deleteOne({ email: 'restructure_citizen@solvelink.org' });

    console.log('\n==================================================');
    console.log('ALL CITIZEN PORTAL RESTRUCTURE TESTS PASSED (14/14)!');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n[TEST FAILURE]', err);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
};

runCitizenFlowTests();
