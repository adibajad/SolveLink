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
const Collaboration = require('../models/Collaboration');

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
      'energy.authority@solvelink.demo',
      'university@solvelink.demo',
      'industry@solvelink.demo',
      'admin@solvelink.demo'
    ];
    
    const existingDemoUsers = await User.find({ email: { $in: demoEmails } }).select('_id');
    const userIds = existingDemoUsers.map(u => u._id);

    if (userIds.length > 0) {
      await Collaboration.deleteMany({ industry: { $in: userIds } });
      await Problem.deleteMany({ reportedBy: { $in: userIds } });
      await Challenge.deleteMany({ createdBy: { $in: userIds } });
      await Solution.deleteMany({ submittedBy: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
      console.log('  ✔ Previous demo records purged cleanly.\n');
    }

    const defaultPasswordHash = await bcrypt.hash('password123', 10);

    // =========================================================================
    // 1. SEED MOCK USERS (Admin, Citizen, Authority, University, Industry)
    // =========================================================================
    console.log('--- Seeding Mock Stakeholder Accounts ---');

    // 1.0 Dedicated Platform Administrator
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@solvelink.demo',
      password: defaultPasswordHash,
      role: 'admin',
      organization: 'SolveLink Platform Operations',
      location: 'Central Control'
    });
    console.log(`  ✔ [MOCK ADMIN] created: "${admin.name}" (${admin.email})`);

    // 1.1 Citizen
    const citizen = await User.create({
      name: 'Citizen — Citizen',
      email: 'citizen@solvelink.demo',
      password: defaultPasswordHash,
      role: 'citizen',
      location: 'Latehar, Jharkhand'
    });
    console.log(`  ✔ [MOCK CITIZEN] created: "${citizen.name}" (${citizen.email})`);

    // 1.2 Water & Sanitation Authority
    const authority = await User.create({
      name: 'District Water & Sanitation Officer',
      email: 'authority@solvelink.demo',
      password: defaultPasswordHash,
      role: 'authority',
      authoritySector: 'water_sanitation',
      department: 'Municipal Water Supply Department',
      jurisdiction: 'Ranchi District, Latehar',
      organization: 'Department of Drinking Water & Sanitation (DWSS), Latehar',
      location: 'Latehar, Jharkhand'
    });
    console.log(`  ✔ [MOCK AUTHORITY] created: "${authority.name}" (${authority.email}) [Sector: water_sanitation]`);

    // 1.2b Energy & Power Authority (for routing isolation testing)
    const energyAuthority = await User.create({
      name: 'State Electricity Distribution Officer',
      email: 'energy.authority@solvelink.demo',
      password: defaultPasswordHash,
      role: 'authority',
      authoritySector: 'energy',
      department: 'Jharkhand Bijli Vitran Nigam Ltd',
      jurisdiction: 'Ranchi District',
      organization: 'JBVNL Power Division',
      location: 'Ranchi, Jharkhand'
    });
    console.log(`  ✔ [MOCK AUTHORITY 2] created: "${energyAuthority.name}" (${energyAuthority.email}) [Sector: energy]`);

    // 1.3 University / Research Team
    const university = await User.create({
      name: 'Team AquaTech',
      email: 'university@solvelink.demo',
      password: defaultPasswordHash,
      role: 'university',
      organization: 'AquaTech Innovation Lab, BIT Mesra',
      domains: ['water_sanitation', 'iot', 'civil_engineering', 'embedded_systems'],
      skills: ['IoT', 'Embedded Systems', 'Data Analytics', 'Water Systems'],
      technologies: ['ESP32', 'LoRaWAN', 'Python', 'Acoustic Sensors', 'Flow Meters'],
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
      industrySector: 'water_sanitation',
      domains: ['water_sanitation', 'iot', 'hardware_manufacturing'],
      capabilities: ['Pilot Implementation', 'Hardware Fabrication', 'Field Validation', 'Manufacturing Scale'],
      skills: ['IoT', 'Hardware', 'Field Manufacturing', 'Telemetry Integration'],
      technologies: ['PCB Assembly', 'CNC Machining', 'IoT Enclosures', 'SCADA'],
      location: 'Jamshedpur, Jharkhand'
    });
    console.log(`  ✔ [MOCK INDUSTRY] created: "${industry.name}" (${industry.email})\n`);

    // =========================================================================
    // 2. SEED REAL GROUND PROBLEMS
    // =========================================================================
    console.log('--- Seeding Ground Problems ---');

    const prob1 = await Problem.create({
      title: 'Perishable tribal forest produce spoiled due to lack of local cold storage.',
      description: 'Tribal cooperatives in Khunti district harvest mahua flowers, custard apples, and lac, but lack decentralized cold storage facilities. Over 40% of seasonal forest produce spoils before reaching regional markets, heavily reducing tribal household income.',
      category: 'Agriculture & Energy',
      location: 'Khunti, Jharkhand',
      reportedBy: citizen._id,
      supporters: [citizen._id, authority._id],
      priority: 'HIGH',
      severity: 'HIGH',
      status: 'CHALLENGE_CREATED',
      images: ['/images/challenge-agriculture.jpg']
    });

    const prob2 = await Problem.create({
      title: 'Monsoon roadway potholes causing frequent accidents and transit delays.',
      description: 'Severe pothole clusters along Dhanbad municipal corridors disrupt daily bus transit and cause recurring two-wheeler injuries. Current bitumen patching washes away within days of heavy rainfall.',
      category: 'Infrastructure',
      location: 'Dhanbad Municipal Corp, Jharkhand',
      reportedBy: citizen._id,
      supporters: [citizen._id, authority._id],
      priority: 'HIGH',
      severity: 'HIGH',
      status: 'CHALLENGE_CREATED',
      images: ['/uploads/evidence-1788095551782-911002898.jpeg']
    });

    const prob3 = await Problem.create({
      title: 'Primary Health Centers lack rapid diagnostic tools for remote ASHA workers.',
      description: 'Sub-centers in Santhal Pargana lack basic diagnostic testing kits, forcing pregnant women and elderly patients to travel 45km to district hospitals for routine blood and vitals testing.',
      category: 'Public Health',
      location: 'Santhal Pargana Region, Jharkhand',
      reportedBy: citizen._id,
      supporters: [citizen._id, authority._id],
      priority: 'HIGH',
      severity: 'HIGH',
      status: 'CHALLENGE_CREATED',
      images: ['/images/challenge-education.jpg']
    });

    const prob4 = await Problem.create({
      title: 'Rural school handpump frequently fails, affecting access to drinking water.',
      description: 'The community handpump inside the rural school campus frequently fails due to severe mechanical friction, unpredicted piston wear, and subsurface grit accumulation. Over 280 students lose clean drinking water access for up to two weeks during each outage.',
      category: 'Water & Sanitation',
      location: 'Latehar, Jharkhand',
      reportedBy: citizen._id,
      supporters: [citizen._id, authority._id],
      priority: 'HIGH',
      severity: 'HIGH',
      status: 'CHALLENGE_CREATED',
      images: ['/images/challenge-water.jpg', '/uploads/evidence-1788252501864-560207743.jpeg']
    });
    console.log('  ✔ Ground problems seeded.\n');

    // =========================================================================
    // 3. SEED REAL INNOVATION CHALLENGES (PUBLISHED & OPEN FOR PROPOSALS)
    // =========================================================================
    console.log('--- Seeding Published Challenges ---');

    const ch1 = await Challenge.create({
      title: 'Solar Cold-Storage for Tribal Forest Produce Cooperatives',
      description: 'Designing off-grid micro cold storage solutions to preserve perishable forest products and boost tribal farmer income across rural self-help groups in Jharkhand.',
      category: 'Agriculture & Energy',
      domainName: 'Agriculture & Energy',
      authoritySector: 'agriculture',
      location: 'Khunti, Jharkhand',
      department: 'Department of Forest & Environment, Govt of Jharkhand',
      requiredSkills: ['Renewable Energy', 'IoT', 'Embedded Systems'],
      requiredTechnologies: ['Solar PV', 'PCM Thermal Storage', 'IoT Datalogger'],
      constraints: [
        'Total system cost must be under ₹1,50,000 for cooperative subsidies',
        'Must function off-grid with 48-hour solar battery autonomy',
        'Temperature control between 2°C and 8°C with digital datalogging'
      ],
      expectedOutcome: 'A field-tested 2-metric-ton solar micro cold-room prototype ready for cluster deployment.',
      evaluationCriteria: [
        'Thermal insulation efficacy and energy efficiency (35%)',
        'Unit economics and affordability for farmer SHGs (30%)',
        'Ease of local maintenance and repair (20%)',
        'Remote telemetry and IoT temperature monitoring (15%)'
      ],
      deadline: new Date(Date.now() + 25 * 86400000),
      status: 'PUBLISHED',
      sourceProblem: prob1._id,
      createdBy: authority._id
    });

    const ch2 = await Challenge.create({
      title: 'Automated Pothole Mapping & Polymer Quick-Patch Kit',
      description: 'Computer-vision dashcam mapping of road fissures combined with indigenous durable cold-asphalt polymer quick-patch materials capable of curing in wet monsoon conditions.',
      category: 'Infrastructure',
      domainName: 'Infrastructure',
      authoritySector: 'public_works_infrastructure',
      location: 'Dhanbad Municipal Corp, Jharkhand',
      department: 'Urban Development & Housing Department, Dhanbad',
      requiredSkills: ['Computer Vision', 'Civil Engineering', 'Material Science'],
      requiredTechnologies: ['OpenCV', 'TensorFlow Lite', 'Polymer Cold-Patch'],
      constraints: [
        'Material setting time under 30 minutes in humid or wet conditions',
        'Edge AI mapping algorithm must run on standard Android dashcam hardware',
        'Material cost per sq meter under ₹450'
      ],
      expectedOutcome: 'A smartphone-compatible real-time road defect detection model and a batch of rapid-setting polymer mix tested on 5 km of municipal roads.',
      evaluationCriteria: [
        'Patch longevity and compressive strength under heavy transit (35%)',
        'Computer vision pothole detection accuracy (>90% precision) (30%)',
        'Material cost and deployment time (25%)',
        'Worker safety and ease of application (10%)'
      ],
      deadline: new Date(Date.now() + 20 * 86400000),
      status: 'PUBLISHED',
      sourceProblem: prob2._id,
      createdBy: authority._id
    });

    const ch3 = await Challenge.create({
      title: 'Low-Cost Tele-Diagnostic Toolkit for Primary Health Centers',
      description: 'Integrated solar-powered diagnostic device connecting remote ASHA workers with district hospital specialist doctors, featuring ECG, pulse-oximetry, and blood analysis.',
      category: 'Public Health',
      domainName: 'Public Health',
      authoritySector: 'public_health',
      location: 'Santhal Pargana Region, Jharkhand',
      department: 'Department of Health & Family Welfare, Govt of Jharkhand',
      requiredSkills: ['Biomedical', 'IoT', 'Data Analytics'],
      requiredTechnologies: ['BLE', '12-lead ECG ADC', 'Raspberry Pi / ESP32'],
      constraints: [
        'Handheld form-factor weighing under 2.5 kg',
        'Must support low-bandwidth 2G sync or store-and-forward offline telemetry',
        'Battery run-time exceeding 14 hours continuous field screening'
      ],
      expectedOutcome: 'A ruggedized diagnostic kit validated across 5 primary health centers with live EHR cloud synchronization.',
      evaluationCriteria: [
        'Clinical diagnostic accuracy compared to hospital reference (35%)',
        'Portability, battery longevity and ruggedization (25%)',
        'Data privacy, security and offline synchronization (20%)',
        'Unit bill of materials under ₹25,000 (20%)'
      ],
      deadline: new Date(Date.now() + 35 * 86400000),
      status: 'PUBLISHED',
      sourceProblem: prob3._id,
      createdBy: authority._id
    });

    const ch4 = await Challenge.create({
      title: 'Low-cost predictive maintenance system for rural water pumps',
      description: 'Design and deploy a ruggedized, low-cost sensor retrofit kit for Mark-II rural handpumps. The kit must detect vibration anomalies and piston degradation, transmitting predictive alerts to block water maintenance officers before dry pump failure occurs.',
      category: 'Water & Sanitation',
      domainName: 'Water & Sanitation',
      authoritySector: 'water_sanitation',
      location: 'Latehar, Jharkhand',
      department: 'Department of Drinking Water & Sanitation (DWSS), Latehar',
      requiredSkills: ['IoT', 'Embedded Systems', 'Data Analytics', 'Water Systems'],
      requiredTechnologies: ['ESP32', 'LoRaWAN', 'Piezoelectric Vibration Sensors', 'Solar PMIC'],
      constraints: [
        'Unit cost under ₹8,500 for district viability',
        'Solar powered with 30-day battery backup reserve',
        'IP67 weatherproof and vandal-resistant enclosure'
      ],
      expectedOutcome: 'A field-validated IoT telemetry package deployed across 10 rural school handpumps in Latehar, proving early breakdown detection under 24 hours.',
      evaluationCriteria: [
        'Predictive Accuracy (30%)',
        'Unit Economics & Cost (25%)',
        'Field Durability & Solar Autonomy (25%)',
        'Ease of Deployment (20%)'
      ],
      deadline: new Date(Date.now() + 45 * 86400000),
      status: 'PUBLISHED',
      sourceProblem: prob4._id,
      createdBy: authority._id
    });
    console.log('  ✔ 4 Published challenges seeded in MongoDB.\n');

    // =========================================================================
    // 4. SEED MOCK UNIVERSITY SOLUTION & EVALUATION
    // =========================================================================
    console.log('--- Seeding University Solution ---');

    const solution = await Solution.create({
      challenge: ch4._id,
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
      technicalApproach: 'Piezoelectric sensor paired with ESP32-S3 microcontroller executing TinyML FFT model. When anomaly harmonics exceed baseline threshold for 3 consecutive strokes, an emergency maintenance packet is dispatched over cellular NB-IoT.',
      skills: ['IoT', 'Embedded Systems', 'Data Analytics', 'Water Systems'],
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
      implementationDetails: 'Phase 1: Lab calibration bench testing (Weeks 1-3). Phase 2: Pilot clamp retrofit on 5 rural school handpumps in Latehar (Weeks 4-6). Phase 3: Telemetry gateway integration with DWSS municipal dashboard (Weeks 7-8).',
      status: 'SELECTED',
      evaluation: {
        score: 94,
        feedback: 'Outstanding edge TinyML vibration analysis and compliant unit economics (₹7,200). Officially selected and approved for Latehar district pilot implementation.',
        evaluatedBy: authority._id,
        evaluatedAt: new Date()
      }
    });
    console.log(`  ✔ [SOLUTION] created: "${solution.title}" (ID: ${solution._id})\n`);

    // =========================================================================
    // 5. SEED INDUSTRY COLLABORATION
    // =========================================================================
    console.log('--- Seeding Industry Collaboration ---');

    const collaboration = await Collaboration.create({
      proposal: solution._id,
      challenge: ch4._id,
      industry: industry._id,
      supportType: 'PILOT_IMPLEMENTATION',
      message: 'Smart Systems can provide IP67 industrial enclosures, precision PCB fabrication, and on-ground field deployment technicians across Latehar district.',
      status: 'INTERESTED'
    });
    console.log(`  ✔ [COLLABORATION] created from "${industry.name}" for solution "${solution.title}"\n`);

    // =========================================================================
    // 6. SUMMARY REPORT
    // =========================================================================
    console.log('================================================================');
    console.log('DEMO DATA SEEDING COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log('LOGINS CREATED (Password for all accounts: "password123"):');
    console.log('  1. Citizen:    citizen@solvelink.demo    (Citizen — Citizen)');
    console.log('  2. Authority:  authority@solvelink.demo  (District Innovation Officer)');
    console.log('  3. University: university@solvelink.demo (Team AquaTech)');
    console.log('  4. Industry:   industry@solvelink.demo   (Smart Systems Partner)');
    console.log('----------------------------------------------------------------');
    console.log('SEED CHALLENGES:');
    console.log(`  1. "${ch1.title}" [${ch1._id}] (Status: ${ch1.status})`);
    console.log(`  2. "${ch2.title}" [${ch2._id}] (Status: ${ch2.status})`);
    console.log(`  3. "${ch3.title}" [${ch3._id}] (Status: ${ch3.status})`);
    console.log(`  4. "${ch4.title}" [${ch4._id}] (Status: ${ch4.status})`);
    console.log('----------------------------------------------------------------');
    console.log(`  Solution:      "${solution.title}" [${solution._id}] (Status: ${solution.status})`);
    console.log(`  Collaboration: [${collaboration._id}] (Industry: ${industry.name}, Type: ${collaboration.supportType})`);
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

