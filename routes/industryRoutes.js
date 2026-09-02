const express = require('express');
const router = express.Router();
const industryController = require('../controllers/industryController');
const solutionController = require('../controllers/solutionController');
const { requireRole } = require('../middleware/role');

// Guard all industry routes
const requireIndustry = requireRole(['industry', 'admin']);
router.use('/industry', requireIndustry);

// Industry Dashboard
router.get('/industry/dashboard', industryController.getIndustryDashboard);

// Challenge Exploration with Industry Synergy
router.get('/industry/challenges', solutionController.getUniversityChallenges);
router.get('/industry/challenges/:id', solutionController.getUniversityChallengeDetail);

// University Solutions Pipeline & Collaboration
router.get('/industry/solutions', industryController.getIndustrySolutions);
router.get('/industry/solutions/:id', industryController.getIndustrySolutionDetail);
router.post('/industry/solutions/:id/collaborate', industryController.postExpressCollaboration);

module.exports = router;
