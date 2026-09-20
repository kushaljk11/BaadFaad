/**
 * @fileoverview Receipt Routes
 * @description Express router for receipt (bill data) management.
 *              Handles storing parsed/manual bill data and retrieval.
 *
 * Routes:
 *  POST /    - Create a new receipt with item data from a scanned/manual bill
 *  GET  /:id - Retrieve a receipt by its ID
 *
 * @module routes/receipt.routes
 */
import express from 'express';
import {
  createReceipt,
  getReceiptById,
} from '../controllers/receipt.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { idParams, receiptCreateBody } from '../validation/schemas.js';

const router = express.Router();

router.post('/', validate({ body: receiptCreateBody }), createReceipt);
router.get('/:id', validate({ params: idParams }), getReceiptById);

export default router;
