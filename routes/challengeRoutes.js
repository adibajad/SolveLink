const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { requireAuthority } = require('../middleware/role');

// Guard all authority routes
router.use('/authority', requireAuthority);

// Authority Dashboard
router.get('/authority/dashboard', challengeController.getAuthorityDashboard);

// Problem Management & Triage
router.get('/authority/problems', challengeController.getAuthorityProblems);
router.get('/authority/problems/:id', challengeController.getAuthorityProblemDetail);
router.post('/authority/problems/:id/status', challengeController.postUpdateProblemStatus);
router.post('/authority/problems/:id/link-duplicate', challengeController.postLinkDuplicateProblem);

// Challenge Creation & Management
router.get('/authority/create-challenge', challengeController.getCreateChallenge);
router.post('/authority/create-challenge', challengeController.postCreateChallenge);
router.get('/authority/challenges', (req, res) => res.redirect('/challenges'));

// Solution Review & Evaluation Rubrics
router.get('/authority/solutions', challengeController.getAuthoritySolutions);
router.get('/authority/solutions/:id', challengeController.getAuthoritySolutionDetail);
router.post('/authority/solutions/:id/evaluate', challengeController.postEvaluateSolution);

module.exports = router;
