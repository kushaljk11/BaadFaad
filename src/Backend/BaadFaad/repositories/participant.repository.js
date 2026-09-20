import { getPrisma } from '../config/prisma.js';

export function toParticipantDto(participant) {
  if (!participant) return null;
  return {
    _id: participant.id,
    id: participant.id,
    user: participant.userId,
    name: participant.name,
    email: participant.email,
    isHost: participant.isHost,
    joinedAt: participant.joinedAt,
    totalOwed: participant.totalOwed,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
}

export async function createOwnedParticipant({ userId, name, email, isHost }) {
  return toParticipantDto(await getPrisma().participant.create({
    data: { userId, name, email, isHost },
  }));
}

export async function listOwnedParticipants(userId, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const where = { userId };
  const prisma = getPrisma();
  const [rows, total] = await prisma.$transaction([
    prisma.participant.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.participant.count({ where }),
  ]);
  const items = rows.map(toParticipantDto);
  return options.withMeta ? { items, total, page, limit } : items;
}

export async function findOwnedParticipant({ id, userId }) {
  return toParticipantDto(await getPrisma().participant.findFirst({ where: { id, userId } }));
}

export async function updateOwnedParticipant({ id, userId, data }) {
  const result = await getPrisma().participant.updateMany({ where: { id, userId }, data });
  return result.count ? findOwnedParticipant({ id, userId }) : null;
}

export async function deleteOwnedParticipant({ id, userId }) {
  const existing = await findOwnedParticipant({ id, userId });
  if (!existing) return null;
  await getPrisma().participant.delete({ where: { id } });
  return existing;
}
