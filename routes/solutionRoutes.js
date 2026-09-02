const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const solutionController = require('../controllers/solutionController');
const { requireRole } = require('../middleware/role');

// Multer Storage Configuration for Proposal Attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'proposal-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 3
  }
});

// Guard all university innovator routes
const requireInnovator = requireRole(['university', 'industry', 'admin']);

router.use('/university', requireInnovator);

// University Portal Endpoints
router.get('/university/dashboard', solutionController.getUniversityDashboard);
router.get('/university/challenges', solutionController.getUniversityChallenges);
router.get('/university/challenges/:id', solutionController.getUniversityChallengeDetail);
router.get('/university/submit-solution', solutionController.getSubmitSolution);
router.post(
  '/university/submit-solution',
  upload.array('attachments', 3),
  solutionController.postSubmitSolution
);
router.post('/university/challenges/:id/interest', solutionController.postExpressInterest);

module.exports = router;
