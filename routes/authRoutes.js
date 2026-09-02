const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureGuest } = require('../middleware/auth');

// Login Routes
router.get('/login', ensureGuest, authController.getLogin);
router.post('/login', authController.postLogin);

// Registration Routes
router.get('/register', ensureGuest, authController.getRegister);
router.post('/register', authController.postRegister);

// Forgot Password Routes
router.get('/forgot-password', ensureGuest, authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);

// Password Reset Routes
router.get('/reset-password', ensureGuest, authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

// Logout Routes
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
