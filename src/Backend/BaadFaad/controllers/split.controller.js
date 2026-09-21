import { getIO, broadcastSplitEvent } from '../config/socket.js';
import { sendResponse } from '../utils/response.js';
import {
  createSplitRecord,
  deleteOwnedSplit,
  finalizeOwnedSplit,
  findSplitForUser,
  listSplitsForUser,
  updateOwnedSplit,
  updateSplitContributions,
  updateSplitParticipantStatus,
} from '../repositories/split.repository.js';
import { paginationFrom, paginationMeta } from '../utils/pagination.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (value) => UUID.test(String(value ?? ''));
const fail = (res, error) => {
  if (error?.statusCode === 401 || error?.code === 'P2003') {
    return sendResponse(res, 401, false, error.message || 'User session has expired or user does not exist. Please log in again.');
  }
  if (error instanceof TypeError || error instanceof RangeError) return sendResponse(res, 400, false, error.message);
  if (error?.code === 'P2028') {
    return sendResponse(res, 503, false, 'Database transaction timed out. Please try again.');
  }
  console.error('Split operation failed:', error);
  return sendResponse(res, 500, false, error?.message || 'Split operation failed');
};

export const createSplit = async (req, res) => {
  try {
    if (req.body?.receiptId && !validUuid(req.body.receiptId)) return sendResponse(res, 400, false, 'Invalid receiptId');
    const totalAmount = req.body?.totalAmount ?? 0;
    const result = await createSplitRecord({
      createdBy: req.user.id,
      receiptId: req.body?.receiptId,
      splitType: req.body?.splitType,
      participants: req.body?.participants,
      breakdown: req.body?.breakdown,
      contributions: req.body?.contributions,
      name: req.body?.name,
      totalAmount,
    });
    if (result.status === 'receipt-not-found') return sendResponse(res, 404, false, 'Receipt not found');
    return sendResponse(res, 201, true, 'Split created successfully', { split: result.split });
  } catch (error) { return fail(res, error); }
};

export const getSplitById = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const split = await findSplitForUser(req.params.id, req.user.id);
    return split ? sendResponse(res, 200, true, 'Split fetched successfully', { split }) : sendResponse(res, 404, false, 'Split not found');
  } catch (error) { return fail(res, error); }
};

export const getAllSplits = async (req, res) => {
  try {
    const paging = paginationFrom(req.query);
    const result = await listSplitsForUser(req.user.id, { ...paging, withMeta: true });
    return sendResponse(res, 200, true, 'Splits fetched successfully', { splits: result.items, pagination: paginationMeta(result) });
  } catch (error) { return fail(res, error); }
};

export const updateSplit = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const split = await updateOwnedSplit({ id: req.params.id, ownerId: req.user.id, data: req.body || {} });
    if (!split) return sendResponse(res, 404, false, 'Split not found');
    broadcastSplitEvent(split.id, 'split:updated', { splitId: split.id });
    return sendResponse(res, 200, true, 'Split updated successfully', { split });
  } catch (error) { return fail(res, error); }
};

export const updateContributions = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const result = await updateSplitContributions({
      id: req.params.id,
      ownerId: req.user.id,
      contributions: req.body?.contributions || [],
    });
    if (result.status === 'not-found') return sendResponse(res, 404, false, 'Split not found');
    broadcastSplitEvent(req.params.id, 'contribution:updated', { splitId: req.params.id });
    broadcastSplitEvent(req.params.id, 'settlement:updated', { splitId: req.params.id });
    return sendResponse(res, 200, true, 'Contributions updated successfully', { split: result.split });
  } catch (error) { return fail(res, error); }
};

export const updateParticipantPayment = async (req, res) => {
  const index = Number(req.params.participantIndex);
  if (!validUuid(req.params.id) || !Number.isInteger(index) || index < 0) return sendResponse(res, 400, false, 'Invalid split or participant index');
  try {
    const result = await updateSplitParticipantStatus({
      splitId: req.params.id, index, actorId: req.user.id,
      amountPaid: req.body?.amountPaid, paymentStatus: req.body?.paymentStatus,
    });
    if (result.status === 'not-found') return sendResponse(res, 404, false, 'Split not found');
    if (result.status === 'bad-index') return sendResponse(res, 400, false, 'Invalid participant index');
    if (result.status === 'forbidden') return sendResponse(res, 403, false, 'You can only update your own payment');
    broadcastSplitEvent(req.params.id, 'settlement:updated', { splitId: req.params.id });
    return sendResponse(res, 200, true, 'Participant payment updated', { split: result.split });
  } catch (error) { return fail(res, error); }
};

export const ensureSplitHasGroupMembers = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const split = await updateOwnedSplit({ id: req.params.id, ownerId: req.user.id, data: { ensureMembers: true } });
    if (!split) return sendResponse(res, 404, false, 'Split not found');
    broadcastSplitEvent(split.id, 'split:updated', { splitId: split.id });
    return sendResponse(res, 200, true, 'Split updated with group members', { split });
  } catch (error) { return fail(res, error); }
};

export const finalizeSplit = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const result = await finalizeOwnedSplit(req.params.id, req.user.id);
    if (result.status === 'not-found') return sendResponse(res, 404, false, 'Split not found');
    broadcastSplitEvent(req.params.id, 'session:completed', { splitId: req.params.id });
    return sendResponse(res, 200, true, result.status === 'already' ? 'Split already finalized' : 'Split finalized successfully', { split: result.split });
  } catch (error) { return fail(res, error); }
};

export const deleteSplit = async (req, res) => {
  if (!validUuid(req.params.id)) return sendResponse(res, 400, false, 'Invalid split id');
  try {
    const status = await deleteOwnedSplit(req.params.id, req.user.id);
    if (status === 'not-found') return sendResponse(res, 404, false, 'Split not found');
    if (status === 'financial-history') return sendResponse(res, 409, false, 'A split with payment history cannot be deleted');
    return sendResponse(res, 200, true, 'Split deleted successfully');
  } catch (error) { return fail(res, error); }
};
