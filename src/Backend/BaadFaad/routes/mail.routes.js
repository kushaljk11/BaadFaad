/**
 * @fileoverview Mail Routes
 * @description Express router for email-related endpoints.
 *              Currently provides a test/debug endpoint for verifying
 *              the Mailjet configuration.
 *
 * Routes:
 *  POST /send - Send a test email to verify mail configuration
 *
 * @module routes/mail.routes
 */
import express from "express";
import { getMailHealth, sendTestMail } from "../controllers/mail.controller.js";
import { validate } from '../middleware/validate.middleware.js';
import { mailBody } from '../validation/schemas.js';

const router = express.Router();

router.get("/health", getMailHealth);
router.post("/send", validate({ body: mailBody }), sendTestMail);

export default router;
