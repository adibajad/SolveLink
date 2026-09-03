const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const problemController = require('../controllers/problemController');
const { ensureAuthenticated } = require('../middleware/auth');

// Multer Storage & Validation
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimes.includes(file.mimetype) && (allowedExts.includes(ext) || !ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP image files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5
  }
});

// Community Problems Discovery Page (Accessible to public & authenticated citizens)
router.get('/problems', problemController.getCommunityProblems);
router.get('/citizen/problems', (req, res) => res.redirect('/problems'));

// Citizen Portal Management Routes
router.get('/citizen/dashboard', ensureAuthenticated, problemController.getCitizenDashboard);
router.get('/citizen/report-problem', ensureAuthenticated, problemController.getReportProblem);
router.post(
  '/citizen/report-problem',
  ensureAuthenticated,
  upload.array('images', 5),
  problemController.postReportProblem
);
router.get('/citizen/my-problems', ensureAuthenticated, problemController.getMyProblems);

// Public / General Problem Detail & Support Actions
router.get('/problems/:id', problemController.getProblemDetail);
router.post('/problems/:id/support', ensureAuthenticated, problemController.postSupportProblem);
router.post('/problems/:id/duplicate', ensureAuthenticated, problemController.postLinkDuplicateProblem);

// Delete Report Route (Authenticated Owner)
router.post('/problems/:id/delete', ensureAuthenticated, problemController.deleteProblem);

// Realtime AI & Duplicate Check APIs
router.post('/api/problems/analyze', ensureAuthenticated, problemController.analyzeProblemApi);
router.post('/api/problems/check-duplicates', problemController.checkDuplicatesApi);

module.exports = router;
