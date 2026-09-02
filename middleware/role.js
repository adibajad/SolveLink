/**
 * SolveLink Role-Based Authorization Middleware
 * Server-side authorization enforcement.
 */

/**
 * Require specific user role(s)
 * @param {string|string[]} allowedRoles
 */
const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({
          status: 401,
          error: 'Unauthorized',
          message: 'Authentication required.'
        });
      }
      return res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}&msg=login_required`);
    }

    const userRole = req.session.user.role;
    if (roles.includes(userRole) || userRole === 'admin') {
      req.user = req.session.user;
      return next();
    }

    // Forbidden - user logged in but does not have the required role
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: 'Access restricted: Authority permissions required.'
      });
    }

    return res.status(403).render('home', {
      activePath: '/',
      user: req.session.user,
      error: 'Access Denied: Authority credentials required to access this portal.'
    });
  };
};

module.exports = {
  requireRole,
  requireAuthority: requireRole(['authority', 'admin'])
};
