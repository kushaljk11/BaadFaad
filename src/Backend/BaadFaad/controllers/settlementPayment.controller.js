import { broadcastSplitEvent } from '../config/socket.js';
import {
  listSettlementPayments,
  recordSettlementPayment,
} from '../repositories/settlementPayment.repository.js';
import { sendResponse } from '../utils/response.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (v) => UUID.test(String(v ?? ''));

export const createSettlementPayment = async (req, res) => {
  const { id: splitId } = req.params;
  const { fromParticipantId, toParticipantId, amount, method, note } = req.body || {};

  if (!validUuid(splitId)) return sendResponse(res, 400, false, 'Invalid split ID');
  if (!validUuid(fromParticipantId)) return sendResponse(res, 400, false, 'Valid fromParticipantId is required');
  if (!validUuid(toParticipantId)) return sendResponse(res, 400, false, 'Valid toParticipantId is required');
  if (fromParticipantId === toParticipantId) return sendResponse(res, 400, false, 'Cannot record payment to self');

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return sendResponse(res, 400, false, 'Payment amount must be greater than zero');
  }

  const validMethods = ['CASH', 'MANUAL', 'ESEWA', 'KHALTI'];
  const cleanMethod = String(method || 'CASH').toUpperCase();
  if (!validMethods.includes(cleanMethod)) {
    return sendResponse(res, 400, false, `Invalid method. Must be one of: ${validMethods.join(', ')}`);
  }

  try {
    const result = await recordSettlementPayment({
      splitId,
      actorId: req.user.id,
      fromParticipantId,
      toParticipantId,
      amount: numAmount,
      method: cleanMethod,
      note: String(note || '').slice(0, 500),
    });

    if (result.status === 'not-found') return sendResponse(res, 404, false, result.message);
    if (result.status === 'participant-not-found') return sendResponse(res, 404, false, result.message);
    if (result.status === 'forbidden') return sendResponse(res, 403, false, result.message);
    if (result.status === 'no-debt' || result.status === 'self-payment' || result.status === 'invalid-amount') {
      return sendResponse(res, 400, false, result.message);
    }
    if (result.status === 'already-settled') {
      return sendResponse(res, 409, false, result.message);
    }
    if (result.status === 'exceeds-remaining') {
      return sendResponse(res, 400, false, result.message, { remaining: result.remaining });
    }

    // Real-time synchronization
    broadcastSplitEvent(splitId, 'settlement:updated', { splitId, payment: result.payment });
    broadcastSplitEvent(splitId, 'split:updated', { splitId });
    if (result.split?.isFullySettled) {
      broadcastSplitEvent(splitId, 'session:completed', { splitId });
    }

    return res.status(201).json({
      success: true,
      message: 'Settlement payment recorded successfully',
      payment: result.payment,
      split: result.split,
    });
  } catch (err) {
    console.error('Failed to record settlement payment:', err);
    return sendResponse(res, 500, false, 'Failed to record settlement payment');
  }
};

export const getSettlementPayments = async (req, res) => {
  const { id: splitId } = req.params;
  if (!validUuid(splitId)) return sendResponse(res, 400, false, 'Invalid split ID');

  try {
    const payments = await listSettlementPayments(splitId);
    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (err) {
    console.error('Failed to get settlement payments:', err);
    return sendResponse(res, 500, false, 'Failed to retrieve settlement payments');
  }
};
