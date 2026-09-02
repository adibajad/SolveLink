const fs = require('fs');
const path = require('path');
const Problem = require('../models/Problem');
const Challenge = require('../models/Challenge');
const Solution = require('../models/Solution');
const aiService = require('../services/aiService');
const duplicateService = require('../services/duplicateService');
const matchingService = require('../services/matchingService');

/**
 * Community Problems Discovery Page (/problems)
 */
const getCommunityProblems = async (req, res, next) => {
  try {
    const currentUser = req.user || (req.session && req.session.user) || null;
    const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;
    const { q, category, location, status, priority, sort = 'newest' } = req.query;

    const filter = { status: { $ne: 'REJECTED' } };

    if (category && category.trim()) {
      filter.category = category.trim();
    }

    if (status && status.trim()) {
      filter.status = status.trim();
    }

    if (priority && priority.trim()) {
      filter.priority = priority.trim().toUpperCase();
    }

    if (location && location.trim()) {
      filter.location = new RegExp(location.trim(), 'i');
    }

    if (q && q.trim()) {
      filter.$or = [
        { title: new RegExp(q.trim(), 'i') },
        { description: new RegExp(q.trim(), 'i') },
        { location: new RegExp(q.trim(), 'i') },
        { category: new RegExp(q.trim(), 'i') }
      ];
    }

    // Determine Base Sorting
    let sortObj = { createdAt: -1 };
    if (sort === 'newest') {
      sortObj = { createdAt: -1 };
    } else if (sort === 'recently_updated') {
      sortObj = { updatedAt: -1 };
    }

    let problems = await Problem.find(filter)
      .populate('reportedBy', 'name organization role')
      .populate('supporters', 'name')
      .sort(sortObj)
      .lean();

    // In-memory sort for 'most_supported' or 'highest_priority' if requested
    if (sort === 'most_supported') {
      problems.sort((a, b) => (b.supporters ? b.supporters.length : 0) - (a.supporters ? a.supporters.length : 0));
    } else if (sort === 'highest_priority') {
      const pWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      problems.sort((a, b) => (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0));
    }

    // Calculate Summary Statistics across all non-rejected problems
    const [totalReported, allNonRejected, totalUnderReview, totalVerified] = await Promise.all([
      Problem.countDocuments({ status: { $ne: 'REJECTED' } }),
      Problem.find({ status: { $ne: 'REJECTED' } }).select('supporters').lean(),
      Problem.countDocuments({ status: { $in: ['REPORTED', 'COMMUNITY_REVIEW', 'UNDER_VERIFICATION'] } }),
      Problem.countDocuments({ status: { $in: ['VERIFIED', 'CHALLENGE_CREATED'] } })
    ]);

    const communitySupported = allNonRejected.filter(p => p.supporters && p.supporters.length > 1).length;

    const stats = {
      totalReported,
      communitySupported,
      underReview: totalUnderReview,
      verified: totalVerified
    };

    const categories = [
      'Infrastructure',
      'Water & Sanitation',
      'Public Health',
      'Agriculture & Energy',
      'Waste Management',
      'Education & Digital'
    ];

    const districts = [
      'Ranchi', 'Dhanbad', 'Jamshedpur', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Palamu'
    ];

    res.render('citizen/community-problems', {
      activePath: '/problems',
      user: currentUser,
      currentUserId: currentUserId ? currentUserId.toString() : null,
      problems,
      stats,
      query: req.query || {},
      categories,
      districts
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Citizen Dashboard Overview
 */
const getCitizenDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. Fetch citizen's own reported problems
    const myProblems = await Problem.find({ reportedBy: userId })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch problems supported by this citizen
    const supportedProblems = await Problem.find({ 
      supporters: userId, 
      reportedBy: { $ne: userId } 
    })
      .populate('reportedBy', 'name organization')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // 3. Fetch community problems near citizen (or top active community problems)
    const nearbyProblems = await Problem.find({
      _id: { $nin: myProblems.map(p => p._id) },
      status: { $ne: 'REJECTED' }
    })
      .populate('reportedBy', 'name organization')
      .populate('supporters', 'name')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    // 4. Fetch active innovation challenges
    let activeChallenges = [];
    let totalChallengesCount = 0;
    try {
      const challengeQuery = { status: { $in: ['PUBLISHED', 'OPEN', 'SOLUTION_SELECTED', 'IMPLEMENTATION'] } };
      activeChallenges = await Challenge.find(challengeQuery)
        .populate('sourceProblem', 'title location images')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();
      totalChallengesCount = await Challenge.countDocuments(challengeQuery);
    } catch (e) {
      activeChallenges = [];
      totalChallengesCount = 0;
    }

    // 5. Fetch Recent Community Activity Feed
    const recentActivityReports = await Problem.find({ status: { $ne: 'REJECTED' } })
      .populate('reportedBy', 'name')
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();

    const recentActivities = [];
    
    recentActivityReports.forEach(p => {
      const supportersCount = p.supporters ? p.supporters.length : 1;
      const isUserReport = p.reportedBy && (p.reportedBy._id || p.reportedBy).toString() === userId.toString();

      if (isUserReport && p.status === 'UNDER_VERIFICATION') {
        recentActivities.push({
          type: 'status',
          badgeClass: 'badge-warning',
          title: 'Your problem report moved to Authority Review',
          detail: `"${p.title}" is currently under review by municipal authorities.`,
          time: p.updatedAt || p.createdAt,
          url: `/problems/${p._id}`
        });
      } else if (isUserReport && p.status === 'VERIFIED') {
        recentActivities.push({
          type: 'verified',
          badgeClass: 'badge-success',
          title: 'Your report was verified by local authorities',
          detail: `"${p.title}" in ${p.location} has been officially verified.`,
          time: p.updatedAt || p.createdAt,
          url: `/problems/${p._id}`
        });
      } else if (supportersCount > 1) {
        recentActivities.push({
          type: 'support',
          badgeClass: 'badge-primary',
          title: `Community issue gained ${supportersCount} supporters`,
          detail: `"${p.title}" in ${p.location} is receiving strong citizen backing.`,
          time: p.updatedAt || p.createdAt,
          url: `/problems/${p._id}`
        });
      } else {
        recentActivities.push({
          type: 'report',
          badgeClass: 'badge-neutral',
          title: `New problem reported in ${p.location}`,
          detail: `"${p.title}" was submitted for community discovery and review.`,
          time: p.createdAt,
          url: `/problems/${p._id}`
        });
      }
    });

    if (activeChallenges && activeChallenges.length > 0) {
      activeChallenges.slice(0, 2).forEach(ac => {
        recentActivities.push({
          type: 'challenge',
          badgeClass: 'badge-primary',
          title: `New Innovation Challenge published: ${ac.category}`,
          detail: `"${ac.title}" is open for engineering proposals from universities.`,
          time: ac.createdAt,
          url: `/challenges/${ac._id}`
        });
      });
    }

    recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // 6. Calculate metrics
    const stats = {
      reportedCount: myProblems.length,
      supportedCount: supportedProblems.length,
      verifiedCount: myProblems.filter(p => p.status === 'VERIFIED' || p.status === 'CHALLENGE_CREATED').length,
      challengesCount: totalChallengesCount || activeChallenges.length
    };

    res.render('citizen/dashboard', {
      activePath: '/citizen/dashboard',
      user: req.user,
      myProblems,
      supportedProblems,
      nearbyProblems,
      activeChallenges,
      recentActivities: recentActivities.slice(0, 4),
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Render Report Problem Form
 */
const getReportProblem = (req, res) => {
  res.render('citizen/report-problem', {
    activePath: '/citizen/report-problem',
    user: req.user,
    error: null,
    formData: {}
  });
};

/**
 * Handle Problem Submission
 */
const postReportProblem = async (req, res, next) => {
  const fs = require('fs');
  const path = require('path');

  // Helper to remove uploaded files if validation fails
  const cleanupFiles = (files) => {
    if (files && Array.isArray(files)) {
      files.forEach(file => {
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (e) {
          console.warn('[File Cleanup Warning]', e.message);
        }
      });
    }
  };

  try {
    const { title, description, location, locationText, latitude, longitude, optionalCategory, urgency, affectedPeople } = req.body;
    const userId = req.user.id || req.user._id;

    // 1. Mandatory Field Validations (Backend)
    const cleanTitle = title ? title.trim() : '';
    const cleanLocation = (locationText || location || '').trim();
    const cleanDescription = description ? description.trim() : '';
    const cleanUrgency = urgency ? urgency.trim().toUpperCase() : '';
    const cleanAffected = (affectedPeople || '').trim();
    const validUrgencies = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : NaN;
    const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : NaN;

    if (!cleanTitle) {
      cleanupFiles(req.files);
      const errorMsg = 'Problem Summary / Title is required and cannot be empty.';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    if (!cleanLocation) {
      cleanupFiles(req.files);
      const errorMsg = 'Location / Landmark / Ward is required and cannot be empty.';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    // Coordinate validation
    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90 || isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      cleanupFiles(req.files);
      const errorMsg = 'Valid geographic coordinates are required (Latitude between -90 and 90, Longitude between -180 and 180).';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    if (!cleanDescription) {
      cleanupFiles(req.files);
      const errorMsg = 'Detailed Description of the Issue is required and cannot be empty.';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    if (!cleanUrgency || !validUrgencies.includes(cleanUrgency)) {
      cleanupFiles(req.files);
      const errorMsg = 'Please select a valid Citizen Urgency Assessment (Low, Medium, or High).';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    // 2. Mandatory Photo Evidence Validation (At least 1 image required)
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      const errorMsg = 'At least one photo evidence image (JPEG, PNG, or WebP) is required.';
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).render('citizen/report-problem', {
        activePath: '/citizen/report-problem',
        user: req.user,
        error: errorMsg,
        formData: req.body
      });
    }

    // Process uploaded images
    const imagePaths = [];
    req.files.forEach(file => {
      imagePaths.push(`/uploads/${file.filename}`);
    });

    // 1. Run AI Problem Analysis
    const aiAnalysisResult = await aiService.analyzeProblem({
      title: cleanTitle,
      description: cleanDescription,
      location: cleanLocation,
      optionalCategory,
      urgency: cleanUrgency || 'MEDIUM'
    });

    // 2. Run Deterministic Problem -> Authority Matching Engine
    const routingResult = await matchingService.matchAuthorityForProblem(
      aiAnalysisResult,
      cleanLocation
    );

    // 3. Run Duplicate Detection
    const duplicateResult = await duplicateService.findDuplicates({
      title: cleanTitle,
      description: cleanDescription,
      category: aiAnalysisResult.humanCategory || aiAnalysisResult.category,
      location: cleanLocation
    });

    // 4. Persist Problem to Database
    const similarProblems = duplicateResult.isPotentialDuplicate && duplicateResult.matchedProblemId
      ? [duplicateResult.matchedProblemId]
      : [];

    const newProblem = await Problem.create({
      title: cleanTitle,
      description: cleanDescription,
      category: aiAnalysisResult.humanCategory || aiAnalysisResult.category,
      location: cleanLocation,
      locationText: cleanLocation,
      latitude: parsedLat,
      longitude: parsedLng,
      images: imagePaths,
      reportedBy: userId,
      supporters: [userId], // Reporter automatically supports their own problem
      priority: aiAnalysisResult.urgency,
      severity: aiAnalysisResult.urgency,
      status: 'REPORTED',
      affectedPeople: cleanAffected,
      similarProblems,
      sentiment: aiAnalysisResult.sentiment || { label: 'neutral', score: 0.5 },
      aiAnalysis: {
        category: aiAnalysisResult.humanCategory || aiAnalysisResult.category,
        severity: aiAnalysisResult.urgency,
        priority: aiAnalysisResult.urgency,
        sentiment: aiAnalysisResult.sentiment || { label: 'neutral', score: 0.5, confidence: 0.7 },
        summary: aiAnalysisResult.summary,
        confidenceScore: aiAnalysisResult.confidence,
        tags: aiAnalysisResult.keywords,
        analyzedAt: aiAnalysisResult.analyzedAt
      },
      aiClassification: {
        domain: aiAnalysisResult.domain,
        category: aiAnalysisResult.category,
        subCategory: aiAnalysisResult.subCategory,
        urgency: aiAnalysisResult.urgency,
        confidence: aiAnalysisResult.confidence,
        classifiedAt: aiAnalysisResult.analyzedAt
      },
      assignedAuthority: routingResult.bestAuthority ? routingResult.bestAuthority._id : null,
      assignmentStatus: routingResult.assignmentStatus,
      assignmentReason: routingResult.assignmentReason
    });

    // If duplicate was found, reciprocally link it to the existing problem
    if (duplicateResult.matchedProblemId) {
      try {
        await Problem.findByIdAndUpdate(duplicateResult.matchedProblemId, {
          $addToSet: { similarProblems: newProblem._id }
        });
      } catch (e) {
        console.warn('[Duplicate Link Warning]', e.message);
      }
    }

    // Return JSON if requested by interactive client, otherwise redirect
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(201).json({
        success: true,
        problem: newProblem,
        aiAnalysis: aiAnalysisResult,
        duplicate: duplicateResult,
        redirectUrl: `/problems/${newProblem._id}`
      });
    }

    res.redirect(`/problems/${newProblem._id}`);

  } catch (error) {
    console.error('[Problem Submission Error]', error);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({ success: false, error: 'Failed to create problem report.' });
    }
    res.status(500).render('citizen/report-problem', {
      activePath: '/citizen/report-problem',
      user: req.user,
      error: 'An unexpected error occurred while saving your report. Please try again.',
      formData: req.body
    });
  }
};

/**
 * Problem Detail Page
 */
const getProblemDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user || (req.session && req.session.user) || null;
    const currentUserId = currentUser ? (currentUser.id || currentUser._id) : null;

    const problem = await Problem.findById(id)
      .populate('reportedBy', 'name email organization role')
      .populate('supporters', 'name role')
      .populate('similarProblems', 'title category location status priority createdAt')
      .populate('duplicateOf', 'title category location status')
      .populate('duplicateReports.problem', 'title category location status')
      .populate('duplicateReports.reportedBy', 'name')
      .lean();

    if (!problem) {
      return res.status(404).render('home', {
        activePath: '/',
        user: currentUser,
        error: 'Problem not found.'
      });
    }

    // Check if current user is a supporter
    const isSupporter = currentUserId && Array.isArray(problem.supporters)
      ? problem.supporters.some(s => (s._id || s).toString() === currentUserId.toString())
      : false;

    // Get scored similar problems using duplicateService
    const scoredSimilarProblems = await duplicateService.getSimilarProblemsForDetail(problem._id, 4);

    // Check if challenge exists for this problem
    let associatedChallenge = null;
    let selectedSolution = null;
    try {
      associatedChallenge = await Challenge.findOne({ sourceProblem: problem._id }).lean();
      if (associatedChallenge) {
        selectedSolution = await Solution.findOne({
          challenge: associatedChallenge._id,
          status: 'SELECTED'
        })
          .populate('submittedBy', 'name organization')
          .lean();
      }
    } catch (e) {
      associatedChallenge = null;
      selectedSolution = null;
    }

    res.render('citizen/problem-detail', {
      activePath: '/problems',
      user: currentUser,
      problem,
      isSupporter,
      scoredSimilarProblems,
      associatedChallenge,
      selectedSolution
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Upvote / Support a Problem
 */
const postSupportProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    const problem = await Problem.findById(id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found.' });
    }

    const alreadySupported = problem.supporters.some(s => s.toString() === userId.toString());
    
    if (alreadySupported) {
      // Toggle off support (unless it's the author)
      if (problem.reportedBy.toString() !== userId.toString()) {
        problem.supporters = problem.supporters.filter(s => s.toString() !== userId.toString());
      }
    } else {
      problem.supporters.push(userId);
    }

    await problem.save();

    const isNowSupported = problem.supporters.some(s => s.toString() === userId.toString());

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.json({
        success: true,
        isSupported: isNowSupported,
        supporterCount: problem.supporters.length
      });
    }

    res.redirect(`/problems/${id}`);

  } catch (error) {
    next(error);
  }
};

/**
 * Link Problem as Duplicate / Similar
 */
const postLinkDuplicateProblem = async (req, res, next) => {
  try {
    const { id } = req.params; // Current problem ID
    const { targetProblemId, note } = req.body;
    const userId = req.user.id || req.user._id;

    if (!targetProblemId || targetProblemId.toString() === id.toString()) {
      return res.status(400).json({ success: false, error: 'Please select a valid different problem to link.' });
    }

    const [currentProblem, targetProblem] = await Promise.all([
      Problem.findById(id),
      Problem.findById(targetProblemId)
    ]);

    if (!currentProblem || !targetProblem) {
      return res.status(404).json({ success: false, error: 'Problem report not found.' });
    }

    // Calculate similarity score between the two
    const sim = duplicateService.calculateSimilarity(
      { title: currentProblem.title, description: currentProblem.description, category: currentProblem.category, location: currentProblem.location },
      targetProblem
    );

    // Update current problem
    currentProblem.duplicateOf = targetProblem._id;
    if (!currentProblem.similarProblems.some(sp => sp.toString() === targetProblem._id.toString())) {
      currentProblem.similarProblems.push(targetProblem._id);
    }
    await currentProblem.save();

    // Update target problem duplicateReports array
    const existingIndex = targetProblem.duplicateReports.findIndex(
      dr => dr.problem && dr.problem.toString() === currentProblem._id.toString()
    );

    if (existingIndex >= 0) {
      targetProblem.duplicateReports[existingIndex].similarityScore = sim.score;
      targetProblem.duplicateReports[existingIndex].note = note || 'Linked by citizen reviewer.';
      targetProblem.duplicateReports[existingIndex].linkedAt = new Date();
    } else {
      targetProblem.duplicateReports.push({
        problem: currentProblem._id,
        reportedBy: userId,
        similarityScore: sim.score,
        note: note || 'Linked by citizen reviewer.',
        linkedAt: new Date()
      });
    }

    if (!targetProblem.similarProblems.some(sp => sp.toString() === currentProblem._id.toString())) {
      targetProblem.similarProblems.push(currentProblem._id);
    }

    await targetProblem.save();

    return res.json({
      success: true,
      message: `Report successfully linked as related to "${targetProblem.title}".`,
      similarityPercentage: sim.percentage,
      linkedProblemId: targetProblem._id
    });
  } catch (error) {
    console.error('[Link Duplicate Error]', error);
    return res.status(500).json({ success: false, error: 'Failed to link duplicate report.' });
  }
};

/**
 * Real-time Duplicate Check API for pre-submission form
 */
const checkDuplicatesApi = async (req, res) => {
  try {
    const { title, description, category, location, excludeId } = req.body;
    if (!title && !description) {
      return res.json({ success: true, duplicates: { topMatches: [], isPotentialDuplicate: false } });
    }

    const duplicates = await duplicateService.findDuplicates({
      title: title || '',
      description: description || '',
      category: category || '',
      location: location || '',
      excludeId: excludeId || null,
      limit: 3
    });

    res.json({
      success: true,
      duplicates
    });
  } catch (error) {
    console.error('[Check Duplicates API Error]', error);
    res.status(500).json({ success: false, error: 'Duplicate analysis failed.' });
  }
};

/**
 * My Problems Listing
 */
const getMyProblems = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { status, category, q } = req.query;

    const filter = { reportedBy: userId };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') }
      ];
    }

    const problems = await Problem.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.render('citizen/my-problems', {
      activePath: '/citizen/my-problems',
      user: req.user,
      problems,
      query: req.query
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Real-time AI Analysis API for interactive forms
 */
const analyzeProblemApi = async (req, res) => {
  try {
    const { title, description, location, optionalCategory, urgency } = req.body;
    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description required for analysis.' });
    }

    const analysis = await aiService.analyzeProblem({
      title,
      description,
      location,
      optionalCategory,
      urgency
    });

    const duplicates = await duplicateService.findDuplicates({
      title,
      description,
      category: analysis.category,
      location
    });

    res.json({
      success: true,
      analysis,
      duplicates
    });
  } catch (error) {
    console.error('[AI Analysis API Error]', error);
    res.status(500).json({ error: 'Analysis failed.' });
  }
};

/**
 * Permanently Delete Problem Report (Authenticated Reporter Only)
 */
const deleteProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    // 1. Fetch Problem & Verify Existence
    const problem = await Problem.findById(id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'This report no longer exists.' });
    }

    // 2. Verify Authenticated Ownership
    const reporterId = (problem.reportedBy && problem.reportedBy._id)
      ? problem.reportedBy._id.toString()
      : (problem.reportedBy ? problem.reportedBy.toString() : '');

    if (reporterId !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this report.' });
    }

    // 3. Authorized Deletion: Clean up associated image files from disk
    if (problem.images && Array.isArray(problem.images)) {
      problem.images.forEach(imgUrl => {
        try {
          const filename = path.basename(imgUrl);
          const filePath = path.join(__dirname, '../public/uploads', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.warn('[File Deletion Warning]', fileErr.message);
        }
      });
    }

    // 4. Remove References from Similar Problems
    try {
      await Problem.updateMany(
        { similarProblems: problem._id },
        { $pull: { similarProblems: problem._id } }
      );
    } catch (linkErr) {
      console.warn('[Link Cleanup Warning]', linkErr.message);
    }

    // 5. Permanently delete problem document
    await Problem.findByIdAndDelete(problem._id);

    res.json({
      success: true,
      message: 'Report deleted successfully.',
      redirectUrl: '/citizen/my-problems'
    });

  } catch (error) {
    console.error('[Delete Problem Error]', error);
    res.status(500).json({ success: false, error: 'Failed to delete report. Please try again.' });
  }
};

module.exports = {
  getCommunityProblems,
  getCitizenDashboard,
  getReportProblem,
  postReportProblem,
  getProblemDetail,
  postSupportProblem,
  postLinkDuplicateProblem,
  checkDuplicatesApi,
  getMyProblems,
  analyzeProblemApi,
  deleteProblem
};
