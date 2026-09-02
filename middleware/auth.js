/**
 * SolveLink Authentication & Session Middleware
 */

/**
 * Middleware to populate res.locals with session user for all EJS templates
 */
const setUserLocals = (req, res, next) => {
  res.locals.user = req.session && req.session.user ? req.session.user : null;
  res.locals.activePath = req.path;
  next();
};

/**
 * Ensure user is logged in. If not, redirect to login page.
 */
const ensureAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  // If request is AJAX/API, return 401 JSON
  if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Authentication is required to access this resource.'
    });
  }

  // Redirect to login preserving destination
  const redirectUrl = req.originalUrl !== '/auth/login' ? req.originalUrl : '/dashboard';
  return res.redirect(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}&msg=login_required`);
};

/**
 * Ensure user is a guest (not logged in). If already logged in, redirect to dashboard.
 */
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role || 'citizen';
    if (role === 'citizen') return res.redirect('/citizen/dashboard');
    if (role === 'authority' || role === 'admin') return res.redirect('/authority/dashboard');
    if (role === 'university' || role === 'industry') return res.redirect('/university/dashboard');
    return res.redirect('/citizen/dashboard');
  }
  next();
};

module.exports = {
  setUserLocals,
  ensureAuthenticated,
  ensureGuest
};
