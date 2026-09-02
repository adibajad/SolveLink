const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');

/**
 * Authority Command Center Dashboard
 */
const getAuthorityDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. Core Metrics
    const totalProblems = await Problem.countDocuments();
    const pendingVerification = await Problem.countDocuments({
      status: { $in: ['REPORTED', 'UNDER_VERIFICATION'] }
    });
    const activeChallenges = await Challenge.countDocuments({
      status: { $in: ['PUBLISHED', 'DRAFT'] }
    });
    const totalSolutions = await Solution.countDocuments();
    const implementations = await Challenge.countDocuments({
      status: { $in: ['APPROVED', 'IMPLEMENTATION', 'COMPLETED'] }
    });

    const metrics = {
      totalProblems,
      pendingVerification,
      activeChallenges,
      totalSolutions,
      implementations
    };

    // 2. High Priority Problems requiring verification
    const priorityProblems = await Problem.find({
      status: { $in: ['REPORTED', 'UNDER_VERIFICATION'] }
    })
      .sort({ severity: -1, createdAt: -1 })
      .limit(6)
      .lean();

    // 3. Authority's Recent Challenges
    const myChallenges = await Challenge.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // 4. Solutions pending review
    const pendingSolutions = await Solution.find({
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] }
    })
      .populate('challenge', 'title category')
      .populate('submittedBy', 'name organization')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.render('authority/dashboard', {
      activePath: '/authority/dashboard',
      user: req.user,
      metrics,
      priorityProblems,
      myChallenges,
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
    const { status, category, location, priority, q } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (location) filter.location = new RegExp(location, 'i');
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') }
      ];
    }

    const problems = await Problem.find(filter)
      .populate('reportedBy', 'name organization')
      .sort({ createdAt: -1 })
      .lean();

    res.render('authority/problems', {
      activePath: '/authority/problems',
      user: req.user,
      problems,
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

    const problem = await Problem.findById(id)
      .populate('reportedBy', 'name email organization location role')
      .populate('supporters', 'name role')
      .populate('similarProblems', 'title category location status priority createdAt')
      .lean();

    if (!problem) {
      return res.status(404).render('authority/problems', {
        activePath: '/authority/problems',
        user: req.user,
        problems: [],
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
      successMsg: req.query.updated ? 'Problem status updated successfully.' : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Problem Verification Status
 */
const postUpdateProblemStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      'REPORTED',
      'UNDER_VERIFICATION',
      'REJECTED',
      'ALREADY_RESOLVED',
      'VERIFIED',
      'CHALLENGE_CREATED'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid problem status.' });
    }

    const updated = await Problem.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({ success: true, status: updated.status });
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

    // Default prefilled values from verified problem or blank
    const prefill = {
      sourceProblemId: sourceProblem ? sourceProblem._id : '',
      title: sourceProblem ? `Innovation Challenge: ${sourceProblem.title}` : '',
      description: sourceProblem ? sourceProblem.description : '',
      category: sourceProblem ? sourceProblem.category : 'Infrastructure',
      location: sourceProblem ? sourceProblem.location : (req.user.location || 'Jharkhand'),
      department: req.user.organization || 'District Municipal Administration',
      expectedOutcome: sourceProblem?.aiAnalysis?.summary 
        ? `Deploy a tested engineering prototype and operational system to resolve the root cause: "${sourceProblem.aiAnalysis.summary}".` 
        : '',
      requiredSkills: sourceProblem?.aiAnalysis?.tags?.length 
        ? sourceProblem.aiAnalysis.tags.join(', ') 
        : 'Civil Engineering, IoT, Field Prototyping',
      constraints: 'Cost must remain within standard district grant limits; Solutions must use locally serviceable components.',
      evaluationCriteria: 'Technical Feasibility (30%), Cost Efficiency (25%), Community Impact (25%), Scalability (20%)',
      deadline: ''
    };

    res.render('authority/create-challenge', {
      activePath: '/authority/create-challenge',
      user: req.user,
      sourceProblem,
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
      location,
      department,
      requiredSkills,
      constraints,
      expectedOutcome,
      evaluationCriteria,
      deadline,
      sourceProblemId,
      action
    } = req.body;

    const userId = req.user.id || req.user._id;

    if (!title || !description || !category || !department) {
      return res.status(400).render('authority/create-challenge', {
        activePath: '/authority/create-challenge',
        user: req.user,
        sourceProblem: sourceProblemId ? await Problem.findById(sourceProblemId).lean() : null,
        prefill: req.body,
        error: 'Title, description, category, and department are required fields.'
      });
    }

    // Parse array fields
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    };

    const status = action === 'publish' ? 'PUBLISHED' : 'DRAFT';

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
          category: category,
          location: location || 'District Jurisdiction',
          reportedBy: userId,
          status: 'VERIFIED'
        });
        sourceId = seedProblem._id;
      }
    }

    const newChallenge = await Challenge.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location ? location.trim() : '',
      department: department.trim(),
      requiredSkills: parseList(requiredSkills),
      constraints: parseList(constraints),
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

    res.render('authority/solution-detail', {
      activePath: '/authority/solutions',
      user: req.user,
      solution,
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
      solutionStatus = 'SELECTED';
      challengeUpdateStatus = 'IMPLEMENTATION';
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
