const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const Collaboration = require('../models/Collaboration');
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
      status: { $in: ['PUBLISHED', 'OPEN', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    const rankedChallenges = matchingService.rankChallengesForUser(rawChallenges, currentUser);

    // 2. Fetch User's & University's Submitted Solutions
    // Matches proposals belonging to authenticated university by:
    // - Submitter ID matching authenticated user ID
    // - Explicit university / institute reference matching user ID
    // - Institutional organization match if logged in as university
    const userOrg = (currentUser.organization || currentUser.department || '').trim();
    const queryConditions = [
      { submittedBy: userId },
      { university: userId },
      { universityId: userId }
    ];

    if (userOrg && currentUser.role === 'university') {
      const escapedOrg = userOrg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orgRegex = new RegExp('^' + escapedOrg, 'i');
      queryConditions.push({ organization: orgRegex });
      queryConditions.push({ institute: orgRegex });
      queryConditions.push({ 'team.members.organization': orgRegex });
    }

    const mySolutions = await Solution.find({ $or: queryConditions })
      .populate('challenge', 'title category status deadline department location')
      .populate('submittedBy', 'name email organization role')
      .populate('university', 'name email organization role')
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fetch any Industry Collaborations received on user's solutions
    const solutionIds = mySolutions.map(s => s._id);
    const industryCollaborations = await Collaboration.find({
      proposal: { $in: solutionIds }
    })
      .populate('industry', 'name organization skills location email')
      .populate('proposal', 'title')
      .sort({ createdAt: -1 })
      .lean();

    // 4. Compute Metrics
    const metrics = {
      submittedCount: mySolutions.length,
      underReviewCount: mySolutions.filter(s => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW').length,
      shortlistedCount: mySolutions.filter(s => s.status === 'SHORTLISTED').length,
      selectedCount: mySolutions.filter(s => s.status === 'SELECTED' || s.status === 'IMPLEMENTATION' || s.status === 'ACCEPTED').length,
      industryInquiriesCount: industryCollaborations.length,
      topMatchScore: rankedChallenges.length > 0 ? rankedChallenges[0].matchScore : 0
    };

    res.render('university/dashboard', {
      activePath: '/university/dashboard',
      user: currentUser,
      recommendedChallenges: rankedChallenges.slice(0, 4),
      mySolutions,
      industryCollaborations,
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
      : { status: { $in: ['PUBLISHED', 'OPEN', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] } };

    if (domain) filter.category = domain;
    if (location) filter.location = new RegExp(location, 'i');
    if (skill) filter.requiredSkills = new RegExp('^' + skill + '$', 'i');
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('university/challenges', {
        activePath: '/university/challenges',
        user: currentUser,
        challenges: [],
        query: {},
        error: 'Challenge not found.'
      });
    }

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

    // Check if user or university already submitted a solution
    const existingSubmission = await Solution.findOne({
      challenge: challenge._id,
      $or: [
        { submittedBy: userId },
        { university: userId },
        { universityId: userId }
      ]
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

    // Fetch all active challenges accepting proposals
    const availableChallenges = await Challenge.find({
      status: { $in: ['PUBLISHED', 'OPEN'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    let selectedChallenge = null;

    if (challengeId && mongoose.Types.ObjectId.isValid(challengeId)) {
      selectedChallenge = availableChallenges.find(c => c._id.toString() === challengeId.toString())
        || await Challenge.findById(challengeId).lean();
    }

    // Default to the first published challenge if none selected
    if (!selectedChallenge && availableChallenges.length > 0) {
      selectedChallenge = availableChallenges[0];
    }

    res.render('university/submit-solution', {
      activePath: '/university/submit-solution',
      user: currentUser,
      challenge: selectedChallenge,
      availableChallenges,
      error: null,
      formData: {},
      isSubmitted: false
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Solution Proposal Submission
 */
const postSubmitSolution = async (req, res, next) => {
  try {
    const {
      challengeId,
      title,
      teamName,
      description,
      technicalApproach,
      skills,
      technology,
      estimatedCost,
      impact,
      implementationDetails,
      memberNames,
      memberEmails,
      memberRoles
    } = req.body;

    const userId = req.user.id || req.user._id;

    // Fetch all available published challenges for re-rendering if error occurs
    const availableChallenges = await Challenge.find({
      status: { $in: ['PUBLISHED', 'OPEN'] }
    })
      .sort({ createdAt: -1 })
      .lean();

    // 1. Validate Challenge ID format
    if (!challengeId || !mongoose.Types.ObjectId.isValid(challengeId)) {
      return res.status(400).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge: availableChallenges[0] || null,
        availableChallenges,
        error: 'Please select a valid innovation challenge to submit your proposal.',
        formData: req.body,
        isSubmitted: false
      });
    }

    // 2. Validate Challenge existence & status
    const challenge = await Challenge.findById(challengeId).lean();
    if (!challenge) {
      return res.status(404).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge: availableChallenges[0] || null,
        availableChallenges,
        error: 'The requested challenge does not exist or has been removed.',
        formData: req.body,
        isSubmitted: false
      });
    }

    if (challenge.status !== 'PUBLISHED' && challenge.status !== 'OPEN') {
      return res.status(400).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge,
        availableChallenges,
        error: `This challenge is currently ${challenge.status.replace('_', ' ').toLowerCase()} and is not accepting new proposals.`,
        formData: req.body,
        isSubmitted: false
      });
    }

    // 3. Prevent duplicate proposals by the same university team
    const existingSubmission = await Solution.findOne({
      challenge: challenge._id,
      $or: [
        { submittedBy: userId },
        { university: userId },
        { universityId: userId }
      ]
    }).lean();

    if (existingSubmission) {
      return res.status(400).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge,
        availableChallenges,
        error: `Your team has already submitted a proposal ("${existingSubmission.title}") for this challenge. You can review its evaluation in your dashboard.`,
        formData: req.body,
        isSubmitted: false
      });
    }

    // 4. Validate Required Content Fields
    if (!title || !title.trim() || !description || !description.trim()) {
      return res.status(400).render('university/submit-solution', {
        activePath: '/university/submit-solution',
        user: req.user,
        challenge,
        availableChallenges,
        error: 'Proposal title and technical description are required fields.',
        formData: req.body,
        isSubmitted: false
      });
    }

    // 5. Process Skills & Technologies
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => s.trim()).filter(s => s.length > 0);
      return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    };

    const techList = parseList(technology);
    const skillList = parseList(skills);

    // 6. Assemble Team Roster
    const instituteOrg = req.user.organization || req.user.department || '';
    const teamMembers = [];
    if (memberNames && Array.isArray(memberNames)) {
      memberNames.forEach((name, i) => {
        if (name && name.trim()) {
          teamMembers.push({
            name: name.trim(),
            email: memberEmails?.[i]?.trim() || '',
            role: memberRoles?.[i]?.trim() || 'Contributor',
            organization: instituteOrg || 'University/Lab'
          });
        }
      });
    }

    if (teamMembers.length === 0) {
      teamMembers.push({
        name: req.user.name,
        email: req.user.email,
        role: 'Team Lead / Principal Investigator',
        organization: instituteOrg || 'University'
      });
    }

    // 7. Process File Attachments
    const attachmentPaths = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        attachmentPaths.push(`/uploads/${file.filename}`);
      });
    }

    // 8. Persist Solution in MongoDB with explicit university and institution linkage
    const newSolution = await Solution.create({
      challenge: challenge._id,
      submittedBy: userId,
      university: userId,
      universityId: userId,
      organization: instituteOrg,
      institute: instituteOrg,
      team: {
        name: teamName && teamName.trim() ? teamName.trim() : `${req.user.name}'s Project Team`,
        members: teamMembers
      },
      title: title.trim(),
      description: description.trim(),
      technicalApproach: technicalApproach ? technicalApproach.trim() : '',
      skills: skillList,
      technology: techList,
      estimatedCost: Number(estimatedCost) || 0,
      impact: impact ? impact.trim() : '',
      implementationDetails: implementationDetails ? implementationDetails.trim() : '',
      attachments: attachmentPaths,
      status: 'SUBMITTED'
    });

    // 9. Increment challenge interested & solutions counter
    await Challenge.findByIdAndUpdate(challenge._id, {
      $inc: { interestedCount: 1 }
    });

    res.render('university/submit-solution', {
      activePath: '/university/submit-solution',
      user: req.user,
      challenge,
      availableChallenges,
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Invalid challenge ID.' });
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }

    // Update challenge interested counter
    await Challenge.findByIdAndUpdate(id, {
      $inc: { interestedCount: 1 }
    });

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
