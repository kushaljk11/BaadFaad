/**
 * @file controllers/authController.js
 * @description Authentication controller — handles email/password login.
 * Google OAuth is handled separately via Passport in the auth route.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { createUser, findUserByEmail } from '../repositories/user.repository.js';
import { generateToken } from '../utils/generateToken.js';


/**
 * Authenticate a user with email & password.
 * @route POST /api/auth/login
 * @param {import('express').Request} req - body: { email, password }
 * @param {import('express').Response} res - JWT token + user object on success
 */
export const login = async (req, res) => {
  try {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const user = await findUserByEmail(email, { includePassword: true });

  if (!user?.password)
    return res.status(401).json({ message: "Invalid email or password" });

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch)
    return res.status(401).json({ message: "Invalid email or password" });

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ message: 'Unable to sign in' });
  }
};

/**
 * Continue with name-only or email (dev-friendly flow).
 * If `email` is provided, will find or create a user by email.
 * If no email is provided, creates a guest user with a generated local email.
 * @route POST /api/auth/continue
 */
export const continueAuth = async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    // Never bind an unverified email to a guest token; that could impersonate
    // an existing OAuth account.
    const guestEmail = `guest-${crypto.randomUUID()}@local`;
    const user = await createUser({ name: fullName.trim().slice(0, 100), email: guestEmail });

    const token = generateToken(user);

    return res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('continueAuth error:', error);
    return res.status(500).json({ message: 'Failed to continue' });
  }
};
