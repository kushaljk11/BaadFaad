import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { getIO } from '../config/socket.js';
import {
  addGroupMember,
  createGroupRecord,
  findGroupForUser,
  listGroupsForUser,
  recalculateGroupSplit,
  removeGroupMember,
  updateOwnedGroup,
} from '../repositories/group.repository.js';
import { paginationFrom, paginationMeta } from '../utils/pagination.js';
import { createInvitationToken } from '../utils/invitation.js';

const QR_BASE_URL = process.env.QR_BASE_URL
  || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0].trim() : '')
  || 'https://baadfaad.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COVERS = [
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop',
];

const error = (res, status, message) => res.status(status).json({ success: false, message });
const validUuid = (value) => UUID.test(String(value ?? ''));
const emit = (room, event, payload) => {
  try { getIO().to(String(room)).emit(event, payload); } catch { /* socket is non-critical */ }
};

export const createGroup = async (req, res) => {
  try {
    const createdBy = req.user.id;
    const name = String(req.body?.name ?? '').trim().slice(0, 100);
    if (!name) return error(res, 400, 'Group name is required');
    const memberIds = Array.isArray(req.body?.members) ? req.body.members : [];
    if (memberIds.some((id) => !validUuid(id))) return error(res, 400, 'Invalid member userId');
    const id = randomUUID();
    const splitId = req.body?.splitId || null;
    const invitation = createInvitationToken();
    const joinUrl = `${QR_BASE_URL.replace(/\/$/, '')}/group/join?groupId=${id}&splitId=${splitId || ''}&invite=${invitation.token}`;
    const qrCode = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: 'M', type: 'image/png', margin: 1, width: 300 });
    const group = await createGroupRecord({
      id,
      name,
      description: String(req.body?.description ?? '').trim().slice(0, 500),
      createdBy,
      memberIds,
      defaultCurrency: String(req.body?.defaultCurrency || 'NPR').toUpperCase().slice(0, 3),
      image: COVERS[Math.floor(Math.random() * COVERS.length)],
      splitId,
      sessionId: req.body?.sessionId || null,
      qrCode,
      invitation: {
        tokenHash: invitation.tokenHash,
        expiresAt: new Date(Date.now() + Math.min(365, Math.max(1, Number(process.env.GROUP_INVITE_DURATION_DAYS) || 30)) * 86400000),
      },
    });
    return res.status(201).json({ success: true, message: 'Group created successfully with QR code', data: group, inviteUrl: joinUrl });
  } catch (cause) {
    console.error('Create group failed:', cause);
    return error(res, cause?.code === 'P2003' ? 400 : 500, cause?.code === 'P2003' ? 'A referenced user or split does not exist' : 'Internal server error');
  }
};

export const getGroups = async (req, res) => {
  try {
    const paging = paginationFrom(req.query);
    const result = await listGroupsForUser(req.user.id, { ...paging, withMeta: true });
    return res.json({ success: true, count: result.items.length, data: result.items, pagination: paginationMeta(result) });
  } catch (cause) {
    console.error('List groups failed:', cause);
    return error(res, 500, 'Internal server error');
  }
};

export const getGroupById = async (req, res) => {
  if (!validUuid(req.params.groupId)) return error(res, 400, 'Invalid groupId');
  const group = await findGroupForUser({ id: req.params.groupId, userId: req.user.id });
  return group ? res.json({ success: true, data: group }) : error(res, 404, 'Group not found');
};

export const getGroupBySplitId = async (req, res) => {
  if (!validUuid(req.params.splitId)) return error(res, 400, 'Invalid splitId');
  const group = await findGroupForUser({ splitId: req.params.splitId, userId: req.user.id });
  return group ? res.json({ success: true, data: group }) : error(res, 404, 'Group not found for this split');
};

export const updateGroup = async (req, res) => {
  if (!validUuid(req.params.groupId)) return error(res, 400, 'Invalid groupId');
  const data = {};
  if (req.body?.name !== undefined) data.name = String(req.body.name).trim().slice(0, 100);
  if (req.body?.description !== undefined) data.description = String(req.body.description).trim().slice(0, 500);
  if (req.body?.defaultCurrency !== undefined) data.defaultCurrency = String(req.body.defaultCurrency).toUpperCase().slice(0, 3);
  if (!Object.keys(data).length || ('name' in data && !data.name)) return error(res, 400, 'No valid fields provided for update');
  const group = await updateOwnedGroup({ id: req.params.groupId, ownerId: req.user.id, data });
  return group ? res.json({ success: true, message: 'Group updated successfully', data: group }) : error(res, 404, 'Group not found');
};

export const joinGroup = async (req, res) => {
  const { groupId } = req.params;
  if (!validUuid(groupId)) return error(res, 400, 'Invalid groupId');
  try {
    const result = await addGroupMember({ groupId, actorId: req.user.id, userId: req.user.id, inviteToken: req.body.inviteToken, requireInvitation: true });
    if (result.status === 'not-found') return error(res, 404, 'Group not found');
    if (result.status === 'invalid-invitation') return error(res, 403, 'Invitation is invalid, expired, or revoked');
    const splitId = await recalculateGroupSplit(groupId);
    emit(groupId, 'participant-joined', { participants: result.group.members, newParticipant: result.group.members.find((m) => m.id === req.user.id) });
    if (splitId) emit(groupId, 'split-updated', { splitId });
    return res.json({ success: true, message: result.status === 'exists' ? 'Already a member of this group' : 'Joined group successfully', data: result.group });
  } catch (cause) {
    console.error('Join group failed:', cause);
    return error(res, cause?.code === 'P2003' ? 400 : 500, cause?.code === 'P2003' ? 'User does not exist' : 'Internal server error');
  }
};

export const addMember = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.body?.userId;
  if (!validUuid(groupId) || !validUuid(userId)) return error(res, 400, 'Valid groupId and userId are required');
  const result = await addGroupMember({ groupId, actorId: req.user.id, userId, ownerOnly: true });
  if (result.status === 'not-found') return error(res, 404, 'Group not found');
  if (result.status === 'exists') return error(res, 409, 'User is already a member of this group');
  await recalculateGroupSplit(groupId);
  return res.json({ success: true, message: 'Member added successfully', data: result.group });
};

export const removeMember = async (req, res) => {
  const { groupId, userId } = req.params;
  if (!validUuid(groupId) || !validUuid(userId)) return error(res, 400, 'Invalid groupId or userId');
  const result = await removeGroupMember({ groupId, ownerId: req.user.id, userId });
  if (result.status === 'not-found') return error(res, 404, 'Group not found');
  if (result.status === 'owner') return error(res, 403, 'Cannot remove group creator');
  if (result.status === 'not-member') return error(res, 404, 'User is not a member of this group');
  await recalculateGroupSplit(groupId);
  return res.json({ success: true, message: 'Member removed successfully', data: result.group });
};

export const deactivateGroup = async (req, res) => {
  if (!validUuid(req.params.groupId)) return error(res, 400, 'Invalid groupId');
  const group = await updateOwnedGroup({ id: req.params.groupId, ownerId: req.user.id, data: { isActive: false } });
  return group ? res.json({ success: true, message: 'Group deactivated successfully', data: group }) : error(res, 404, 'Group not found');
};
