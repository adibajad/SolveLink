const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const Collaboration = require('../models/Collaboration');
const User = require('../models/User');
const matchingService = require('../services/matchingService');

/**
 * Industry Partner Command Center Dashboard
 */
const getIndustryDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    // 1. Fetch Active Published Challenges
    const rawChallenges = await Challenge.find({
      status: { $in: ['PUBLISHED', 'OPEN', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    const rankedChallenges = matchingService.rankChallengesForUser(rawChallenges, currentUser);

    // 2. Fetch University Solutions open for industry partnership/scaling
    const rawSolutions = await Solution.find({
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'IMPLEMENTATION'] }
    })
      .populate('challenge')
      .populate('submittedBy', 'name organization location email')
      .sort({ createdAt: -1 })
      .lean();

    const rankedSolutions = matchingService.rankSolutionsForIndustry(rawSolutions, currentUser);

    // 3. Fetch My Submitted Collaborations
    const myCollaborations = await Collaboration.find({ industry: userId })
      .populate({
        path: 'proposal',
        populate: { path: 'challenge' }
      })
      .populate('challenge', 'title category location department')
      .sort({ createdAt: -1 })
      .lean();

    // 4. Compute Metrics
    const metrics = {
      activeChallengesCount: rawChallenges.length,
      matchedSolutionsCount: rankedSolutions.filter(s => (s.synergyScore || 0) >= 50).length,
      collaborationsCount: myCollaborations.length,
      topSynergyScore: rankedSolutions.length > 0 ? (rankedSolutions[0].synergyScore || 0) : 0
    };

    res.render('industry/dashboard', {
      activePath: '/industry/dashboard',
      user: currentUser,
      recommendedSolutions: rankedSolutions.slice(0, 4),
      recommendedChallenges: rankedChallenges.slice(0, 4),
      myCollaborations,
      metrics,
      collaboratedMsg: req.query.collaborated === 'true'
        ? 'Your collaboration inquiry has been successfully registered with the authority and university team!'
        : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Browse University Solutions seeking Industry Scaling & Pilot Execution
 */
const getIndustrySolutions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    const { domain, skill, q, status } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'IMPLEMENTATION'] };
    }

    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { technicalApproach: new RegExp(q, 'i') }
      ];
    }

    if (skill) {
      filter.$or = [
        { skills: new RegExp(skill, 'i') },
        { technology: new RegExp(skill, 'i') }
      ];
    }

    let solutions = await Solution.find(filter)
      .populate('challenge')
      .populate('submittedBy', 'name organization location email')
      .sort({ createdAt: -1 })
      .lean();

    // If domain filter applied, filter by challenge category
    if (domain) {
      solutions = solutions.filter(s => s.challenge && s.challenge.category === domain);
    }

    const rankedSolutions = matchingService.rankSolutionsForIndustry(solutions, currentUser);

    res.render('industry/solutions', {
      activePath: '/industry/solutions',
      user: currentUser,
      solutions: rankedSolutions,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
};

/**
 * View University Solution Details from Industry Perspective
 */
const getIndustrySolutionDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('industry/solutions', {
        activePath: '/industry/solutions',
        user: currentUser,
        solutions: [],
        query: {},
        error: 'Solution proposal not found.'
      });
    }

    const solution = await Solution.findById(id)
      .populate('challenge')
      .populate('submittedBy', 'name organization location email')
      .lean();

    if (!solution) {
      return res.status(404).render('industry/solutions', {
        activePath: '/industry/solutions',
        user: currentUser,
        solutions: [],
        query: {},
        error: 'Solution proposal not found.'
      });
    }

    // Check if industry user already expressed collaboration
    const existingCollaboration = await Collaboration.findOne({
      proposal: solution._id,
      industry: userId
    }).lean();

    const matchAnalysis = matchingService.calculateIndustrySolutionMatch(solution, currentUser);

    res.render('industry/solution-detail', {
      activePath: '/industry/solutions',
      user: currentUser,
      solution,
      existingCollaboration,
      matchAnalysis,
      successMsg: req.query.collaborated ? 'Collaboration request submitted successfully!' : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Industry Collaboration Proposal Submission
 */
const postExpressCollaboration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supportType = 'PILOT_IMPLEMENTATION', message = '' } = req.body;
    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid solution ID.' });
    }

    const solution = await Solution.findById(id).populate('challenge');
    if (!solution) {
      return res.status(404).json({ error: 'Solution proposal not found.' });
    }

    const challengeId = solution.challenge?._id || solution.challenge;

    // Check if collaboration already recorded
    let collaboration = await Collaboration.findOne({
      proposal: id,
      industry: userId
    });

    if (collaboration) {
      collaboration.supportType = supportType;
      collaboration.message = message.trim();
      collaboration.status = 'INTERESTED';
      await collaboration.save();
    } else {
      collaboration = await Collaboration.create({
        proposal: id,
        challenge: challengeId,
        industry: userId,
        supportType,
        message: message.trim(),
        status: 'INTERESTED'
      });

      // Update challenge interested counter
      if (challengeId) {
        await Challenge.findByIdAndUpdate(challengeId, {
          $inc: { interestedCount: 1 }
        });
      }
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: 'Collaboration proposal successfully submitted to the authority and university lab.',
        collaborationId: collaboration._id
      });
    }

    res.redirect(`/industry/solutions/${id}?collaborated=true`);
  } catch (error) {
    console.error('[Industry Collaboration Error]', error);
    next(error);
  }
};

module.exports = {
  getIndustryDashboard,
  getIndustrySolutions,
  getIndustrySolutionDetail,
  postExpressCollaboration
};
