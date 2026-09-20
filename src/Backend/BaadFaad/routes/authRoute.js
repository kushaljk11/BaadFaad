/**
 * @fileoverview Authentication Routes
 * @description Express router for user authentication endpoints.
 *              Supports email/password login and Google OAuth 2.0 flow.
 *
 * Routes:
 *  POST /login           - Email/password authentication
 *  GET  /google          - Initiates Google OAuth consent screen
 *  GET  /google/callback  - Handles Google OAuth callback, issues JWT & redirects to frontend
 *
 * @module routes/authRoute
 */
import express from "express";
import {getPassport} from "../config/passport.js";
import  {login, continueAuth}  from "../controllers/authController.js";
import { validate } from '../middleware/validate.middleware.js';
import { authContinueBody, authLoginBody } from '../validation/schemas.js';


const router = express.Router();

router.post("/login", validate({ body: authLoginBody }), login);
router.post("/continue", validate({ body: authContinueBody }), continueAuth);

/* Google OAuth */
router.get(
  "/google",
  (req, res, next) => {
    getPassport().authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  }
);

router.get(
  "/google/callback",
  (req, res, next) => {
    getPassport().authenticate("google", { session: false })(req, res, next);
  },
  (req, res) => {
    const { token, user } = req.user;
    const frontend = (process.env.FRONTEND_URL || 'https://baadfaad.vercel.app').replace(/\/$/, '');
    res.redirect(
      `${frontend}/auth/callback#token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(user))}`
    );
  }
);

export default router;
