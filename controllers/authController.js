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
    const userIdStr = user._id.toString();
    req.session.userId = userIdStr;
    req.session.user = {
      id: userIdStr,
      _id: userIdStr,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization || '',
      department: user.department || user.organization || '',
      authoritySector: user.authoritySector || '',
      jurisdiction: user.jurisdiction || user.location || '',
      industrySector: user.industrySector || '',
      skills: user.skills || [],
      domains: user.domains || [],
      technologies: user.technologies || [],
      capabilities: user.capabilities || [],
      location: user.location || ''
    };

    // Determine destination
    let destination = '/citizen/dashboard';
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('/auth')) {
      destination = redirect;
    } else {
      switch (user.role) {
        case 'admin':
          destination = '/admin/dashboard';
          break;
        case 'authority':
          destination = '/authority/dashboard';
          break;
        case 'university':
          destination = '/university/dashboard';
          break;
        case 'industry':
          destination = '/industry/dashboard';
          break;
        case 'citizen':
        default:
          destination = '/citizen/dashboard';
          break;
      }
    }

    // Explicitly persist session before redirecting so cookie and store are synchronized
    return req.session.save((err) => {
      if (err) {
        console.error('[Session Error - Login]', err);
        return res.status(500).render('auth/login', {
          activePath: '/auth/login',
          error: 'Failed to establish your session. Please try again.',
          success: null,
          redirect: redirect || '',
          email: normalizedEmail
        });
      }

      console.log(`[Auth] Login successful: role=${user.role}, destination=${destination}`);
      return res.redirect(destination);
    });

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
  const {
    name,
    email,
    password,
    role,
    organization,
    skills,
    location,
    authoritySector,
    department,
    jurisdiction,
    industrySector,
    domains,
    technologies,
    capabilities
  } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  // Explicitly disallow public registration as Admin
  if (role === 'admin') {
    return res.status(403).render('auth/register', {
      activePath: '/auth/register',
      error: 'Administrator accounts cannot be created through public registration.',
      formData: {
        name: name || '',
        email: normalizedEmail,
        role: 'citizen',
        organization: organization || '',
        skills: skills || '',
        location: location || ''
      }
    });
  }

  const validRoles = ['citizen', 'authority', 'university', 'industry'];
  const userRole = validRoles.includes(role) ? role : 'citizen';

  const formData = {
    name: name || '',
    email: normalizedEmail,
    role: userRole,
    organization: organization || '',
    skills: skills || '',
    location: location || '',
    authoritySector: authoritySector || '',
    department: department || '',
    jurisdiction: jurisdiction || '',
    industrySector: industrySector || '',
    domains: domains || '',
    technologies: technologies || '',
    capabilities: capabilities || ''
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

    // 4. Helper to parse comma-separated or array inputs
    const parseArray = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(i => String(i).trim()).filter(i => i.length > 0);
      return String(input).split(',').map(i => i.trim()).filter(i => i.length > 0);
    };

    const skillsArray = parseArray(skills);
    const domainsArray = parseArray(domains);
    const technologiesArray = parseArray(technologies);
    const capabilitiesArray = parseArray(capabilities);

    const cleanSector = authoritySector ? authoritySector.trim().toLowerCase() : '';
    const cleanDept = department ? department.trim() : (organization ? organization.trim() : '');
    const cleanJurisdiction = jurisdiction ? jurisdiction.trim() : (location ? location.trim() : '');
    const cleanIndSector = industrySector ? industrySector.trim().toLowerCase() : '';

    // 5. Create User Immediately
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      organization: organization ? organization.trim() : cleanDept,
      department: cleanDept,
      authoritySector: cleanSector,
      jurisdiction: cleanJurisdiction,
      industrySector: cleanIndSector,
      skills: skillsArray,
      domains: domainsArray,
      technologies: technologiesArray,
      capabilities: capabilitiesArray,
      location: location ? location.trim() : cleanJurisdiction,
      isVerified: true
    });

    // 6. Establish Active Session
    const regUserIdStr = user._id.toString();
    req.session.userId = regUserIdStr;
    req.session.user = {
      id: regUserIdStr,
      _id: regUserIdStr,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization || '',
      department: user.department || '',
      authoritySector: user.authoritySector || '',
      jurisdiction: user.jurisdiction || '',
      industrySector: user.industrySector || '',
      skills: user.skills || [],
      domains: user.domains || [],
      technologies: user.technologies || [],
      capabilities: user.capabilities || [],
      location: user.location || ''
    };

    // Determine destination
    let regDestination = '/citizen/dashboard';
    switch (user.role) {
      case 'authority':
        regDestination = '/authority/dashboard';
        break;
      case 'university':
        regDestination = '/university/dashboard';
        break;
      case 'industry':
        regDestination = '/industry/dashboard';
        break;
      case 'citizen':
      default:
        regDestination = '/citizen/dashboard';
        break;
    }

    // Explicitly persist session before redirecting so cookie and store are synchronized
    return req.session.save((err) => {
      if (err) {
        console.error('[Session Error - Register]', err);
        return res.status(500).render('auth/register', {
          activePath: '/auth/register',
          error: 'Account created, but session initialization failed. Please sign in.',
          formData
        });
      }

      console.log(`[Auth] Registration successful: role=${user.role}, destination=${regDestination}`);
      return res.redirect(regDestination);
    });

  } catch (error) {
    console.error('[Auth Error - Register]', error);
    if (error.code === 11000) {
      return res.status(409).render('auth/register', {
        activePath: '/auth/register',
        error: 'An account with this email address already exists. Please sign in instead.',
        formData
      });
    }
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
