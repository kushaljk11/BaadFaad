import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { getIO } from '../config/socket.js';
import {
  createSessionForSplit,
  findSessionForUser,
  joinSessionAsUser,
  listSessionsForUser,
} from '../repositories/session.repository.js';
import { paginationFrom, paginationMeta } from '../utils/pagination.js';
import { createInvitationToken } from '../utils/invitation.js';

const QR_BASE_URL = process.env.QR_BASE_URL || 'https://baadfaad.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (value) => UUID.test(String(value ?? ''));

export const createSession = async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 100);
    const splitId = req.body?.splitId;
    if (!name || !validUuid(splitId)) return res.status(400).json({ message: 'Valid name and splitId are required' });
    const id = randomUUID();
    const invitation = createInvitationToken();
    const joinUrl = `${QR_BASE_URL.replace(/\/$/, '')}/session/join?splitId=${splitId}&sessionId=${id}&invite=${invitation.token}`;
    const qrCode = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: 'M', type: 'image/png', margin: 1, width: 300 });
    const durationHours = Math.min(168, Math.max(1, Number(process.env.SESSION_DURATION_HOURS) || 24));
    const result = await createSessionForSplit({
      id, name, splitId, ownerId: req.user.id, qrCode,
      endDate: new Date(Date.now() + durationHours * 3600000),
      invitation: { tokenHash: invitation.tokenHash },
    });
    if (result.status === 'forbidden') return res.status(403).json({ message: 'Only the split owner can create a session' });
    if (result.status === 'exists') return res.json({ message: 'Session already exists for this split', session: result.session });
    return res.status(201).json({ message: 'Session created with QR code', session: result.session, inviteUrl: joinUrl });
  } catch (error) {
    console.error('Failed to create session:', error);
    return res.status(500).json({ message: 'Failed to create session' });
  }
};

export const getAllSessions = async (req, res) => {
  try {
    const pagination = paginationFrom(req.query);
    const result = await listSessionsForUser(req.user.id, { ...pagination, withMeta: true });
    return res.json({ sessions: result.items, pagination: paginationMeta(result) });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

export const getSessionById = async (req, res) => {
  if (!validUuid(req.params.id)) return res.status(400).json({ message: 'Invalid session id' });
  const session = await findSessionForUser({ id: req.params.id, userId: req.user.id });
  return session ? res.json(session) : res.status(404).json({ message: 'Session not found' });
};

export const getSessionBySplitId = async (req, res) => {
  if (!validUuid(req.params.splitId)) return res.status(400).json({ message: 'Invalid split id' });
  const session = await findSessionForUser({ splitId: req.params.splitId, userId: req.user.id });
  return session ? res.json(session) : res.status(404).json({ message: 'Session not found for this split' });
};

export const joinSession = async (req, res) => {
  const { sessionId } = req.params;
  if (!validUuid(sessionId)) return res.status(400).json({ message: 'Invalid session id' });
  try {
    const result = await joinSessionAsUser({ sessionId, userId: req.user.id, inviteToken: req.body.inviteToken, requireInvitation: true });
    if (result.status === 'not-found') return res.status(404).json({ message: 'Session not found' });
    if (result.status === 'expired') return res.status(400).json({ message: 'Session has expired' });
    if (result.status === 'invalid-invitation') return res.status(403).json({ message: 'Invitation is invalid, expired, or revoked' });
    if (result.status === 'user-not-found') return res.status(401).json({ message: 'User not found' });
    const joinedIndex = result.session.participants.findIndex((participant) => participant.user?.id === req.user.id);
    const flatParticipants = result.session.participants.map((participant) => ({
      _id: participant._id, name: participant.name, email: participant.email, joinedAt: participant.joinedAt,
    }));
    try {
      getIO().to(sessionId).emit('participant-joined', {
        participants: flatParticipants,
        newParticipant: flatParticipants[joinedIndex] || flatParticipants.at(-1),
      });
    } catch { /* socket is non-critical */ }
    return res.json({ message: result.status === 'exists' ? 'Already joined this session' : 'Joined session successfully', session: result.session });
  } catch (error) {
    console.error('Failed to join session:', error);
    return res.status(500).json({ message: 'Failed to join session' });
  }
};
