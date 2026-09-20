/**
 * @fileoverview Authentication Middleware (lenient / dev-friendly)
 * @description JWT verification middleware for protected routes.
 *              In development mode, requests without a token are allowed through
 *              so that routes remain testable without full auth setup.
 *              In production, a valid Bearer token is strictly required.
 *
 * @module middlewares/auth.middleware
 */
import jwt from 'jsonwebtoken';
import { findUserById } from '../repositories/user.repository.js';

const resolveBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, secret);
};

/**
 * Verify JWT token and attach decoded user info to the request.
 * In development/prototype mode the middleware is lenient — if no token
 * is provided it falls through so routes remain testable without auth.
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 */
export const protect = (req, res, next) => {
  try {
    const token = resolveBearerToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied' });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid access token' });
  }
};

/**
 * Strict auth middleware for endpoints that must always require JWT auth,
 * regardless of environment.
 */
export const protectStrict = (req, res, next) => {
  try {
    const token = resolveBearerToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied' });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid access token' });
  }
};

/**
 * Ensures the caller is an OAuth-backed user (non-guest) by checking that
 * the linked account email is not a generated local guest address.
 */
export const requireOAuthUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Access denied' });
    }

    const authUser = await findUserById(req.user.id);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const email = String(authUser.email || '').toLowerCase();
    const isGuestAccount = email.endsWith('@local');

    if (isGuestAccount) {
      return res.status(403).json({
        success: false,
        message: 'Google OAuth is required for group actions',
      });
    }

    req.authUser = authUser;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to validate user' });
  }
};
