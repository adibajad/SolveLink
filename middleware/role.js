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
  const isStrictAdminRoute = roles.length === 1 && roles[0] === 'admin';

  return (req, res, next) => {
    // 1. Not Authenticated
    if (!req.session || !req.session.user) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({
          status: 401,
          error: 'Unauthorized',
          message: 'Authentication required.'
        });
      }
      const loginUrl = isStrictAdminRoute ? '/admin/login' : '/auth/login';
      return res.redirect(`${loginUrl}?redirect=${encodeURIComponent(req.originalUrl)}&msg=login_required`);
    }

    const userRole = req.session.user.role;

    // 2. Check Strict Admin-Only Route
    if (isStrictAdminRoute) {
      if (userRole === 'admin') {
        req.user = req.session.user;
        return next();
      }

      // Forbidden: Logged-in citizen, authority, university, or industry attempting admin access
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({
          status: 403,
          error: 'Forbidden',
          message: 'Access restricted: Platform Administrator privileges required.'
        });
      }

      return res.status(403).render('home', {
        activePath: '/',
        user: req.session.user,
        error: 'Access Denied: Platform Administrator privileges required to access the Admin Console.'
      });
    }

    // 3. Multi-Role or Other Stakeholder Routes (Admin has cross-cutting visibility)
    if (roles.includes(userRole) || userRole === 'admin') {
      req.user = req.session.user;
      return next();
    }

    // 4. Forbidden - user logged in but does not have the required role
    const roleLabel = roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' / ');
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        status: 403,
        error: 'Forbidden',
        message: `Access restricted: ${roleLabel} permissions required.`
      });
    }

    return res.status(403).render('home', {
      activePath: '/',
      user: req.session.user,
      error: `Access Denied: ${roleLabel} credentials required to access this portal.`
    });
  };
};

module.exports = {
  requireRole,
  requireAuthority: requireRole(['authority', 'admin']),
  requireAdmin: requireRole(['admin'])
};
