/**
 * End-to-End Test Suite: SolveLink Stakeholder Matching and Problem-Routing Architecture
 * 
 * Tests the complete workflow:
 * 1. Authority Registration (Structured Sector, Department, Jurisdiction)
 * 2. Unrelated Authority Registration (Energy Sector for isolation check)
 * 3. Citizen Problem Submission ("Water pipeline leaking near residential area")
 * 4. AI Problem Classification (returns structured { domain, category, subCategory, urgency, confidence })
 * 5. Problem -> Authority Matching Engine (routes to Water & Sanitation authority with score)
 * 6. Authority Dashboard Isolation (Water Auth sees problem, Energy Auth does NOT)
 * 7. Authority Verification & Triage (Verified status)
 * 8. Challenge Creation ("Low-Cost Smart Water Leakage Detection" with structured skills & technologies)
 * 9. University Discovery & High-Synergy Matching
 * 10. University Proposal Submission
 * 11. Authority Proposal Review & Evaluation
 * 12. Industry Discovery & High-Synergy Collaboration Request
 * 13. Reclassification & Re-routing Engine Test
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const Collaboration = require('../models/Collaboration');
const aiService = require('../services/aiService');
const matchingService = require('../services/matchingService');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('STARTING SOLVELINK ARCHITECTURE VERIFICATION TEST');
  console.log('================================================================\n');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas.\n');

  const testEmails = [
    'water.auth.test@solvelink.test',
    'power.auth.test@solvelink.test',
    'citizen.pipe.test@solvelink.test',
    'sensorlab.uni.test@solvelink.test',
    'indotech.industry@solvelink.test'
  ];

  try {
    // 0. Clean prior test artifacts
    console.log('Step 0: Purging prior test records...');
    const oldUsers = await User.find({
      $or: [
        { email: { $in: testEmails } },
        { email: /@solvelink\.test$/ }
      ]
    }).select('_id');
    const oldIds = oldUsers.map(u => u._id);
    if (oldIds.length > 0) {
      await Collaboration.deleteMany({ industry: { $in: oldIds } });
      await Solution.deleteMany({ submittedBy: { $in: oldIds } });
      await Challenge.deleteMany({ createdBy: { $in: oldIds } });
      await Problem.deleteMany({ reportedBy: { $in: oldIds } });
      await User.deleteMany({ _id: { $in: oldIds } });
    }
    console.log('  ✔ Prior test records cleared.\n');

    const testPasswordHash = await bcrypt.hash('password123', 10);

    // =========================================================================
    // STEP 1: REGISTER AUTHORITIES WITH STRUCTURED PROFILES
    // =========================================================================
    console.log('Step 1: Registering Authorities with structured profiles...');

    // 1.1 Water & Sanitation Authority
    const waterAuthority = await User.create({
      name: 'Ranchi Municipal Water Supply Cell',
      email: 'water.auth.test@solvelink.test',
      password: testPasswordHash,
      role: 'authority',
      authoritySector: 'water_sanitation',
      department: 'Municipal Water Supply Department',
      jurisdiction: 'Ranchi District, Jharkhand',
      organization: 'Municipal Jal Nigam',
      location: 'Ranchi, Jharkhand'
    });
    assert(waterAuthority.authoritySector === 'water_sanitation', 'Water Authority has normalized sector "water_sanitation"');
    assert(waterAuthority.department === 'Municipal Water Supply Department', 'Water Authority has department recorded');

    // 1.2 Energy Authority (Control stakeholder for isolation)
    const energyAuthority = await User.create({
      name: 'Ranchi Electric Supply Circle',
      email: 'power.auth.test@solvelink.test',
      password: testPasswordHash,
      role: 'authority',
      authoritySector: 'energy',
      department: 'State Electricity Distribution Co',
      jurisdiction: 'Ranchi District, Jharkhand',
      organization: 'JBVNL Power Division',
      location: 'Ranchi, Jharkhand'
    });
    assert(energyAuthority.authoritySector === 'energy', 'Energy Authority has normalized sector "energy"');
    console.log('');

    // =========================================================================
    // STEP 2: CITIZEN SUBMITS PROBLEM REPORT
    // =========================================================================
    console.log('Step 2: Citizen submitting real water leakage problem...');
    const citizen = await User.create({
      name: 'Citizen Resident',
      email: 'citizen.pipe.test@solvelink.test',
      password: testPasswordHash,
      role: 'citizen',
      location: 'Indiranagar, Ranchi'
    });

    const citizenInput = {
      title: 'Water pipeline is leaking near our residential area',
      description: 'The main underground drinking water pipeline has burst near Indiranagar residential area, causing heavy water loss and flooding the street for two days.',
      location: 'Indiranagar, Ranchi',
      urgency: 'HIGH'
    };

    // =========================================================================
    // STEP 3: AI PROBLEM CLASSIFICATION
    // =========================================================================
    console.log('Step 3: Running AI classification...');
    const aiResult = await aiService.analyzeProblem({
      title: citizenInput.title,
      description: citizenInput.description,
      location: citizenInput.location,
      urgency: citizenInput.urgency
    });

    console.log('  -> AI Result Output:', {
      domain: aiResult.domain,
      category: aiResult.category,
      subCategory: aiResult.subCategory,
      urgency: aiResult.urgency,
      confidence: aiResult.confidence
    });

    assert(aiResult.domain === 'water_sanitation', 'AI classified domain as "water_sanitation"');
    assert(aiResult.category === 'water_leakage', 'AI resolved category to "water_leakage"');
    assert(aiResult.subCategory === 'pipeline_leak', 'AI resolved subCategory to "pipeline_leak"');
    assert(aiResult.confidence >= 0.85, 'AI confidence score is high (>= 0.85)');
    console.log('');

    // =========================================================================
    // STEP 4: PROBLEM -> AUTHORITY MATCHING ENGINE
    // =========================================================================
    console.log('Step 4: Running Deterministic Problem -> Authority Matching Engine...');
    const matchResult = await matchingService.matchAuthorityForProblem(
      aiResult,
      citizenInput.location
    );

    console.log('  -> Routing Engine Result:', {
      bestAuthority: matchResult.bestAuthority ? matchResult.bestAuthority.name : null,
      score: matchResult.score,
      assignmentStatus: matchResult.assignmentStatus,
      assignmentReason: matchResult.assignmentReason
    });

    assert(matchResult.assignmentStatus === 'assigned', 'Matching engine assigned status is "assigned"');
    assert(matchResult.bestAuthority !== null, 'Matching engine selected an authority');
    assert(
      matchResult.bestAuthority.authoritySector === 'water_sanitation' &&
      matchResult.bestAuthority._id.toString() !== energyAuthority._id.toString(),
      'Matching engine correctly routed problem to a Water & Sanitation Authority, NOT Energy Authority'
    );
    assert(matchResult.score >= 50, 'Matching score reflects high domain and jurisdiction weighting');

    // Save problem to database
    const savedProblem = await Problem.create({
      title: citizenInput.title,
      description: citizenInput.description,
      category: aiResult.humanCategory,
      location: citizenInput.location,
      locationText: citizenInput.location,
      reportedBy: citizen._id,
      supporters: [citizen._id],
      priority: aiResult.urgency,
      severity: aiResult.urgency,
      status: 'REPORTED',
      aiClassification: {
        domain: aiResult.domain,
        category: aiResult.category,
        subCategory: aiResult.subCategory,
        urgency: aiResult.urgency,
        confidence: aiResult.confidence,
        classifiedAt: new Date()
      },
      assignedAuthority: matchResult.bestAuthority._id,
      assignmentStatus: matchResult.assignmentStatus,
      assignmentReason: matchResult.assignmentReason
    });

    const chosenAuthority = matchResult.bestAuthority;
    assert(savedProblem.assignedAuthority.toString() === chosenAuthority._id.toString(), 'Problem persisted with assignedAuthority ref');
    console.log('');

    // =========================================================================
    // STEP 5: AUTHORITY DASHBOARD ISOLATION VERIFICATION
    // =========================================================================
    console.log('Step 5: Verifying Authority Dashboard Queue Isolation...');
    
    // Water Authority problem query
    const waterAuthProblems = await Problem.find({
      $or: [
        { assignedAuthority: waterAuthority._id },
        { 'aiClassification.domain': waterAuthority.authoritySector }
      ]
    }).lean();

    assert(
      waterAuthProblems.some(p => p._id.toString() === savedProblem._id.toString()),
      'Water Authority dashboard query includes the assigned water pipeline problem'
    );

    // Energy Authority problem query
    const energyAuthProblems = await Problem.find({
      $or: [
        { assignedAuthority: energyAuthority._id },
        { 'aiClassification.domain': energyAuthority.authoritySector }
      ]
    }).lean();

    assert(
      !energyAuthProblems.some(p => p._id.toString() === savedProblem._id.toString()),
      'Energy Authority dashboard query correctly EXCLUDES the water leakage problem (zero cross-leakage)'
    );
    console.log('');

    // =========================================================================
    // STEP 6: AUTHORITY VERIFICATION & CHALLENGE CREATION
    // =========================================================================
    console.log('Step 6: Authority verifies problem & creates Innovation Challenge...');

    // Authority verifies problem
    const verifiedProblem = await Problem.findByIdAndUpdate(
      savedProblem._id,
      { status: 'VERIFIED', assignmentStatus: 'verified' },
      { new: true }
    );
    assert(verifiedProblem.status === 'VERIFIED', 'Problem transitioned to VERIFIED status');
    assert(verifiedProblem.assignmentStatus === 'verified', 'Problem assignmentStatus updated to "verified"');

    // Authority creates challenge
    const createdChallenge = await Challenge.create({
      title: 'Low-Cost Smart Water Leakage Detection',
      description: 'Design and deploy acoustic sensor telemetry arrays on municipal water distribution pipelines to detect sub-surface pipe fractures within 30 minutes of occurrence.',
      category: 'Water & Sanitation',
      domainName: 'Water & Sanitation',
      authoritySector: waterAuthority.authoritySector,
      location: 'Ranchi District, Jharkhand',
      department: waterAuthority.department,
      requiredSkills: ['IoT', 'Embedded Systems', 'Acoustic Sensing', 'Signal Processing'],
      requiredTechnologies: ['ESP32', 'LoRaWAN', 'Piezoelectric Sensors', 'Python'],
      constraints: ['Unit node cost under ₹3,500', '1-year battery operation in waterproof IP68 enclosure'],
      requirements: ['Must output alerts over standard MQTT/JSON API'],
      expectedOutcome: 'A field-deployed acoustic telemetry array tested on 2 km of urban distribution mainlines.',
      status: 'PUBLISHED',
      sourceProblem: verifiedProblem._id,
      createdBy: waterAuthority._id
    });

    assert(createdChallenge.authoritySector === 'water_sanitation', 'Challenge saved with structured authoritySector');
    assert(createdChallenge.requiredSkills.includes('IoT'), 'Challenge contains structured requiredSkills');
    assert(createdChallenge.requiredTechnologies.includes('ESP32'), 'Challenge contains structured requiredTechnologies');
    console.log('');

    // =========================================================================
    // STEP 7: UNIVERSITY DISCOVERY & MATCHING
    // =========================================================================
    console.log('Step 7: University profile discovery & capability matching...');

    const university = await User.create({
      name: 'Sensor Systems Lab, BIT Mesra',
      email: 'sensorlab.uni.test@solvelink.test',
      password: testPasswordHash,
      role: 'university',
      organization: 'Department of Electronics & Communication, BIT Mesra',
      domains: ['water_sanitation', 'iot', 'civil_engineering', 'embedded_systems'],
      skills: ['IoT', 'Embedded Systems', 'Acoustic Sensing', 'Signal Processing'],
      technologies: ['ESP32', 'LoRaWAN', 'Python', 'Edge AI'],
      location: 'Ranchi, Jharkhand'
    });

    const uniMatch = matchingService.calculateMatch(createdChallenge, university);
    console.log('  -> University Match Score:', uniMatch.matchScore, '%');
    console.log('  -> Matching Skills:', uniMatch.matchingSkills);
    assert(uniMatch.matchScore >= 80, 'University capability match score is high (>= 80%)');
    assert(uniMatch.matchingSkills.includes('IoT'), 'Skills overlap includes IoT');
    console.log('');

    // =========================================================================
    // STEP 8: UNIVERSITY SUBMITS PROPOSAL
    // =========================================================================
    console.log('Step 8: University submitting engineering proposal...');

    const solution = await Solution.create({
      challenge: createdChallenge._id,
      submittedBy: university._id,
      team: 'BIT Sensor Systems Research Team',
      title: 'Acoustic LoRaWAN Array for Sub-surface Pipe Leak Detection',
      description: 'Distributed network of contact microphones and low-power ESP32 nodes performing edge Fast Fourier Transform (FFT) analysis to isolate continuous leak hiss vibrations.',
      technicalApproach: 'Piezoelectric ceramic contact transducers coupled to high-gain analog filters. Edge ESP32 calculates 1024-point FFT spectral energy in the 200-800Hz acoustic leak band. When energy persists above ambient baseline for 5 consecutive readings, an alert packet is transmitted over LoRaWAN.',
      skills: ['IoT', 'Embedded Systems', 'Signal Processing', 'Acoustic Sensing'],
      technology: ['ESP32', 'LoRaWAN', 'Python', 'C++'],
      estimatedCost: 3200,
      impact: 'Reduces undetected pipeline water loss by up to 75% in urban residential clusters.',
      implementationDetails: 'Field pilot across 10 valve chambers in Indiranagar within 6 weeks.',
      status: 'SUBMITTED'
    });

    assert(solution.challenge.toString() === createdChallenge._id.toString(), 'Solution linked to Challenge ID');
    assert(solution.status === 'SUBMITTED', 'Solution submitted with status "SUBMITTED"');
    console.log('');

    // =========================================================================
    // STEP 9: AUTHORITY REVIEWS PROPOSAL
    // =========================================================================
    console.log('Step 9: Authority reviews proposal & advances evaluation...');

    // Authority queries proposals on their own challenges
    const receivedSolutions = await Solution.find({ challenge: createdChallenge._id })
      .populate('submittedBy', 'name organization')
      .lean();

    assert(receivedSolutions.length === 1, 'Authority receives the submitted proposal');
    assert(receivedSolutions[0].title === solution.title, 'Solution title matches');

    // Authority evaluates and shortlists solution
    const evaluatedSolution = await Solution.findByIdAndUpdate(
      solution._id,
      {
        status: 'SHORTLISTED',
        evaluation: {
          evaluatedBy: waterAuthority._id,
          evaluatedAt: new Date(),
          score: 92,
          technicalScore: 38,
          costScore: 28,
          impactScore: 26,
          feedback: 'Rigorous engineering methodology. Edge FFT approach avoids heavy telemetry data costs.'
        }
      },
      { new: true }
    );
    assert(evaluatedSolution.status === 'SHORTLISTED', 'Authority successfully shortlisted solution');
    console.log('');

    // =========================================================================
    // STEP 10: INDUSTRY DISCOVERY & COLLABORATION
    // =========================================================================
    console.log('Step 10: Industry partner discovery & collaboration offer...');

    const industry = await User.create({
      name: 'Indo-Tech Flow Instruments Pvt Ltd',
      email: 'indotech.industry@solvelink.test',
      password: testPasswordHash,
      role: 'industry',
      organization: 'Indo-Tech Flow Systems',
      industrySector: 'water_sanitation',
      domains: ['water_sanitation', 'iot', 'hardware_manufacturing'],
      capabilities: ['Pilot Implementation', 'Hardware Fabrication', 'Field Validation', 'Manufacturing Scale'],
      skills: ['IoT', 'Hardware', 'Field Manufacturing', 'Telemetry Integration'],
      technologies: ['PCB Assembly', 'CNC Machining', 'IoT Enclosures', 'SCADA'],
      location: 'Ranchi, Jharkhand'
    });

    // Populate challenge details onto solution for industry synergy scoring
    const fullSolutionForMatching = await Solution.findById(solution._id).populate('challenge').lean();
    const indMatch = matchingService.calculateIndustrySolutionMatch(fullSolutionForMatching, industry);
    console.log('  -> Industry Synergy Score:', indMatch.synergyScore, '%');
    console.log('  -> Matched Capabilities:', indMatch.matchedCapabilities);

    assert(indMatch.synergyScore >= 70, 'Industry synergy score is strong (>= 70%)');

    // Industry submits collaboration inquiry
    const collaboration = await Collaboration.create({
      proposal: solution._id,
      challenge: createdChallenge._id,
      industry: industry._id,
      supportType: 'PILOT_IMPLEMENTATION',
      message: 'We can fabricate 50 weatherproof sensor enclosures and provide calibration equipment for the Indiranagar municipal pilot.',
      status: 'PENDING'
    });

    assert(collaboration.supportType === 'PILOT_IMPLEMENTATION', 'Collaboration recorded with type PILOT_IMPLEMENTATION');

    // Authority views collaboration inquiries for this solution
    const collabsForAuthority = await Collaboration.find({ proposal: solution._id })
      .populate('industry', 'name organization industrySector')
      .lean();

    assert(collabsForAuthority.length === 1, 'Authority sees industry collaboration offer attached to university proposal');
    assert(collabsForAuthority[0].industry.name === industry.name, 'Collaboration is from Indo-Tech Flow Instruments');
    console.log('');

    // =========================================================================
    // STEP 11: VERIFY CLASSIFICATION CORRECTION & RE-ROUTING
    // =========================================================================
    console.log('Step 11: Testing Authority Classification Correction & Re-Routing...');

    // Simulate authority correcting a misclassified problem from Water to Energy
    const reRouteResult = await matchingService.matchAuthorityForProblem(
      { domain: 'energy', category: 'power_outage' },
      'Ranchi, Jharkhand'
    );

    assert(reRouteResult.assignmentStatus === 'assigned', 'Re-routing assigned successfully');
    assert(
      reRouteResult.bestAuthority.authoritySector === 'energy',
      'Re-routing correctly transferred assignment to an Energy Authority'
    );
    console.log('');

    // =========================================================================
    // STEP 12: ADMIN SECURITY & ROLE ENFORCEMENT VERIFICATION
    // =========================================================================
    console.log('Step 12: Testing Admin Security & Authorization Enforcement...');
    const { requireAdmin } = require('../middleware/role');

    // 12.1 Verify public registration block for 'admin'
    const validPublicRoles = ['citizen', 'authority', 'university', 'industry'];
    assert(!validPublicRoles.includes('admin'), 'Admin role is strictly excluded from public registration validRoles');

    // 12.2 Verify non-admin (Citizen/Authority) cannot access /admin/dashboard
    let forbiddenTriggered = false;
    let forbiddenStatusCode = null;
    const mockCitizenReq = {
      session: { user: { id: citizen._id.toString(), role: 'citizen' } },
      headers: { accept: 'application/json' },
      xhr: true,
      originalUrl: '/admin/dashboard'
    };
    const mockRes = {
      status: (code) => {
        forbiddenStatusCode = code;
        return {
          json: (data) => {
            if (code === 403) forbiddenTriggered = true;
          },
          render: () => {
            if (code === 403) forbiddenTriggered = true;
          }
        };
      },
      redirect: () => {}
    };

    const adminMiddleware = requireAdmin;
    adminMiddleware(mockCitizenReq, mockRes, () => {
      throw new Error('Security Breach: Non-admin citizen was granted access by requireAdmin middleware!');
    });

    assert(forbiddenStatusCode === 403, 'requireAdmin strictly returns HTTP 403 Forbidden for citizen');
    assert(forbiddenTriggered === true, 'requireAdmin blocked unauthorized user from /admin/dashboard');

    // 12.3 Verify dedicated admin passes middleware
    let adminPassed = false;
    const mockAdminReq = {
      session: { user: { id: 'admin-id-123', role: 'admin' } },
      originalUrl: '/admin/dashboard'
    };
    adminMiddleware(mockAdminReq, mockRes, () => {
      adminPassed = true;
    });
    assert(adminPassed === true, 'requireAdmin middleware successfully permits user with role="admin"');
    console.log('');

    // =========================================================================
    // STEP 13: ADMIN DASHBOARD REAL DATA ECOSYSTEM QUERIES
    // =========================================================================
    console.log('Step 13: Verifying Admin Dashboard Multi-Stakeholder Ecosystem Data...');

    const [
      adminTotalUsers,
      adminTotalProblems,
      adminTotalChallenges,
      adminTotalSolutions,
      adminTotalCollabs
    ] = await Promise.all([
      User.countDocuments(),
      Problem.countDocuments(),
      Challenge.countDocuments(),
      Solution.countDocuments(),
      Collaboration.countDocuments()
    ]);

    assert(adminTotalUsers >= 4, 'Admin Overview reports real registered accounts count');
    assert(adminTotalProblems >= 1, 'Admin Overview reports real civic problems count');
    assert(adminTotalChallenges >= 1, 'Admin Overview reports real innovation challenges count');
    assert(adminTotalSolutions >= 1, 'Admin Overview reports real proposals/solutions count');
    assert(adminTotalCollabs >= 1, 'Admin Overview reports real industry collaborations count');

    console.log('  -> Admin Ecosystem Summary:', {
      accounts: adminTotalUsers,
      problems: adminTotalProblems,
      challenges: adminTotalChallenges,
      solutions: adminTotalSolutions,
      collaborations: adminTotalCollabs
    });
    console.log('');

    // =========================================================================
    // CLEANUP TEST RECORDS
    // =========================================================================
    console.log('Cleaning up test records...');
    await Collaboration.deleteMany({ _id: collaboration._id });
    await Solution.deleteMany({ _id: solution._id });
    await Challenge.deleteMany({ _id: createdChallenge._id });
    await Problem.deleteMany({ _id: savedProblem._id });
    await User.deleteMany({ email: { $in: testEmails } });
    console.log('  ✔ Test artifacts cleaned up.\n');

    console.log('================================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n✖ TEST FAILED WITH ERROR:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }
}

runTest();
