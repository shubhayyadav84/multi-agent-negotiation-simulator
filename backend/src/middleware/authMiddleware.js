const { admin, isFirebaseAdminConfigured } = require('../config/firebaseAdmin');

/**
 * Authentication Middleware
 * Verifies Firebase ID Tokens using the official Firebase Admin SDK.
 *
 * Attaches the verified user payload to req.user:
 * req.user = {
 *   uid: string,
 *   email: string,
 *   email_verified: boolean,
 *   name: string,
 *   auth_time: number
 * }
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  // Extract Bearer token
  let token = null;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1].trim();
    }
  }

  // If Firebase Admin is not configured in local environment:
  // Allow graceful fallback for local development & unit tests while logging a warning.
  if (!isFirebaseAdminConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        success: false,
        error: 'Authentication service is misconfigured. Firebase credentials missing on server.',
      });
    }

    // In local dev/test mode, extract identity from request or headers for developer convenience
    const fallbackUid = req.headers['x-user-id'] || req.body?.userId || req.query?.userId || 'dev_user_1';
    const fallbackEmail = req.headers['x-user-email'] || req.body?.userEmail || req.query?.userEmail || 'developer@negotiator.local';
    req.user = {
      uid: fallbackUid,
      email: fallbackEmail,
      isDevMock: true,
    };
    return next();
  }

  // Strict Firebase ID token verification
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Authorization Bearer token is missing.',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token, true); // checkRevoked = true
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      email_verified: decodedToken.email_verified || false,
      name: decodedToken.name || null,
      auth_time: decodedToken.auth_time,
    };
    next();
  } catch (err) {
    console.warn('[Auth Middleware] Token verification failed:', err.message);

    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please refresh your session.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }

    if (err.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has been revoked. Please sign in again.',
        code: 'AUTH_TOKEN_REVOKED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
      code: 'AUTH_TOKEN_INVALID',
      details: err.message,
    });
  }
}

/**
 * Optional Authentication Middleware
 * If token is present, verifies and populates req.user.
 * If token is absent, allows request to proceed with req.user = null.
 */
async function optionalFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }
  return verifyFirebaseToken(req, res, next);
}

module.exports = {
  verifyFirebaseToken,
  optionalFirebaseToken,
};
