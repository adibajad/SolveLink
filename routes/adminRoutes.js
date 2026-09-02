/**
 * SolveLink Admin Routes
 * Dedicated routes for platform administrator authentication and ecosystem monitoring.
 */

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/role');

// Admin Authentication
router.get('/admin/login', adminController.getAdminLogin);
router.post('/admin/login', adminController.postAdminLogin);

// Protected Admin Dashboard
router.get('/admin/dashboard', requireAdmin, adminController.getAdminDashboard);

// Convenience alias: GET /admin -> redirects to /admin/dashboard
router.get('/admin', requireAdmin, (req, res) => {
  res.redirect('/admin/dashboard');
});

module.exports = router;
