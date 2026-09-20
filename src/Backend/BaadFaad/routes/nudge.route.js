/**
 * @fileoverview Nudge (Payment Reminder) Routes
 * @description Express router for creating, sending, and managing payment
 *              reminder nudges. Also supports emailing full split summaries
 *              to all participants.
 *
 * Routes:
 *  POST  /send            - Create a nudge record and send reminder email
 *  POST  /split-summary   - Email the full split breakdown to all participants
 *  GET   /                - List all nudges
 *  GET   /:id             - Get a single nudge by ID
 *  PATCH /:id/status      - Update nudge status (e.g. mark as acknowledged)
 *
 * @module routes/nudge.route
 */
import express from "express";
import {
  createAndSendNudge,
  sendSplitSummary,
  getAllNudges,
  getNudgeById,
  updateNudgeStatus,
} from "../controllers/nudge.controller.js";
import { validate } from '../middleware/validate.middleware.js';
import { idParams, nudgeSendBody, nudgeStatusBody, paginationQuery, summaryBody } from '../validation/schemas.js';

const router = express.Router();

router.post("/send", validate({ body: nudgeSendBody }), createAndSendNudge);
router.post("/split-summary", validate({ body: summaryBody }), sendSplitSummary);
router.get("/", validate({ query: paginationQuery }), getAllNudges);
router.get("/:id", validate({ params: idParams }), getNudgeById);
router.patch("/:id/status", validate({ params: idParams, body: nudgeStatusBody }), updateNudgeStatus);

export default router;
