/**
 * SolveLink Prototype Demo Data Seed Script
 * ==========================================
 * DISCLAIMER: ALL RECORDS CREATED BY THIS SCRIPT ARE MOCK / DEMO DATA
 * INTENDED SOLELY FOR PROTOTYPE TESTING AND DEMONSTRATION OF SIH26043.
 * NONE OF THESE RECORDS ARE REAL OR INDEPENDENTLY VERIFIED.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');

async function seedDatabase() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('[Seed Script] Error: MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }
  console.log('[Seed Script] Connecting to MongoDB...');

  const conn = await mongoose.connect(uri);
  console.log(`  ✔ Connected to database (${conn.connection.host} / ${conn.connection.name}).\n`);

  try {
    console.log('--- Cleaning previous demo records ---');
    const demoEmails = [
      'citizen@solvelink.demo',
      'authority@solvelink.demo',
      'university@solvelink.demo',
      'industry@solvelink.demo'
    ];
    
    const existingDemoUsers = await User.find({ email: { $in: demoEmails } }).select('_id');
    const userIds = existingDemoUsers.map(u => u._id);

    if (userIds.length > 0) {
      await Problem.deleteMany({ reportedBy: { $in: userIds } });
      await Challenge.deleteMany({ createdBy: { $in: userIds } });
      await Solution.deleteMany({ submittedBy: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
      console.log('  ✔ Previous demo records purged cleanly.\n');
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    // =========================================================================
    // 1. SEED MOCK USERS (Citizen, Authority, University, Industry)
    // =========================================================================
    console.log('--- Seeding Mock Stakeholder Accounts ---');

    // 1.1 Citizen
    const citizen = await User.create({
      name: 'Citizen — Citizen',
      email: 'citizen@solvelink.demo',
      password: defaultPasswordHash,
      role: 'citizen',
      location: 'Latehar, Jharkhand'
    });
    console.log(`  ✔ [MOCK CITIZEN] created: "${citizen.name}" (${citizen.email})`);

    // 1.2 Authority
    const authority = await User.create({
      name: 'District Innovation Officer',
      email: 'authority@solvelink.demo',
      password: defaultPasswordHash,
      role: 'authority',
      organization: 'Department of Drinking Water & Sanitation (DWSS), Latehar',
      location: 'Latehar, Jharkhand'
    });
    console.log(`  ✔ [MOCK AUTHORITY] created: "${authority.name}" (${authority.email})`);

    // 1.3 University / Research Team
    const university = await User.create({
      name: 'Team AquaTech',
      email: 'university@solvelink.demo',
      password: defaultPasswordHash,
      role: 'university',
      organization: 'AquaTech Innovation Lab, BIT Mesra',
      skills: ['IoT', 'Embedded Systems', 'Data Analytics', 'Water Systems'],
      location: 'Ranchi, Jharkhand'
    });
    console.log(`  ✔ [MOCK UNIVERSITY] created: "${university.name}" (${university.email})`);

    // 1.4 Industry Partner
    const industry = await User.create({
      name: 'Smart Systems Partner',
      email: 'industry@solvelink.demo',
      password: defaultPasswordHash,
      role: 'industry',
      organization: 'Smart Systems Industrial Solutions Pvt Ltd',
      skills: ['IoT', 'Hardware', 'Field Manufacturing', 'Telemetry Integration'],
      location: 'Jamshedpur, Jharkhand'
    });
    console.log(`  ✔ [MOCK INDUSTRY] created: "${industry.name}" (${industry.email})\n`);

    // =========================================================================
    // 2. SEED MOCK PROBLEM
    // =========================================================================
    console.log('--- Seeding Mock Ground Problem ---');

    const problem = await Problem.create({
      title: 'Rural school handpump frequently fails, affecting access to drinking water.',
      description: 'The community handpump inside the rural school campus frequently fails due to severe mechanical friction, unpredicted piston wear, and subsurface grit accumulation. Over 280 students and 45 neighboring households lose clean drinking water access for up to two weeks during each outage.',
      category: 'Water & Sanitation',
      location: 'Latehar, Jharkhand',
      images: [],
      reportedBy: citizen._id,
      supporters: [citizen._id, authority._id],
      priority: 'HIGH',
      severity: 'HIGH',
      status: 'CHALLENGE_CREATED',
      similarProblems: [],
      aiAnalysis: {
        category: 'Water & Sanitation',
        severity: 'HIGH',
        priority: 'HIGH',
        summary: 'Critical drinking water access outage at Latehar rural school campus caused by recurring mechanical pump breakdown. AI recommends IoT vibration sensing and rapid municipal alert telemetry.',
        confidenceScore: 0.94,
        tags: ['IoT', 'Water Systems', 'Sensor Networks', 'Predictive Maintenance', 'Rural Utilities'],
        analyzedAt: new Date()
      }
    });
    console.log(`  ✔ [MOCK PROBLEM] created: "${problem.title}" (ID: ${problem._id})\n`);

    // =========================================================================
    // 3. SEED MOCK CHALLENGE
    // =========================================================================
    console.log('--- Seeding Mock Innovation Challenge ---');

    const challenge = await Challenge.create({
      title: 'Low-cost predictive maintenance system for rural water pumps',
      description: 'Design and deploy a ruggedized, low-cost sensor retrofit kit for Mark-II rural handpumps. The kit must detect vibration anomalies and piston degradation, transmitting predictive alerts to block water maintenance officers before dry pump failure occurs.',
      category: 'Water & Sanitation',
      location: 'Latehar, Jharkhand',
      department: 'Department of Drinking Water & Sanitation (DWSS), Latehar',
      requiredSkills: ['IoT', 'Embedded Systems', 'Data Analytics', 'Water Systems'],
      constraints: [
        'Unit cost under ₹8,500 for district viability',
        'Solar powered with 30-day battery backup reserve',
        'IP67 weatherproof and vandal-resistant enclosure',
        'Plug-and-play clamp design without welding'
      ],
      expectedOutcome: 'A field-validated IoT telemetry package deployed across 10 rural school handpumps in Latehar, proving early breakdown detection under 24 hours.',
      evaluationCriteria: [
        'Predictive Accuracy (30%)',
        'Unit Economics & Cost (25%)',
        'Field Durability & Solar Autonomy (25%)',
        'Ease of Deployment (20%)'
      ],
      deadline: new Date(Date.now() + 45 * 86400000), // 45 days from now
      status: 'IMPLEMENTATION',
      sourceProblem: problem._id,
      createdBy: authority._id
    });
    console.log(`  ✔ [MOCK CHALLENGE] created: "${challenge.title}" (ID: ${challenge._id})\n`);

    // =========================================================================
    // 4. SEED MOCK SOLUTION & RUBRIC EVALUATION
    // =========================================================================
    console.log('--- Seeding Mock University Solution ---');

    const solution = await Solution.create({
      challenge: challenge._id,
      submittedBy: university._id,
      team: {
        name: 'Team AquaTech',
        members: [
          {
            name: 'Dr. A. Verma',
            email: 'university@solvelink.demo',
            role: 'Lead Investigator',
            organization: 'BIT Mesra'
          },
          {
            name: 'Priya Singh',
            email: 'priya.aquatech@bitmesra.edu',
            role: 'Hardware Engineer',
            organization: 'AquaTech Lab'
          },
          {
            name: 'Rohit Kumar',
            email: 'rohit.data@bitmesra.edu',
            role: 'Data Analyst',
            organization: 'AquaTech Lab'
          }
        ]
      },
      title: 'Sensor-based pump health monitoring with maintenance alerts',
      description: 'A non-invasive piezo-electric vibration and stroke frequency telemetry unit clamped to the pump cylinder. An ultra-low power ESP32 processor runs edge vibration FFT analysis and transmits predictive health alerts via LoRaWAN/GSM to the district portal.',
      technology: [
        'IoT Sensors',
        'Piezoelectric Accelerometers',
        'ESP32 Embedded Firmware',
        'Edge TinyML Vibration FFT',
        'LoRaWAN / GSM Gateway',
        'Cloud Alerting Dashboard'
      ],
      estimatedCost: 7200,
      impact: 'Eliminates 14-day handpump outages, restoring continuous clean drinking water access for 280 school students and neighboring rural households.',
      status: 'SELECTED',
      evaluation: {
        score: 94,
        feedback: 'Outstanding edge TinyML vibration analysis and compliant unit economics (₹7,200). Officially selected and approved for Latehar district pilot implementation.',
        evaluatedBy: authority._id,
        evaluatedAt: new Date()
      }
    });
    console.log(`  ✔ [MOCK SOLUTION] created: "${solution.title}" (ID: ${solution._id})\n`);

    // =========================================================================
    // 5. SUMMARY REPORT
    // =========================================================================
    console.log('================================================================');
    console.log('DEMO DATA SEEDING COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log('MOCK LOGINS CREATED (Password for all accounts: "password123"):');
    console.log('  1. Citizen:    citizen@solvelink.demo    (Citizen — Citizen)');
    console.log('  2. Authority:  authority@solvelink.demo  (District Innovation Officer)');
    console.log('  3. University: university@solvelink.demo (Team AquaTech)');
    console.log('  4. Industry:   industry@solvelink.demo   (Smart Systems Partner)');
    console.log('----------------------------------------------------------------');
    console.log('LINKAGES:');
    console.log(`  Problem:   "${problem.title}" [${problem._id}]`);
    console.log(`  Challenge: "${challenge.title}" [${challenge._id}] (Status: ${challenge.status})`);
    console.log(`  Solution:  "${solution.title}" [${solution._id}] (Score: 94/100, Status: ${solution.status})`);
    console.log(`  Milestone: Prototype → Field Pilot → Deployment`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('[Seed Script Error]', error);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed Script] Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedDatabase();
