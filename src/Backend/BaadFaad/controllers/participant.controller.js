import {
  createOwnedParticipant,
  deleteOwnedParticipant,
  findOwnedParticipant,
  listOwnedParticipants,
  updateOwnedParticipant,
} from '../repositories/participant.repository.js';
import { paginationFrom, paginationMeta } from '../utils/pagination.js';

function participantInput(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body?.name !== undefined) {
    data.name = String(body?.name ?? '').trim().slice(0, 100);
    if (!data.name) throw new TypeError('Participant name is required');
  }
  if (!partial || body?.email !== undefined) {
    data.email = String(body?.email ?? '').trim().toLowerCase().slice(0, 320);
    if (!data.email || !data.email.includes('@')) throw new TypeError('Valid participant email is required');
  }
  if (!partial || body?.isHost !== undefined) data.isHost = Boolean(body?.isHost);
  return data;
}

export const createParticipant = async (req, res, next) => {
  try {
    const participant = await createOwnedParticipant({
      userId: req.user.id,
      ...participantInput(req.body),
    });
    return res.status(201).json(participant);
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
};

export const getParticipants = async (req, res, next) => {
  try {
    const pagination = paginationFrom(req.query);
    const result = await listOwnedParticipants(req.user.id, { ...pagination, withMeta: true });
    return res.json({ participants: result.items, pagination: paginationMeta(result) });
  } catch (error) {
    return next(error);
  }
};

export const getParticipantById = async (req, res, next) => {
  try {
    const participant = await findOwnedParticipant({ id: req.params.id, userId: req.user.id });
    if (!participant) return res.status(404).json({ message: 'Participant not found' });
    return res.json(participant);
  } catch (error) {
    return next(error);
  }
};

export const updateParticipant = async (req, res, next) => {
  try {
    const data = participantInput(req.body, { partial: true });
    if (Object.keys(data).length === 0) return res.status(400).json({ message: 'No supported fields provided' });
    const participant = await updateOwnedParticipant({ id: req.params.id, userId: req.user.id, data });
    if (!participant) return res.status(404).json({ message: 'Participant not found' });
    return res.json(participant);
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ message: error.message });
    return next(error);
  }
};

export const deleteParticipant = async (req, res, next) => {
  try {
    const participant = await deleteOwnedParticipant({ id: req.params.id, userId: req.user.id });
    if (!participant) return res.status(404).json({ message: 'Participant not found' });
    return res.json({ message: 'Participant deleted' });
  } catch (error) {
    return next(error);
  }
};
