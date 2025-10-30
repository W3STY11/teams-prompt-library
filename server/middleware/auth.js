/**
 * Authentication Middleware for Microsoft Teams Apps
 * Validates Azure AD tokens from Nested App Authentication (NAA) or traditional SSO
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// JWKS client for fetching Azure AD public keys
const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  cache: true,
  cacheMaxAge: 86400000,  // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Get signing key from Azure AD
 * @param {object} header - JWT header
 * @param {function} callback - Callback function
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Validate Azure AD token middleware
 * Extracts and validates JWT token from Authorization header
 */
async function validateToken(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'No authorization header provided'
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'No token provided'
      });
    }

    // Verify token
    jwt.verify(token, getKey, {
      audience: process.env.AZURE_CLIENT_ID,
      issuer: [
        `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
        'https://login.microsoftonline.com/common/v2.0',
        'https://sts.windows.net/' + process.env.AZURE_TENANT_ID + '/'
      ],
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        console.error('Token validation error:', err.message);
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Token validation failed',
          details: err.message
        });
      }

      // Attach user information to request
      req.user = {
        id: decoded.oid || decoded.sub,  // Object ID (user ID)
        email: decoded.upn || decoded.email || decoded.preferred_username,
        name: decoded.name,
        tenantId: decoded.tid,  // Tenant ID
        roles: decoded.roles || [],
        scopes: decoded.scp ? decoded.scp.split(' ') : []
      };

      next();
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'authentication_error',
      message: 'Internal authentication error'
    });
  }
}

/**
 * Optional authentication middleware
 * Validates token if present, but allows unauthenticated requests
 * Useful for public endpoints that enhance behavior for authenticated users
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }

  // If token is present, validate it
  return validateToken(req, res, next);
}

/**
 * Extract tenant ID from request
 * For use in multi-tenant queries
 */
function extractTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'User not authenticated'
    });
  }

  req.tenantId = req.user.tenantId;
  next();
}

/**
 * Check if user has specific scope/permission
 * @param {string} requiredScope - Required scope (e.g., 'Prompts.Write')
 */
function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not authenticated'
      });
    }

    const hasScope = req.user.scopes.includes(requiredScope);

    if (!hasScope) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Required scope missing: ${requiredScope}`
      });
    }

    next();
  };
}

/**
 * Handle consent_required errors
 * Returns proper error response for incremental consent scenarios
 */
function handleConsentRequired(req, res) {
  res.status(403).json({
    error: 'consent_required',
    message: 'Additional consent required for this operation',
    authUrl: `https://login.microsoftonline.com/${req.user.tenantId}/oauth2/v2.0/authorize?client_id=${process.env.AZURE_CLIENT_ID}&response_type=code&scope=openid profile email`
  });
}

module.exports = {
  validateToken,
  optionalAuth,
  extractTenant,
  requireScope,
  handleConsentRequired
};
