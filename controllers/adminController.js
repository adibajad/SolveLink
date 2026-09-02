/**
 * SolveLink Admin Controller
 * Dedicated administrative monitoring, ecosystem overview, and secure authentication.
 */

const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const Collaboration = require('../models/Collaboration');
const bcrypt = require('bcryptjs');

/**
 * GET /admin/login
 * Renders dedicated Administrator Login Portal
 */
const getAdminLogin = (req, res) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }

  res.render('admin/login', {
    activePath: '/admin/login',
    error: null,
    email: req.query.email || ''
  });
};

/**
 * POST /admin/login
 * Secure Admin Login Handler
 * Checks Render environment variables (ADMIN_EMAIL, ADMIN_PASSWORD) or existing Admin User in MongoDB
 */
const postAdminLogin = async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  try {
    if (!cleanEmail || !password) {
      return res.status(400).render('admin/login', {
        activePath: '/admin/login',
        error: 'Please provide both administrator email and password.',
        email: cleanEmail
      });
    }

    // 1. Check Render Environment Variables
    const envAdminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
    const envAdminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : null;

    let adminUser = null;

    if (envAdminEmail && cleanEmail === envAdminEmail) {
      if (envAdminPassword && password === envAdminPassword) {
        // Find or provision the admin user in MongoDB for relational references
        adminUser = await User.findOne({ email: cleanEmail });
        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(envAdminPassword, 10);
          adminUser = await User.create({
            name: 'Platform Administrator',
            email: cleanEmail,
            password: hashedPassword,
            role: 'admin',
            organization: 'SolveLink Platform Operations',
            isVerified: true
          });
        } else if (adminUser.role !== 'admin') {
          adminUser.role = 'admin';
          await adminUser.save();
        }
      } else {
        return res.status(401).render('admin/login', {
          activePath: '/admin/login',
          error: 'Invalid administrator credentials.',
          email: cleanEmail
        });
      }
    } else {
      // 2. Database-Driven Admin Authentication (Registered / Seeded role: 'admin')
      adminUser = await User.findOne({ email: cleanEmail, role: 'admin' });
      if (!adminUser) {
        return res.status(401).render('admin/login', {
          activePath: '/admin/login',
          error: 'Invalid administrator credentials.',
          email: cleanEmail
        });
      }

      const isMatch = await bcrypt.compare(password, adminUser.password);
      if (!isMatch) {
        return res.status(401).render('admin/login', {
          activePath: '/admin/login',
          error: 'Invalid administrator credentials.',
          email: cleanEmail
        });
      }
    }

    // 3. Establish Admin Session
    const userIdStr = adminUser._id.toString();
    req.session.userId = userIdStr;
    req.session.user = {
      id: userIdStr,
      _id: userIdStr,
      name: adminUser.name,
      email: adminUser.email,
      role: 'admin',
      organization: adminUser.organization || 'SolveLink Platform Administration',
      location: adminUser.location || 'Headquarters'
    };

    return req.session.save((err) => {
      if (err) console.error('[Admin Session Save Error]', err);
      res.redirect('/admin/dashboard');
    });
  } catch (error) {
    console.error('[Admin Login Error]', error);
    res.status(500).render('admin/login', {
      activePath: '/admin/login',
      error: 'An unexpected system error occurred during authentication.',
      email: cleanEmail
    });
  }
};

/**
 * GET /admin/dashboard
 * Central Platform Administrator Console across all SolveLink Stakeholders & Data
 */
const getAdminDashboard = async (req, res, next) => {
  try {
    // 1. Overview Metrics (All real MongoDB records)
    const [
      totalUsers,
      totalCitizens,
      totalAuthorities,
      totalUniversities,
      totalIndustries,
      totalProblems,
      totalChallenges,
      totalSolutions,
      activeCollaborations
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'citizen' }),
      User.countDocuments({ role: 'authority' }),
      User.countDocuments({ role: 'university' }),
      User.countDocuments({ role: 'industry' }),
      Problem.countDocuments(),
      Challenge.countDocuments(),
      Solution.countDocuments(),
      Collaboration.countDocuments()
    ]);

    const overview = {
      totalUsers,
      totalCitizens,
      totalAuthorities,
      totalUniversities,
      totalIndustries,
      totalProblems,
      totalChallenges,
      totalSolutions,
      activeCollaborations
    };

    // 2. Accounts List
    const accounts = await User.find()
      .select('name email role organization authoritySector department jurisdiction location createdAt isVerified')
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // 3. Problems List & Metrics
    const [
      problemsPending,
      problemsAssigned,
      problemsUnderReview,
      problemsVerified,
      problemsResolved,
      problemsNeedsReview
    ] = await Promise.all([
      Problem.countDocuments({ assignmentStatus: 'pending' }),
      Problem.countDocuments({ assignmentStatus: 'assigned' }),
      Problem.countDocuments({ status: { $in: ['REPORTED', 'UNDER_VERIFICATION'] } }),
      Problem.countDocuments({ status: 'VERIFIED' }),
      Problem.countDocuments({ status: { $in: ['ALREADY_RESOLVED', 'RESOLVED'] } }),
      Problem.countDocuments({ assignmentStatus: 'needs_review' })
    ]);

    const problemsMetrics = {
      pending: problemsPending,
      assigned: problemsAssigned,
      underReview: problemsUnderReview,
      verified: problemsVerified,
      resolved: problemsResolved,
      needsReview: problemsNeedsReview
    };

    const problems = await Problem.find()
      .populate('reportedBy', 'name email organization')
      .populate('assignedAuthority', 'name authoritySector department organization')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 4. Challenges List & Metrics
    const [
      challengesDraft,
      challengesPublished,
      challengesClosed,
      challengesSelected
    ] = await Promise.all([
      Challenge.countDocuments({ status: 'DRAFT' }),
      Challenge.countDocuments({ status: 'PUBLISHED' }),
      Challenge.countDocuments({ status: 'CLOSED' }),
      Challenge.countDocuments({ status: { $in: ['APPROVED', 'IMPLEMENTATION', 'SOLUTION_SELECTED'] } })
    ]);

    const challengesMetrics = {
      draft: challengesDraft,
      published: challengesPublished,
      closed: challengesClosed,
      selected: challengesSelected
    };

    const challenges = await Challenge.find()
      .populate('createdBy', 'name organization authoritySector')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 5. Proposals / Solutions List & Metrics
    const [
      solutionsSubmitted,
      solutionsUnderReview,
      solutionsShortlisted,
      solutionsAccepted,
      solutionsRejected,
      solutionsImplementation
    ] = await Promise.all([
      Solution.countDocuments({ status: 'SUBMITTED' }),
      Solution.countDocuments({ status: 'UNDER_REVIEW' }),
      Solution.countDocuments({ status: 'SHORTLISTED' }),
      Solution.countDocuments({ status: { $in: ['SELECTED', 'ACCEPTED'] } }),
      Solution.countDocuments({ status: 'REJECTED' }),
      Solution.countDocuments({ status: 'IMPLEMENTATION' })
    ]);

    const solutionsMetrics = {
      submitted: solutionsSubmitted,
      underReview: solutionsUnderReview,
      shortlisted: solutionsShortlisted,
      accepted: solutionsAccepted,
      rejected: solutionsRejected,
      implementation: solutionsImplementation
    };

    const solutions = await Solution.find()
      .populate('submittedBy', 'name organization')
      .populate('challenge', 'title category authoritySector')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 6. Industry Collaborations List & Metrics
    const [
      collabsPending,
      collabsAccepted,
      collabsRejected
    ] = await Promise.all([
      Collaboration.countDocuments({ status: 'PENDING' }),
      Collaboration.countDocuments({ status: { $in: ['ACCEPTED', 'APPROVED'] } }),
      Collaboration.countDocuments({ status: 'REJECTED' })
    ]);

    const collaborationsMetrics = {
      pending: collabsPending,
      accepted: collabsAccepted,
      rejected: collabsRejected
    };

    const collaborations = await Collaboration.find()
      .populate('industry', 'name organization industrySector email')
      .populate({
        path: 'proposal',
        select: 'title submittedBy',
        populate: { path: 'submittedBy', select: 'name organization' }
      })
      .populate('challenge', 'title category')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.render('admin/dashboard', {
      activePath: '/admin/dashboard',
      user: req.user,
      overview,
      accounts,
      problems,
      problemsMetrics,
      challenges,
      challengesMetrics,
      solutions,
      solutionsMetrics,
      collaborations,
      collaborationsMetrics
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminLogin,
  postAdminLogin,
  getAdminDashboard
};
