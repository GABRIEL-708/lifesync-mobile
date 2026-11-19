'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware that validates a JWT Bearer token.
 *
 * Expects:  Authorization: Bearer <token>
 * On success, attaches the decoded payload to req.user and calls next().
 * On failure, responds with 401.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Authorization header must be: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Malformed authorization header.',
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[Auth] JWT_SECRET is not configured.');
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, email, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
