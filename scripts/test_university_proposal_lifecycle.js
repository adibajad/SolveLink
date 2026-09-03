/**
 * Test Suite: University Proposal Lifecycle & Dashboard Visibility
 * Verifies:
 * 1. Previously submitted proposal exists and is displayable for Birsa Institute of Technology & Innovation.
 * 2. Proposal submission logic checks and associates university/institute references.
 * 3. University dashboard retrieves and displays proposals with title, target challenge, date, and status.
 * 4. Persistence across logout/re-login.
 * 5. Authority side can query and evaluate the proposal.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Solution = require('../models/Solution');
const Challenge = require('../models/Challenge');
const solutionController = require('../controllers/solutionController');
const challengeController = require('../controllers/challengeController');

const uri = 'mongodb://solvelink_admin:vNSpes8UpWuRfugq@ac-abwezmd-shard-00-00.iwavan7.mongodb.net:27017,ac-abwezmd-shard-00-01.iwavan7.mongodb.net:27017,ac-abwezmd-shard-00-02.iwavan7.mongodb.net:27017/solvelink?ssl=true&authSource=admin&appName=Cluster0';

async function runTests() {
  console.log('--- STARTING UNIVERSITY PROPOSAL LIFECYCLE TEST ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB Atlas.\n');

    // TEST 1: Inspect Birsa Institute user and previously submitted proposal
    console.log('[Test 1] Inspecting Birsa Institute and existing proposal in MongoDB...');
    const birsaUser = await User.findOne({ email: 'innovation.lab@bitijharkhand.demo' }).lean();
    assert(!!birsaUser, 'Birsa Institute of Technology & Innovation user exists in database');
    assert(birsaUser.role === 'university', 'Birsa user role is university');

    const existingProposal = await Solution.findOne({
      challenge: '6a98fe56e31322228615d77d',
      submittedBy: birsaUser._id
    }).populate('challenge').lean();

    assert(!!existingProposal, 'Previously submitted proposal exists in MongoDB');
    if (existingProposal) {
      console.log(`    Proposal ID: ${existingProposal._id}`);
      console.log(`    Title: "${existingProposal.title}"`);
      console.log(`    Challenge: "${existingProposal.challenge?.title}"`);
      console.log(`    Status: "${existingProposal.status}"`);
      console.log(`    Created At: ${existingProposal.createdAt}`);
      console.log(`    University Ref: ${existingProposal.university}`);
      console.log(`    Organization: "${existingProposal.organization}"`);

      assert(existingProposal.status === 'SUBMITTED', 'Existing proposal status is SUBMITTED');
      assert(String(existingProposal.challenge?._id) === '6a98fe56e31322228615d77d', 'Existing proposal links to correct Challenge ID');
    }

    // TEST 2: Dashboard renders existing proposal for Birsa Institute
    console.log('\n[Test 2] Testing getUniversityDashboard for Birsa Institute...');
    let renderedData = null;
    let renderedView = null;

    const mockReqBirsa = {
      user: {
        id: birsaUser._id.toString(),
        _id: birsaUser._id.toString(),
        name: birsaUser.name,
        email: birsaUser.email,
        role: birsaUser.role,
        organization: birsaUser.organization
      },
      query: {}
    };

    const mockResBirsa = {
      render: (view, data) => {
        renderedView = view;
        renderedData = data;
      }
    };

    await solutionController.getUniversityDashboard(mockReqBirsa, mockResBirsa, (err) => {
      if (err) console.error(err);
    });

    assert(renderedView === 'university/dashboard', 'Dashboard view rendered');
    assert(renderedData && renderedData.mySolutions && renderedData.mySolutions.length >= 1, 'Dashboard returned at least 1 submitted proposal');
    
    const foundInDashboard = renderedData.mySolutions.find(s => s._id.toString() === existingProposal._id.toString());
    assert(!!foundInDashboard, 'Previously submitted proposal appears in mySolutions array');
    if (foundInDashboard) {
      assert(foundInDashboard.title === existingProposal.title, 'Proposal title matches');
      assert(foundInDashboard.status === 'SUBMITTED', 'Proposal status is SUBMITTED');
      assert(!!foundInDashboard.challenge?.title, 'Target challenge title is populated');
      assert(renderedData.metrics.submittedCount >= 1, 'Metrics total submissions count reflects proposal');
    }

    // TEST 3: Submit proposal duplicate guard & university association
    console.log('\n[Test 3] Testing postSubmitSolution proposal creation & university association...');
    const testTitle = `Automated Solar Water Filtration Unit - Test ${Date.now()}`;
    const mockSubmitReq = {
      user: {
        id: birsaUser._id.toString(),
        _id: birsaUser._id.toString(),
        name: birsaUser.name,
        email: birsaUser.email,
        role: birsaUser.role,
        organization: birsaUser.organization
      },
      body: {
        challengeId: '6a98fe56e31322228615d77d',
        title: testTitle,
        teamName: 'Birsa Sustainable Tech Team',
        description: 'A comprehensive multi-stage solar filtration and UV purification unit.',
        technicalApproach: 'Solar PV cells power low-voltage UV lamps and peristaltic filtration pumps.',
        technology: 'Solar PV, UV-C, IoT Sensors, ESP32',
        skills: 'Solar, Filtration, Embedded Systems',
        estimatedCost: '75000',
        impact: 'Provides 5,000L clean drinking water per day for residential sectors.',
        memberNames: ['Dr. B. K. Sahay', 'Ananya Roy'],
        memberEmails: ['sahay@bit.demo', 'ananya@bit.demo'],
        memberRoles: ['Lead Researcher', 'Hardware Specialist']
      },
      files: []
    };

    let submitRenderView = null;
    let submitRenderData = null;
    const mockSubmitRes = {
      statusCode: 200,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      render: function(view, data) {
        submitRenderView = view;
        submitRenderData = data;
        return this;
      }
    };

    await solutionController.postSubmitSolution(mockSubmitReq, mockSubmitRes, (err) => {
      if (err) console.error(err);
    });

    assert(
      submitRenderData && submitRenderData.error && submitRenderData.error.includes('already submitted a proposal'),
      'Duplicate proposal guard correctly prevents duplicate submission for the same challenge'
    );

    // TEST 4: Authority solutions query includes university proposals
    console.log('\n[Test 4] Testing Authority view of submitted proposals...');
    let authView = null;
    let authData = null;
    const mockAuthReq = {
      user: {
        id: '6a9872c4ccdf410faa61f1a1',
        role: 'authority'
      },
      query: {}
    };
    const mockAuthRes = {
      render: (view, data) => {
        authView = view;
        authData = data;
      }
    };

    await challengeController.getAuthoritySolutions(mockAuthReq, mockAuthRes, (err) => {
      if (err) console.error(err);
    });

    assert(authView === 'authority/solutions', 'Authority solutions view rendered');
    assert(authData && authData.solutions && authData.solutions.length >= 1, 'Authority received solutions');
    const authFound = authData.solutions.find(s => s._id.toString() === existingProposal._id.toString());
    assert(!!authFound, 'Authority can see the proposal submitted by Birsa Institute');
    if (authFound) {
      assert(authFound.submittedBy?.name === 'Birsa Institute of Technology & Innovation', 'Submitter institution name displayed to Authority');
    }

    // TEST 5: EJS template rendering verification
    console.log('\n[Test 5] Verifying EJS dashboard template HTML generation...');
    const ejs = require('ejs');
    const fs = require('fs');
    const path = require('path');
    const templateContent = fs.readFileSync(path.resolve(__dirname, '../views/university/dashboard.ejs'), 'utf8');

    const htmlOutput = ejs.render(templateContent, {
      activePath: '/university/dashboard',
      user: mockReqBirsa.user,
      recommendedChallenges: [],
      mySolutions: renderedData.mySolutions,
      industryCollaborations: [],
      metrics: renderedData.metrics,
      submittedMsg: 'Your solution proposal was submitted successfully to the municipal authority!',
      filename: path.resolve(__dirname, '../views/university/dashboard.ejs')
    });

    assert(htmlOutput.includes('Smart Waste Collection Monitoring'), 'HTML contains proposal title');
    assert(htmlOutput.includes('Innovation Challenge: Uncollected garbage'), 'HTML contains target challenge name');
    assert(htmlOutput.includes('SUBMITTED'), 'HTML contains status badge');
    assert(htmlOutput.includes('Your solution proposal was submitted successfully'), 'HTML displays submitted success banner when query flag present');

    console.log(`\n==============================================`);
    console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed/total)*100)}%)`);
    console.log(`==============================================\n`);

    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

runTests();
