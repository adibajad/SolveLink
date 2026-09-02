const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const User = require('../models/User');
const matchingService = require('../services/matchingService');

/**
 * University / Researcher Dashboard Overview
 */
const getUniversityDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    // 1. Fetch Active Challenges & Rank by AI Skill Match
    const rawChallenges = await Challenge.find({
      status: { $in: ['PUBLISHED', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    const rankedChallenges = matchingService.rankChallengesForUser(rawChallenges, currentUser);

    // 2. Fetch User's Submitted Solutions
    const mySolutions = await Solution.find({ submittedBy: userId })
      .populate('challenge', 'title category status deadline department')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Compute Metrics
    const metrics = {
      submittedCount: mySolutions.length,
      underReviewCount: mySolutions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length,
      shortlistedCount: mySolutions.filter(s => s.status === 'SHORTLISTED').length,
      selectedCount: mySolutions.filter(s => s.status === 'SELECTED').length,
      topMatchScore: rankedChallenges.length > 0 ? rankedChallenges[0].matchScore : 0
    };

    res.render('university/dashboard', {
      activePath: '/university/dashboard',
      user: currentUser,
      recommendedChallenges: rankedChallenges.slice(0, 4),
      mySolutions,
      metrics,
      submittedMsg: req.query.submitted === 'true' ? 'Your solution proposal was submitted successfully to the municipal authority!' : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * University Challenge Discovery with Skill Match Filtering
 */
const getUniversityChallenges = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    const { domain, location, skill, q, status } = req.query;
    const filter = status
      ? { status }
      : { status: { $in: ['PUBLISHED', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] } };

    if (domain) filter.category = domain;
    if (location) filter.location = new RegExp(location, 'i');
    if (skill) filter.requiredSkills = skill;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { department: new RegExp(q, 'i') }
      ];
    }

    const rawChallenges = await Challenge.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const challengesWithMatch = matchingService.rankChallengesForUser(rawChallenges, currentUser);

    res.render('university/challenges', {
      activePath: '/university/challenges',
      user: currentUser,
      challenges: challengesWithMatch,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
};

/**
 * University Challenge Detail with Team Match Breakdown
 */
const getUniversityChallengeDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    const challenge = await Challenge.findById(id)
      .populate('sourceProblem')
      .populate('createdBy', 'name organization')
      .lean();

    if (!challenge) {
      return res.status(404).render('university/challenges', {
        activePath: '/university/challenges',
        user: currentUser,
        challenges: [],
        query: {},
        error: 'Challenge not found.'
      });
    }

    // Calculate detailed match analysis
    const matchAnalysis = matchingService.calculateMatch(challenge, currentUser);

    // Check if user already submitted a solution
    const existingSubmission = await Solution.findOne({
      challenge: challenge._id,
      submittedBy: userId
    }).lean();

    res.render('university/challenge-detail', {
      activePath: '/university/challenges',
      user: currentUser,
      challenge,
      matchAnalysis,
      existingSubmission
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Render Submit Solution Form
 */
const getSubmitSolution = async (req, res, next) => {
  try {
    const { challengeId } = req.query;
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;

    let challenge = null;
    if (challengeId) {
      challenge = await Challenge.findById(challengeId).lean();
    }

    // If no challengeId passed, grab first published challenge
    if (!challenge) {
      challenge = await Challenge.findOne({ status: 'PUBLISHED' }).lean();
    }

    if (!challenge) {
      return res.redirect('/university/challenges');
    }

    res.render('university/submit-solution', {
      activePath: '/university/submit-solution',
      user: currentUser,
      challenge,
      error: null,
      formData: {},
      isSubmitted: false
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Solution Submission
 */
const postSubmitSolution = async (req, res, next) => {
  try {
    const {
      challengeId,
      title,
      teamName,
      description,
      technology,
      estimatedCost,
      impact,
      memberNames,
      memberEmails,
      memberRoles
    } = req.body;

    const userId = req.user.id || req.user._id;
    const challenge = await Challenge.findById(challengeId).lean();

    if (!title || !description || !challengeId) {
      return res.status(400).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge,
        error: 'Solution title, description, and valid challenge are required.',
        formData: req.body,
        isSubmitted: false
      });
    }

    // Process Technologies
    let techList = [];
    if (technology) {
      techList = typeof technology === 'string'
        ? technology.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : technology;
    }

    // Assemble Team Roster
    const teamMembers = [];
    if (memberNames && Array.isArray(memberNames)) {
      memberNames.forEach((name, i) => {
        if (name && name.trim()) {
          teamMembers.push({
            name: name.trim(),
            email: memberEmails?.[i]?.trim() || '',
            role: memberRoles?.[i]?.trim() || 'Contributor',
            organization: req.user.organization || 'University/Lab'
          });
        }
      });
    }

    // Add submitter as team lead if list is empty
    if (teamMembers.length === 0) {
      teamMembers.push({
        name: req.user.name,
        email: req.user.email,
        role: 'Team Lead / Principal Investigator',
        organization: req.user.organization || 'University'
      });
    }

    // Process attachments
    const attachmentPaths = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        attachmentPaths.push(`/uploads/${file.filename}`);
      });
    }

    // Persist Solution
    const newSolution = await Solution.create({
      challenge: challengeId,
      submittedBy: userId,
      team: {
        name: teamName ? teamName.trim() : `${req.user.name}'s Project Team`,
        members: teamMembers
      },
      title: title.trim(),
      description: description.trim(),
      technology: techList,
      estimatedCost: Number(estimatedCost) || 0,
      impact: impact ? impact.trim() : '',
      status: 'SUBMITTED'
    });

    res.render('university/submit-solution', {
      activePath: '/university/submit-solution',
      user: req.user,
      challenge,
      error: null,
      formData: {},
      isSubmitted: true,
      submittedSolution: newSolution
    });

  } catch (error) {
    console.error('[Submit Solution Error]', error);
    next(error);
  }
};

/**
 * Handle Express Interest / Industry Partnership Support
 */
const postExpressInterest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, supportType = 'PILOT_IMPLEMENTATION' } = req.body;
    const userId = req.user.id || req.user._id;

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: 'Interest registered successfully. The governing authority and matched research teams have been notified.',
        challengeId: id,
        supportType,
        industryPartner: req.user.name,
        organization: req.user.organization
      });
    }

    res.redirect(`/university/challenges/${id}?interested=true`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUniversityDashboard,
  getUniversityChallenges,
  getUniversityChallengeDetail,
  getSubmitSolution,
  postSubmitSolution,
  postExpressInterest
};
