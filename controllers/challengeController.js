const mongoose = require('mongoose');
const User = require('../models/User');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const Collaboration = require('../models/Collaboration');
const aiService = require('../services/aiService');
const matchingService = require('../services/matchingService');

/**
 * Authority Command Center Dashboard
 */
const getAuthorityDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;
    const isAuthority = currentUser.role === 'authority';
    const isAdmin = currentUser.role === 'admin';

    // Build scoped filter for authority
    let problemScopeFilter = {};
    if (isAuthority && !isAdmin) {
      const sector = currentUser.authoritySector || '';
      problemScopeFilter = {
        $or: [
          { assignedAuthority: userId },
          ...(sector ? [{ 'aiClassification.domain': sector }] : [])
        ]
      };
    }

    // 1. Core Metrics
    const totalProblems = await Problem.countDocuments(problemScopeFilter);
    const pendingVerification = await Problem.countDocuments({
      ...problemScopeFilter,
      status: { $in: ['REPORTED', 'UNDER_VERIFICATION'] }
    });

    const challengeScope = isAuthority && !isAdmin ? { createdBy: userId } : {};
    const activeChallenges = await Challenge.countDocuments({
      ...challengeScope,
      status: { $in: ['PUBLISHED', 'DRAFT', 'OPEN'] }
    });

    const myChallenges = await Challenge.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .lean();
    const myChallengeIds = myChallenges.map(c => c._id);

    const totalSolutions = await Solution.countDocuments(
      isAuthority && !isAdmin ? { challenge: { $in: myChallengeIds } } : {}
    );
    const implementations = await Challenge.countDocuments({
      ...challengeScope,
      status: { $in: ['APPROVED', 'IMPLEMENTATION', 'COMPLETED', 'SOLUTION_SELECTED'] }
    });

    const metrics = {
      totalProblems,
      pendingVerification,
      activeChallenges,
      totalSolutions,
      implementations
    };

    // 2. High Priority Problems requiring verification (scoped to this authority)
    const priorityProblems = await Problem.find({
      ...problemScopeFilter,
      status: { $in: ['REPORTED', 'UNDER_VERIFICATION'] }
    })
      .populate('assignedAuthority', 'name organization department authoritySector')
      .populate('reportedBy', 'name organization')
      .sort({ severity: -1, createdAt: -1 })
      .limit(6)
      .lean();

    // 3. Solutions pending review on authority's challenges
    const pendingSolutions = await Solution.find({
      ...(isAuthority && !isAdmin ? { challenge: { $in: myChallengeIds } } : {}),
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }
    })
      .populate('challenge', 'title category')
      .populate('submittedBy', 'name organization')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.render('authority/dashboard', {
      activePath: '/authority/dashboard',
      user: currentUser,
      metrics,
      priorityProblems,
      myChallenges: myChallenges.slice(0, 4),
      pendingSolutions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authority Problem Management List
 */
const getAuthorityProblems = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userDoc = await User.findById(userId).lean();
    const currentUser = userDoc || req.user;
    const isAuthority = currentUser.role === 'authority';
    const isAdmin = currentUser.role === 'admin';

    const { status, category, domain, assignmentStatus, location, priority, q } = req.query;

    let filter = {};
    if (isAuthority && !isAdmin) {
      const sector = currentUser.authoritySector || '';
      filter = {
        $or: [
          { assignedAuthority: userId },
          ...(sector ? [{ 'aiClassification.domain': sector }] : [])
        ]
      };
    }

    if (status) filter.status = status;
    if (assignmentStatus) filter.assignmentStatus = assignmentStatus;
    if (domain) filter['aiClassification.domain'] = domain;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (location) filter.location = new RegExp(location, 'i');
    if (q) {
      const qRegex = new RegExp(q, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: qRegex },
          { description: qRegex },
          { location: qRegex }
        ]
      });
    }

    const problems = await Problem.find(filter)
      .populate('reportedBy', 'name organization')
      .populate('assignedAuthority', 'name organization department authoritySector jurisdiction')
      .sort({ createdAt: -1 })
      .lean();

    res.render('authority/problems', {
      activePath: '/authority/problems',
      user: currentUser,
      problems,
      sectors: aiService.CIVIC_SECTORS,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authority Problem Detail & Triage Console
 */
const getAuthorityProblemDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('authority/problems', {
        activePath: '/authority/problems',
        user: req.user,
        problems: [],
        sectors: aiService.CIVIC_SECTORS,
        query: {},
        error: 'Problem not found.'
      });
    }

    const problem = await Problem.findById(id)
      .populate('reportedBy', 'name email organization location role')
      .populate('assignedAuthority', 'name email organization department authoritySector jurisdiction')
      .populate('supporters', 'name role')
      .populate('similarProblems', 'title category location status priority createdAt')
      .lean();

    if (!problem) {
      return res.status(404).render('authority/problems', {
        activePath: '/authority/problems',
        user: req.user,
        problems: [],
        sectors: aiService.CIVIC_SECTORS,
        query: {},
        error: 'Problem not found.'
      });
    }

    // Check if challenge exists for this problem
    const associatedChallenge = await Challenge.findOne({ sourceProblem: problem._id }).lean();

    res.render('authority/problem-detail', {
      activePath: '/authority/problems',
      user: req.user,
      problem,
      associatedChallenge,
      sectors: aiService.CIVIC_SECTORS,
      successMsg: req.query.updated ? 'Problem updated successfully.' : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Problem Verification Status & Reassignment
 */
const postUpdateProblemStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, correctedDomain, reassignNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid problem ID.' });
    }

    const validStatuses = [
      'REPORTED',
      'UNDER_VERIFICATION',
      'REJECTED',
      'ALREADY_RESOLVED',
      'VERIFIED',
      'CHALLENGE_CREATED'
    ];

    const updateFields = {};

    if (status && validStatuses.includes(status)) {
      updateFields.status = status;
      if (status === 'VERIFIED') {
        updateFields.assignmentStatus = 'verified';
      }
    }

    // Handle classification correction or reassignment
    if (correctedDomain && correctedDomain.trim()) {
      const cleanDomain = correctedDomain.trim().toLowerCase();
      const existingProb = await Problem.findById(id);

      if (existingProb) {
        updateFields['aiClassification.domain'] = cleanDomain;
        const sectorObj = aiService.CIVIC_SECTORS.find(s => s.key === cleanDomain);
        if (sectorObj) {
          updateFields.category = sectorObj.label;
        }

        // Re-route problem via matching engine
        const reRouteResult = await matchingService.matchAuthorityForProblem(
          {
            domain: cleanDomain,
            category: existingProb.aiClassification?.category || '',
            subCategory: existingProb.aiClassification?.subCategory || ''
          },
          existingProb.location
        );

        updateFields.assignedAuthority = reRouteResult.bestAuthority ? reRouteResult.bestAuthority._id : null;
        updateFields.assignmentStatus = reRouteResult.assignmentStatus;
        updateFields.assignmentReason = `Reassigned by authority: ${reRouteResult.assignmentReason}${reassignNotes ? ' Note: ' + reassignNotes.trim() : ''}`;
      }
    }

    const updated = await Problem.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({ success: true, problem: updated });
    }

    res.redirect(`/authority/problems/${id}?updated=true`);
  } catch (error) {
    next(error);
  }
};

/**
 * Merge / Link Duplicate Problem
 */
const postLinkDuplicateProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetProblemId, markResolved } = req.body;

    if (!targetProblemId) {
      return res.status(400).json({ error: 'Target problem ID required.' });
    }

    // Reciprocal link
    await Problem.findByIdAndUpdate(id, {
      $addToSet: { similarProblems: targetProblemId },
      ...(markResolved === 'true' ? { status: 'ALREADY_RESOLVED' } : {})
    });

    await Problem.findByIdAndUpdate(targetProblemId, {
      $addToSet: { similarProblems: id }
    });

    res.redirect(`/authority/problems/${id}?updated=true`);
  } catch (error) {
    next(error);
  }
};

/**
 * Render Create Challenge Form
 */
const getCreateChallenge = async (req, res, next) => {
  try {
    const { problemId } = req.query;
    let sourceProblem = null;

    if (problemId) {
      sourceProblem = await Problem.findById(problemId).lean();
    }

    const defaultSector = sourceProblem?.aiClassification?.domain || req.user.authoritySector || 'municipal_corporation';

    // Default prefilled values from verified problem or blank
    const prefill = {
      sourceProblemId: sourceProblem ? sourceProblem._id : '',
      title: sourceProblem ? `Innovation Challenge: ${sourceProblem.title}` : '',
      description: sourceProblem ? sourceProblem.description : '',
      category: sourceProblem ? sourceProblem.category : 'Infrastructure',
      domain: sourceProblem?.category || 'Infrastructure',
      authoritySector: defaultSector,
      location: sourceProblem ? sourceProblem.location : (req.user.location || 'Jharkhand'),
      department: req.user.department || req.user.organization || 'District Municipal Administration',
      expectedOutcome: sourceProblem?.aiAnalysis?.summary 
        ? `Deploy a tested engineering prototype and operational system to resolve the root cause: "${sourceProblem.aiAnalysis.summary}".` 
        : '',
      requiredSkills: sourceProblem?.aiAnalysis?.tags?.length 
        ? sourceProblem.aiAnalysis.tags.join(', ') 
        : 'Civil Engineering, IoT, Field Prototyping',
      requiredTechnologies: '',
      constraints: 'Cost must remain within standard district grant limits; Solutions must use locally serviceable components.',
      requirements: 'Must comply with municipal safety norms and use open telemetry standards.',
      evaluationCriteria: 'Technical Feasibility (30%), Cost Efficiency (25%), Community Impact (25%), Scalability (20%)',
      deadline: ''
    };

    res.render('authority/create-challenge', {
      activePath: '/authority/create-challenge',
      user: req.user,
      sourceProblem,
      sectors: aiService.CIVIC_SECTORS,
      prefill,
      error: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Create Challenge Submission
 */
const postCreateChallenge = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      domain,
      authoritySector,
      location,
      department,
      requiredSkills,
      requiredTechnologies,
      constraints,
      requirements,
      expectedOutcome,
      evaluationCriteria,
      deadline,
      sourceProblemId,
      action
    } = req.body;

    const userId = req.user.id || req.user._id;

    if (!title || !description || (!category && !domain) || !department) {
      return res.status(400).render('authority/create-challenge', {
        activePath: '/authority/create-challenge',
        user: req.user,
        sourceProblem: sourceProblemId ? await Problem.findById(sourceProblemId).lean() : null,
        sectors: aiService.CIVIC_SECTORS,
        prefill: req.body,
        error: 'Title, description, sector/category, and department are required fields.'
      });
    }

    // Parse array fields
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(s => s.length > 0);
      return String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
    };

    const status = action === 'publish' ? 'PUBLISHED' : 'DRAFT';
    const sectorKey = (authoritySector || req.user.authoritySector || 'municipal_corporation').trim().toLowerCase();
    const domainStr = (domain || category || 'General Civic').trim();

    // Verify source problem or find fallback
    let sourceId = sourceProblemId;
    if (!sourceId) {
      const dummyProblem = await Problem.findOne({ status: 'VERIFIED' });
      if (dummyProblem) sourceId = dummyProblem._id;
      else {
        // Create an institutional verified seed problem
        const seedProblem = await Problem.create({
          title: `Municipal Brief: ${title}`,
          description: description,
          category: domainStr,
          location: location || 'District Jurisdiction',
          reportedBy: userId,
          status: 'VERIFIED'
        });
        sourceId = seedProblem._id;
      }
    }

    const skillsList = parseList(requiredSkills);
    const techList = parseList(requiredTechnologies);
    const constraintsList = parseList(constraints || requirements);
    const requirementsList = parseList(requirements || constraints);

    // If linked to a source problem, inherit its evidence images
    let challengeImage = '';
    let challengeImages = [];
    if (sourceId) {
      const sourceProblemDoc = await Problem.findById(sourceId).lean();
      if (sourceProblemDoc && sourceProblemDoc.images && sourceProblemDoc.images.length > 0) {
        challengeImages = sourceProblemDoc.images;
        challengeImage = sourceProblemDoc.images[0];
      }
    }

    const newChallenge = await Challenge.create({
      title: title.trim(),
      description: description.trim(),
      category: domainStr,
      domainName: domainStr,
      authoritySector: sectorKey,
      location: location ? location.trim() : '',
      department: department.trim(),
      image: challengeImage,
      images: challengeImages,
      requiredSkills: skillsList,
      requiredTechnologies: techList,
      constraints: constraintsList,
      requirements: requirementsList,
      expectedOutcome: expectedOutcome ? expectedOutcome.trim() : '',
      evaluationCriteria: parseList(evaluationCriteria),
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 30 * 86400000),
      status,
      sourceProblem: sourceId,
      createdBy: userId
    });

    // Update source problem status to CHALLENGE_CREATED
    if (sourceId) {
      await Problem.findByIdAndUpdate(sourceId, { status: 'CHALLENGE_CREATED' });
    }

    res.redirect(`/challenges/${newChallenge._id}`);
  } catch (error) {
    console.error('[Create Challenge Error]', error);
    res.status(500).render('authority/create-challenge', {
      activePath: '/authority/create-challenge',
      user: req.user,
      sourceProblem: null,
      sectors: aiService.CIVIC_SECTORS,
      prefill: req.body,
      error: 'Failed to create challenge due to a server error.'
    });
  }
};

/**
 * Authority Solutions List
 */
const getAuthoritySolutions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { status, challengeId } = req.query;

    // Find all challenges created by this authority
    const myChallenges = await Challenge.find({ createdBy: userId }).select('_id title').lean();
    const challengeIds = myChallenges.map(c => c._id);

    const filter = {
      $or: [
        { challenge: { $in: challengeIds } },
        { 'evaluation.evaluatedBy': userId }
      ]
    };

    // If user is admin or no challenges created yet, allow viewing all submissions
    if (challengeIds.length === 0 || req.user.role === 'admin') {
      delete filter.$or;
    }

    if (status) filter.status = status;
    if (challengeId) filter.challenge = challengeId;

    const solutions = await Solution.find(filter)
      .populate('challenge', 'title category status deadline department')
      .populate('submittedBy', 'name email organization role')
      .sort({ createdAt: -1 })
      .lean();

    res.render('authority/solutions', {
      activePath: '/authority/solutions',
      user: req.user,
      solutions,
      myChallenges,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authority Solution Detail & Evaluation Rubric
 */
const getAuthoritySolutionDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('authority/solutions', {
        activePath: '/authority/solutions',
        user: req.user,
        solutions: [],
        myChallenges: [],
        query: {},
        error: 'Solution proposal not found.'
      });
    }

    const solution = await Solution.findById(id)
      .populate('challenge')
      .populate('submittedBy', 'name email organization role location')
      .populate('evaluation.evaluatedBy', 'name organization')
      .lean();

    if (!solution) {
      return res.status(404).render('authority/solutions', {
        activePath: '/authority/solutions',
        user: req.user,
        solutions: [],
        myChallenges: [],
        query: {},
        error: 'Solution proposal not found.'
      });
    }

    // Fetch any Industry Collaboration expressions for this proposal
    const industryCollaborations = await Collaboration.find({ proposal: solution._id })
      .populate('industry', 'name organization skills location email')
      .sort({ createdAt: -1 })
      .lean();

    res.render('authority/solution-detail', {
      activePath: '/authority/solutions',
      user: req.user,
      solution,
      industryCollaborations,
      successMsg: req.query.evaluated ? 'Evaluation submitted and decision recorded.' : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Solution Evaluation & Status Decision
 */
const postEvaluateSolution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      scoreFeasibility = 0,
      scoreCost = 0,
      scoreInnovation = 0,
      scoreImpact = 0,
      scoreScalability = 0,
      scoreSustainability = 0,
      feedback = '',
      decision
    } = req.body;

    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid solution ID.' });
    }

    // Calculate total score (out of 100)
    const totalScore = Math.min(
      100,
      Math.max(
        0,
        Number(scoreFeasibility) +
          Number(scoreCost) +
          Number(scoreInnovation) +
          Number(scoreImpact) +
          Number(scoreScalability) +
          Number(scoreSustainability)
      )
    );

    // Map decision to stable solution status
    let solutionStatus = 'UNDER_REVIEW';
    let challengeUpdateStatus = null;

    if (decision === 'SHORTLIST') {
      solutionStatus = 'SHORTLISTED';
    } else if (decision === 'REJECT') {
      solutionStatus = 'REJECTED';
    } else if (decision === 'SELECT') {
      solutionStatus = 'SELECTED';
      challengeUpdateStatus = 'SOLUTION_SELECTED';
    } else if (decision === 'IMPLEMENT') {
      solutionStatus = 'IMPLEMENTATION';
      challengeUpdateStatus = 'IMPLEMENTATION';
    } else if (decision === 'UNDER_REVIEW') {
      solutionStatus = 'UNDER_REVIEW';
      challengeUpdateStatus = 'UNDER_REVIEW';
    }

    const updatedSolution = await Solution.findByIdAndUpdate(
      id,
      {
        status: solutionStatus,
        evaluation: {
          score: totalScore,
          feedback: feedback.trim(),
          evaluatedBy: userId,
          evaluatedAt: new Date()
        }
      },
      { new: true }
    );

    // If decision impacts challenge lifecycle
    if (challengeUpdateStatus && updatedSolution.challenge) {
      await Challenge.findByIdAndUpdate(updatedSolution.challenge, {
        status: challengeUpdateStatus
      });
    }

    res.redirect(`/authority/solutions/${id}?evaluated=true`);
  } catch (error) {
    console.error('[Solution Evaluation Error]', error);
    next(error);
  }
};

module.exports = {
  getAuthorityDashboard,
  getAuthorityProblems,
  getAuthorityProblemDetail,
  postUpdateProblemStatus,
  postLinkDuplicateProblem,
  getCreateChallenge,
  postCreateChallenge,
  getAuthoritySolutions,
  getAuthoritySolutionDetail,
  postEvaluateSolution
};
