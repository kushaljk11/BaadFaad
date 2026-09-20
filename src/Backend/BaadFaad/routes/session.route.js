/**
 * @fileoverview Session Routes
 * @description Express router for real-time bill-splitting session management.
 *              Sessions act as live rooms where participants join via QR code,
 *              select items, and collaborate on splitting a bill in real time.
 *
 * Routes:
 *  POST /                   - Create a new session (generates QR code)
 *  POST /join/:sessionId    - Join an existing session as a participant
 *  GET  /                   - List all sessions
 *  GET  /split/:splitId     - Look up session by its associated split ID
 *  GET  /:id                - Get a single session by ID
 *
 * @module routes/session.route
 */
import express from "express";
import {
  createSession,
  getAllSessions,
  getSessionById,
  getSessionBySplitId,
  joinSession,
} from "../controllers/session.controller.js";
import { validate } from '../middleware/validate.middleware.js';
import { idParams, invitationJoinBody, paginationQuery, sessionCreateBody, sessionIdParams, splitIdParams } from '../validation/schemas.js';

const router = express.Router();

router.post("/", validate({ body: sessionCreateBody }), createSession);
router.post("/join/:sessionId", validate({ params: sessionIdParams, body: invitationJoinBody }), joinSession);
router.get("/", validate({ query: paginationQuery }), getAllSessions);
router.get("/split/:splitId", validate({ params: splitIdParams }), getSessionBySplitId);
router.get("/:id", validate({ params: idParams }), getSessionById);

export default router;
