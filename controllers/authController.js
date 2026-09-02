const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Render Login Page
 */
const getLogin = (req, res) => {
  let error = req.query.error || null;
  if (req.query.msg === 'login_required') {
    error = 'Please sign in to access that page.';
  }

  let success = null;
  if (req.query.loggedOut === 'true') {
    success = 'You have been logged out successfully.';
  } else if (req.query.reset === 'true') {
    success = 'Your password has been reset successfully. Please sign in with your new password.';
  } else if (req.query.registered === 'true') {
    success = 'Registration successful. Please sign in.';
  }

  res.render('auth/login', {
    activePath: '/auth/login',
    error,
    success,
    redirect: req.query.redirect || '',
    email: req.query.email || ''
  });
};

/**
 * Handle Login Form Submission
 */
const postLogin = async (req, res) => {
  const { email, password, redirect } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  try {
    // 1. Validation
    if (!normalizedEmail || !password) {
      return res.status(400).render('auth/login', {
        activePath: '/auth/login',
        error: 'Please provide both email and password.',
        success: null,
        redirect: redirect || '',
        email: normalizedEmail
      });
    }

    // 2. Find User
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).render('auth/login', {
        activePath: '/auth/login',
        error: 'Invalid email address or password.',
        success: null,
        redirect: redirect || '',
        email: normalizedEmail
      });
    }

    // 3. Compare Password Hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).render('auth/login', {
        activePath: '/auth/login',
        error: 'Invalid email address or password.',
        success: null,
        redirect: redirect || '',
        email: normalizedEmail
      });
    }

    // 4. Establish Session
    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization || '',
      location: user.location || ''
    };

    // 5. Redirect based on role or explicit redirect parameter
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('/auth')) {
      return res.redirect(redirect);
    }

    switch (user.role) {
      case 'authority':
        return res.redirect('/authority/dashboard');
      case 'university':
      case 'industry':
        return res.redirect('/university/dashboard');
      case 'citizen':
      default:
        return res.redirect('/citizen/dashboard');
    }

  } catch (error) {
    console.error('[Auth Error - Login]', error);
    return res.status(500).render('auth/login', {
      activePath: '/auth/login',
      error: 'An unexpected authentication error occurred. Please try again.',
      success: null,
      redirect: redirect || '',
      email: normalizedEmail
    });
  }
};

/**
 * Render Registration Page
 */
const getRegister = (req, res) => {
  const selectedRole = req.query.role || 'citizen';
  res.render('auth/register', {
    activePath: '/auth/register',
    error: null,
    formData: {
      role: selectedRole,
      name: '',
      email: '',
      organization: '',
      skills: '',
      location: ''
    }
  });
};

/**
 * Handle Registration Form Submission -> Create User Directly & Log In
 */
const postRegister = async (req, res) => {
  const { name, email, password, role, organization, skills, location } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  const validRoles = ['citizen', 'authority', 'university', 'industry', 'admin'];
  const userRole = validRoles.includes(role) ? role : 'citizen';

  const formData = {
    name: name || '',
    email: normalizedEmail,
    role: userRole,
    organization: organization || '',
    skills: skills || '',
    location: location || ''
  };

  try {
    // 1. Validations
    if (!name || !normalizedEmail || !password) {
      return res.status(400).render('auth/register', {
        activePath: '/auth/register',
        error: 'Name, email, and password are required.',
        formData
      });
    }

    // Basic email format check
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).render('auth/register', {
        activePath: '/auth/register',
        error: 'Please provide a valid email address.',
        formData
      });
    }

    if (password.length < 6) {
      return res.status(400).render('auth/register', {
        activePath: '/auth/register',
        error: 'Password must be at least 6 characters long.',
        formData
      });
    }

    // 2. Check for Duplicate User
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).render('auth/register', {
        activePath: '/auth/register',
        error: 'An account with this email address already exists. Please sign in instead.',
        formData
      });
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Parse Skills (comma-separated string to clean array)
    let skillsArray = [];
    if (skills && typeof skills === 'string') {
      skillsArray = skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else if (Array.isArray(skills)) {
      skillsArray = skills;
    }

    // 5. Create User Immediately
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      organization: organization ? organization.trim() : '',
      skills: skillsArray,
      location: location ? location.trim() : '',
      isVerified: true
    });

    // 6. Establish Active Session
    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization || '',
      location: user.location || ''
    };

    // 7. Redirect to Role Dashboard
    switch (user.role) {
      case 'authority':
        return res.redirect('/authority/dashboard');
      case 'university':
      case 'industry':
        return res.redirect('/university/dashboard');
      case 'citizen':
      default:
        return res.redirect('/citizen/dashboard');
    }

  } catch (error) {
    console.error('[Auth Error - Register]', error);
    return res.status(500).render('auth/register', {
      activePath: '/auth/register',
      error: 'Registration failed due to a server error. Please try again.',
      formData
    });
  }
};

/**
 * Render Forgot Password Page
 */
const getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    activePath: '/auth/login',
    error: null,
    info: null,
    email: req.query.email || ''
  });
};

/**
 * Handle Forgot Password Form Submission -> Redirects to Reset Password Form
 */
const postForgotPassword = async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  try {
    if (!normalizedEmail) {
      return res.status(400).render('auth/forgot-password', {
        activePath: '/auth/login',
        error: 'Please provide your registered email address.',
        info: null,
        email: ''
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).render('auth/forgot-password', {
        activePath: '/auth/login',
        error: 'Please provide a valid email address.',
        info: null,
        email: normalizedEmail
      });
    }

    return res.redirect(`/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`);

  } catch (error) {
    console.error('[Auth Error - Forgot Password]', error);
    return res.status(500).render('auth/forgot-password', {
      activePath: '/auth/login',
      error: 'An unexpected error occurred. Please try again.',
      info: null,
      email: normalizedEmail
    });
  }
};

/**
 * Render Reset Password Page
 */
const getResetPassword = (req, res) => {
  const email = req.query.email || '';
  const error = req.query.error || null;

  res.render('auth/reset-password', {
    activePath: '/auth/login',
    email,
    error,
    info: null
  });
};

/**
 * Handle Password Reset Submission
 */
const postResetPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  try {
    // 1. Validations
    if (!normalizedEmail || !password || !confirmPassword) {
      return res.status(400).render('auth/reset-password', {
        activePath: '/auth/login',
        email: normalizedEmail,
        error: 'All fields are required.',
        info: null
      });
    }

    if (password.length < 6) {
      return res.status(400).render('auth/reset-password', {
        activePath: '/auth/login',
        email: normalizedEmail,
        error: 'New password must be at least 6 characters long.',
        info: null
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).render('auth/reset-password', {
        activePath: '/auth/login',
        email: normalizedEmail,
        error: 'Passwords do not match. Please re-enter carefully.',
        info: null
      });
    }

    // 2. Update User Password in MongoDB
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).render('auth/reset-password', {
        activePath: '/auth/login',
        email: normalizedEmail,
        error: 'No account found with this email address.',
        info: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.isVerified = true;
    await user.save();

    // 3. Redirect to Login with Success Notice
    return res.redirect('/auth/login?reset=true');

  } catch (error) {
    console.error('[Auth Error - Reset Password]', error);
    return res.status(500).render('auth/reset-password', {
      activePath: '/auth/login',
      email: normalizedEmail,
      error: 'Failed to reset password due to a server error. Please try again.',
      info: null
    });
  }
};

/**
 * Handle Logout
 */
const logout = (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('[Auth Error - Logout]', err);
      }
      res.clearCookie('connect.sid', { path: '/' });
      return res.redirect('/auth/login?loggedOut=true');
    });
  } else {
    res.clearCookie('connect.sid', { path: '/' });
    return res.redirect('/auth/login?loggedOut=true');
  }
};

module.exports = {
  getLogin,
  postLogin,
  getRegister,
  postRegister,
  getForgotPassword,
  postForgotPassword,
  getResetPassword,
  postResetPassword,
  logout
};
