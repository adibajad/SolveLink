require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Ensure uploads directory exists
fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });

const session = require('express-session');
const { setUserLocals, ensureAuthenticated } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const problemRoutes = require('./routes/problemRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const solutionRoutes = require('./routes/solutionRoutes');
const industryRoutes = require('./routes/industryRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database is handled during server startup (awaited before app.listen)
app.connectDB = connectDB;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust reverse proxy (Render terminates SSL at edge and proxies to container)
app.set('trust proxy', 1);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'solvelink_dev_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: 'auto',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Global user locals & path middleware for EJS
app.use(setUserLocals);

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// Resilient fallback for any nested relative image requests from sub-routes
app.use(['/authority/problems/uploads', '/problems/uploads', '/citizen/uploads', '/authority/uploads'], express.static(path.join(__dirname, 'public/uploads')));

// Auth Routes
app.use('/auth', authRoutes);

// Citizen & Problem Routes
app.use('/', problemRoutes);

// Authority & Challenge Management Routes
app.use('/', challengeRoutes);

// University & Solution Innovation Routes
app.use('/', solutionRoutes);

// Industry Partner Routes
app.use('/', industryRoutes);

// Platform Administrator Routes (Dedicated Login & Ecosystem Dashboard)
app.use('/', adminRoutes);

// Protected General Dashboard Dispatcher
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  const role = req.user?.role || 'citizen';
  if (role === 'admin') return res.redirect('/admin/dashboard');
  if (role === 'authority') return res.redirect('/authority/dashboard');
  if (role === 'university') return res.redirect('/university/dashboard');
  if (role === 'industry') return res.redirect('/industry/dashboard');
  return res.redirect('/citizen/dashboard');
});

// Homepage Route
app.get('/', async (req, res) => {
  try {
    const Challenge = require('./models/Challenge');
    let challenges = [];
    if (require('mongoose').connection.readyState === 1) {
      challenges = await Challenge.find({ status: 'PUBLISHED' })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
    }
    res.render('home', {
      activePath: '/',
      challenges: challenges.length > 0 ? challenges : undefined,
      user: req.user || undefined
    });
  } catch (err) {
    res.render('home', {
      activePath: '/',
      user: req.user || undefined
    });
  }
});

// Challenges Listing Route
app.get('/challenges', async (req, res) => {
  try {
    const Challenge = require('./models/Challenge');
    const { q, category, location, skill, status, sort = 'newest' } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['PUBLISHED', 'OPEN', 'UNDER_REVIEW', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] };
    }

    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location, 'i');
    if (skill) filter.requiredSkills = skill;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'deadline') {
      sortObj = { deadline: 1 };
    } else if (sort === 'most_solutions' || sort === 'most_interested') {
      sortObj = { interestedCount: -1, createdAt: -1 };
    } else {
      sortObj = { createdAt: -1 };
    }

    let challenges = [];
    if (require('mongoose').connection.readyState === 1) {
      challenges = await Challenge.find(filter)
        .populate('sourceProblem', 'title location images')
        .sort(sortObj)
        .lean();
    }

    // If database is empty and no custom filter was applied, provide standard starter challenges
    if (challenges.length === 0 && !q && !category && !location && !skill && !status) {
      challenges = [
        {
          _id: 'c1',
          title: 'Solar Cold-Storage for Tribal Forest Produce Cooperatives',
          category: 'Agriculture & Energy',
          location: 'Khunti, Jharkhand',
          description: 'Designing off-grid micro cold storage solutions to preserve perishable forest products and boost tribal farmer income.',
          status: 'PUBLISHED',
          interestedCount: 8,
          requiredSkills: ['Renewable Energy', 'IoT', 'Embedded Systems'],
          deadline: new Date(Date.now() + 24 * 86400000 * 22)
        },
        {
          _id: 'c2',
          title: 'Automated Pothole Mapping & Polymer Quick-Patch Kit',
          category: 'Infrastructure',
          location: 'Dhanbad Municipal Corp',
          description: 'Computer-vision dashcam mapping of road fissures combined with indigenous durable cold-asphalt patch materials.',
          status: 'PUBLISHED',
          interestedCount: 12,
          requiredSkills: ['Computer Vision', 'Civil Engineering'],
          deadline: new Date(Date.now() + 24 * 86400000 * 14)
        },
        {
          _id: 'c3',
          title: 'Low-Cost Tele-Diagnostic Toolkit for Primary Health Centers',
          category: 'Public Health',
          location: 'Santhal Pargana Region',
          description: 'Integrated solar-powered diagnostic device connecting remote ASHA workers with district hospital specialist doctors.',
          status: 'PUBLISHED',
          interestedCount: 19,
          requiredSkills: ['Biomedical', 'IoT', 'Data Analytics'],
          deadline: new Date(Date.now() + 24 * 86400000 * 30)
        }
      ];
    }

    // Compute Summary Statistics
    let challengeStats = {
      activeChallenges: 6,
      openForSolutions: 4,
      inPilot: 1,
      solutionsSubmitted: 12
    };

    if (require('mongoose').connection.readyState === 1) {
      const allChallenges = await Challenge.find({}).lean();
      if (allChallenges.length > 0) {
        challengeStats.activeChallenges = allChallenges.length;
        challengeStats.openForSolutions = allChallenges.filter(c => c.status === 'PUBLISHED' || c.status === 'OPEN').length;
        challengeStats.inPilot = allChallenges.filter(c => c.status === 'IMPLEMENTATION' || c.status === 'SOLUTION_SELECTED').length;
        challengeStats.solutionsSubmitted = allChallenges.reduce((sum, c) => sum + (c.solutionsCount || c.interestedCount || 0), 0);
      }
    }

    const currentUser = (req.session && req.session.user) ? req.session.user : (req.user || res.locals.user || null);

    res.render('challenges', {
      activePath: '/challenges',
      challenges,
      stats: challengeStats,
      query: req.query || {},
      user: currentUser
    });
  } catch (err) {
    const currentUser = (req.session && req.session.user) ? req.session.user : (req.user || res.locals.user || null);
    res.render('challenges', {
      activePath: '/challenges',
      challenges: [],
      stats: { activeChallenges: 0, openForSolutions: 0, inPilot: 0, solutionsSubmitted: 0 },
      query: req.query || {},
      user: currentUser
    });
  }
});

// Challenge Detail Route
app.get('/challenges/:id', async (req, res, next) => {
  try {
    const Challenge = require('./models/Challenge');
    let challenge = null;

    if (require('mongoose').connection.readyState === 1 && require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      challenge = await Challenge.findById(req.params.id).populate('sourceProblem').populate('createdBy', 'name organization').lean();
    }

    // Fallback demo challenge if sample ID requested or DB not seeded
    if (!challenge) {
      challenge = {
        _id: req.params.id,
        title: 'Smart Sub-Surface Water Filtration for Rural Arsenic Belts',
        category: 'Water & Sanitation',
        location: 'Ranchi District, Jharkhand',
        department: 'Department of Drinking Water & Sanitation, Govt of Jharkhand',
        description: 'Deploying low-energy decentralized gravity filtration kits to eliminate heavy metal contamination in community borewells across peri-urban and rural panchayats.',
        expectedOutcome: 'A field-tested pilot filtration cartridge capable of treating 500 liters/hour with zero power requirement and locally replaceable media.',
        constraints: [
          'Material cost per unit must be below ₹12,000.',
          'Must operate entirely by gravity pressure without grid electricity.',
          'Filter cartridges must be recyclable or biodegradable.'
        ],
        requiredSkills: ['Environmental Science', 'Civil Engineering', 'Material Science', 'IoT'],
        evaluationCriteria: [
          'Filtration efficacy and heavy metal reduction percentage (35%)',
          'Fabrication and maintenance unit economics (30%)',
          'Field deployment readiness in panchayat environments (20%)',
          'Community usability and maintenance ease (15%)'
        ],
        deadline: new Date(Date.now() + 24 * 86400000 * 18),
        sourceProblem: {
          title: 'High Arsenic in Tubewells',
          description: 'Villagers in 4 panchayats report severe water discoloration and arsenic test failures above permissible limits.'
        }
      };
    }

    let relatedChallenges = [];
    if (require('mongoose').connection.readyState === 1) {
      const currentId = challenge._id;
      const queryObj = {
        status: { $in: ['PUBLISHED', 'OPEN', 'UNDER_REVIEW', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] }
      };
      if (require('mongoose').Types.ObjectId.isValid(currentId)) {
        queryObj._id = { $ne: currentId };
      }
      relatedChallenges = await Challenge.find(queryObj)
        .populate('sourceProblem', 'title location images')
        .limit(3)
        .lean();
    }

    if (!relatedChallenges || relatedChallenges.length === 0) {
      relatedChallenges = [
        {
          _id: 'c1',
          title: 'Solar Cold-Storage for Tribal Forest Produce Cooperatives',
          category: 'Agriculture & Energy',
          location: 'Khunti, Jharkhand',
          description: 'Designing off-grid micro cold storage solutions to preserve perishable forest products and boost tribal farmer income.',
          status: 'PUBLISHED',
          interestedCount: 8,
          requiredSkills: ['Renewable Energy', 'IoT', 'Embedded Systems'],
          deadline: new Date(Date.now() + 24 * 86400000 * 22)
        },
        {
          _id: 'c2',
          title: 'Automated Pothole Mapping & Polymer Quick-Patch Kit',
          category: 'Infrastructure',
          location: 'Dhanbad Municipal Corp',
          description: 'Computer-vision dashcam mapping of road fissures combined with indigenous durable cold-asphalt patch materials.',
          status: 'PUBLISHED',
          interestedCount: 12,
          requiredSkills: ['Computer Vision', 'Civil Engineering'],
          deadline: new Date(Date.now() + 24 * 86400000 * 14)
        },
        {
          _id: 'c3',
          title: 'Low-Cost Tele-Diagnostic Toolkit for Primary Health Centers',
          category: 'Public Health',
          location: 'Santhal Pargana Region',
          description: 'Integrated solar-powered diagnostic device connecting remote ASHA workers with district hospital specialist doctors.',
          status: 'PUBLISHED',
          interestedCount: 19,
          requiredSkills: ['Biomedical', 'IoT', 'Data Analytics'],
          deadline: new Date(Date.now() + 24 * 86400000 * 30)
        }
      ].filter(r => r._id !== (challenge._id || '').toString()).slice(0, 3);
    }

    const currentUser = (req.session && req.session.user) ? req.session.user : (req.user || res.locals.user || null);

    res.render('challenge-detail', {
      activePath: '/challenges',
      challenge,
      relatedChallenges,
      user: currentUser
    });
  } catch (err) {
    next(err);
  }
});

// About Page Route
app.get('/about', (req, res) => {
  res.render('about', {
    activePath: '/about',
    user: req.user || undefined
  });
});

// Resources Page Route
app.get('/resources', (req, res) => {
  res.render('resources', {
    activePath: '/resources',
    user: req.user || undefined
  });
});

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: statusCode,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// Start server if this file is run directly
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`[SolveLink] Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error(`[SolveLink] Failed to start server: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
