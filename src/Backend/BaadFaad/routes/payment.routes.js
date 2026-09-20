import express from "express";
import {
  initiatePayment,
  paymentStatus,
} from "../controllers/paymentController.js";
import { validate } from '../middleware/validate.middleware.js';
import { paymentInitiateBody, paymentStatusBody } from '../validation/schemas.js';

const router = express.Router();

router.post("/initiate-payment", validate({ body: paymentInitiateBody }), initiatePayment);

router.post("/payment-status", validate({ body: paymentStatusBody }), paymentStatus);

export default router;
