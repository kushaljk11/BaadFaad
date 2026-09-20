/**
 * @fileoverview Participant Routes
 * @description Express router for managing participants within a bill-splitting
 *              session. Provides full CRUD operations for participant records.
 *
 * Routes:
 *  POST   /      - Register a new participant in a session
 *  GET    /      - List all participants (optionally filtered by session)
 *  GET    /:id   - Get a single participant by ID
 *  PUT    /:id   - Update participant details (e.g. selected items)
 *  DELETE /:id   - Remove a participant from a session
 *
 * @module routes/participant.routes
 */
import express from 'express';
import * as participantCtrl from '../controllers/participant.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParams, paginationQuery, participantCreateBody, participantUpdateBody } from '../validation/schemas.js';

const router = express.Router();

// create a new participant
router.post('/', validate({ body: participantCreateBody }), participantCtrl.createParticipant);

// list participants
router.get('/', validate({ query: paginationQuery }), participantCtrl.getParticipants);

// single participant operations
router.get('/:id', validate({ params: idParams }), participantCtrl.getParticipantById);
router.put('/:id', validate({ params: idParams, body: participantUpdateBody }), participantCtrl.updateParticipant);
router.delete('/:id', validate({ params: idParams }), participantCtrl.deleteParticipant);

export default router;
