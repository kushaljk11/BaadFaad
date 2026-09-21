/**
 * @fileoverview Split Routes
 * @description Express router for the core bill-splitting lifecycle.
 *              Manages creation, retrieval, update, payment tracking,
 *              finalization, and deletion of split records.
 *              Some routes require JWT authentication via the `protect` middleware.
 *
 * Routes:
 *  POST   /                                  - Create a new split
 *  GET    /                                  - List all splits (auth required)
 *  GET    /:id                               - Get a split by ID
 *  PUT    /:id                               - Update split details
 *  PUT    /:id/participant/:participantIndex  - Mark a participant's payment status
 *  POST   /:id/finalize                      - Finalize split calculations (auth required)
 *  DELETE /:id                               - Delete a split (auth required)
 *
 * @module routes/split.routes
 */
import express from 'express';
import {
  createSplit,
  getAllSplits,
  getSplitById,
  updateSplit,
  updateContributions,
  updateParticipantPayment,
  finalizeSplit,
  ensureSplitHasGroupMembers,
  deleteSplit,
} from '../controllers/split.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParams, paginationQuery, participantIndexParams, participantPaymentBody, splitCreateBody, splitUpdateBody } from '../validation/schemas.js';

import {
  createSettlementPayment,
  getSettlementPayments,
} from '../controllers/settlementPayment.controller.js';

const router = express.Router();

router.post('/', validate({ body: splitCreateBody }), createSplit);
router.get('/', protect, validate({ query: paginationQuery }), getAllSplits);
router.get('/:id', validate({ params: idParams }), getSplitById);
router.put('/:id', validate({ params: idParams, body: splitUpdateBody }), updateSplit);
router.put('/:id/contributions', protect, validate({ params: idParams }), updateContributions);
router.post('/:id/settlement-payments', protect, validate({ params: idParams }), createSettlementPayment);
router.get('/:id/settlement-payments', protect, validate({ params: idParams }), getSettlementPayments);
router.put('/:id/participant/:participantIndex', validate({ params: participantIndexParams, body: participantPaymentBody }), updateParticipantPayment);
router.post('/:id/ensure-members', validate({ params: idParams }), ensureSplitHasGroupMembers);
router.post('/:id/finalize', protect, validate({ params: idParams }), finalizeSplit);
router.delete('/:id', protect, validate({ params: idParams }), deleteSplit);

export default router;
