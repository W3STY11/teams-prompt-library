/**
 * Role-Based Access Control (RBAC) Middleware
 * Enterprise-grade authorization for Teams Prompt Library
 */

const { executeQuery } = require('../db/sqlClient');

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  'user': 1,
  'contributor': 2,
  'admin': 3,
  'superadmin': 4
};

/**
 * Get user role from database
 * @param {string} userId - Azure AD user ID
 * @param {string} tenantId - Azure AD tenant ID
 * @returns {Promise<string>} User role
 */
async function getUserRole(userId, tenantId) {
  try {
    const results = await executeQuery(
      'SELECT role FROM users WHERE id = @userId AND tenant_id = @tenantId',
      { userId, tenantId }
    );

    if (results.length === 0) {
      // Create user with default role
      await executeQuery(
        'INSERT INTO users (id, tenant_id, role) VALUES (@userId, @tenantId, @role)',
        { userId, tenantId, role: 'user' }
      );
      return 'user';
    }

    return results[0].role || 'user';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'user';  // Default to least privileged role
  }
}

/**
 * Check if user has minimum required role
 * @param {string} userRole - User's current role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean}
 */
function hasMinimumRole(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Middleware: Require specific role
 * @param {string} requiredRole - Minimum role required
 */
function requireRole(requiredRole) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not authenticated'
      });
    }

    try {
      // Get user role from database
      const userRole = await getUserRole(req.user.id, req.user.tenantId);

      // Attach role to request for use in route handlers
      req.user.role = userRole;

      // Check if user has sufficient permissions
      if (!hasMinimumRole(userRole, requiredRole)) {
        return res.status(403).json({
          error: 'forbidden',
          message: `Insufficient permissions. Required role: ${requiredRole}, your role: ${userRole}`
        });
      }

      next();
    } catch (error) {
      console.error('RBAC error:', error);
      res.status(500).json({
        error: 'authorization_error',
        message: 'Internal authorization error'
      });
    }
  };
}

/**
 * Middleware: Check resource ownership
 * Allows users to access their own resources even without elevated privileges
 */
function requireOwnershipOrRole(requiredRole) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not authenticated'
      });
    }

    try {
      const userRole = await getUserRole(req.user.id, req.user.tenantId);
      req.user.role = userRole;

      // Check if user has elevated role
      if (hasMinimumRole(userRole, requiredRole)) {
        return next();
      }

      // Check if user owns the resource
      const resourceId = req.params.id;
      const resourceType = req.route.path.split('/')[1];  // 'prompts', 'favorites', etc.

      const ownershipCheck = await executeQuery(
        `SELECT created_by FROM ${resourceType} WHERE id = @resourceId`,
        { resourceId }
      );

      if (ownershipCheck.length === 0) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Resource not found'
        });
      }

      if (ownershipCheck[0].created_by === req.user.id) {
        return next();
      }

      // User doesn't own the resource and doesn't have elevated role
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access this resource'
      });

    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        error: 'authorization_error',
        message: 'Internal authorization error'
      });
    }
  };
}

/**
 * Middleware: Department-based access control
 * Restricts access to prompts based on user's department
 */
async function requireDepartmentAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'User not authenticated'
    });
  }

  try {
    const userRole = await getUserRole(req.user.id, req.user.tenantId);
    req.user.role = userRole;

    // Admins can access all departments
    if (hasMinimumRole(userRole, 'admin')) {
      return next();
    }

    // Get user's department
    const userDept = await executeQuery(
      'SELECT department FROM users WHERE id = @userId AND tenant_id = @tenantId',
      { userId: req.user.id, tenantId: req.user.tenantId }
    );

    if (userDept.length === 0 || !userDept[0].department) {
      // No department restriction
      return next();
    }

    req.user.department = userDept[0].department;
    next();

  } catch (error) {
    console.error('Department access check error:', error);
    res.status(500).json({
      error: 'authorization_error',
      message: 'Internal authorization error'
    });
  }
}

/**
 * Audit log middleware
 * Records user actions for compliance and security
 */
function auditLog(action) {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    try {
      await executeQuery(
        `INSERT INTO audit_log (user_id, user_email, action, prompt_id, tenant_id, ip_address, user_agent, metadata)
         VALUES (@userId, @userEmail, @action, @promptId, @tenantId, @ipAddress, @userAgent, @metadata)`,
        {
          userId: req.user.id,
          userEmail: req.user.email,
          action,
          promptId: req.params.id || req.body.id || null,
          tenantId: req.user.tenantId,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent') || '',
          metadata: JSON.stringify({
            method: req.method,
            path: req.path,
            query: req.query
          })
        }
      );
    } catch (error) {
      // Don't block request if audit fails, but log the error
      console.error('Audit log error:', error);
    }

    next();
  };
}

module.exports = {
  getUserRole,
  hasMinimumRole,
  requireRole,
  requireOwnershipOrRole,
  requireDepartmentAccess,
  auditLog,
  ROLE_HIERARCHY
};
