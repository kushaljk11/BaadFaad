import crypto from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { consumeInvitation } from '../utils/invitation.js';

const participantInclude = {
  relationalParticipants: {
    where: { leftAt: null },
    include: { user: true, participant: true },
    orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
  },
};

function identityDto(row) {
  const identity = row.user || row.participant;
  return {
    _id: row.id,
    id: row.id,
    user: row.user ? { _id: row.user.id, id: row.user.id, name: row.user.name, email: row.user.email } : undefined,
    participant: row.participant ? { _id: row.participant.id, id: row.participant.id, name: row.participant.name, email: row.participant.email } : undefined,
    name: row.displayName || identity?.name || 'Anonymous',
    email: row.email || identity?.email || '',
    isHost: row.isHost,
    joinedAt: row.joinedAt,
  };
}

export function toSessionDto(session) {
  if (!session) return null;
  const relational = session.relationalParticipants || [];
  return {
    _id: session.id,
    id: session.id,
    name: session.name,
    splitId: session.splitId,
    participants: relational.length ? relational.map(identityDto) : session.participants,
    qrCode: session.qrCode,
    startDate: session.startDate,
    endDate: session.endDate,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function createSessionForSplit({ id, name, splitId, ownerId, qrCode, endDate, invitation }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const split = await tx.split.findFirst({ where: { id: splitId, createdBy: ownerId } });
    if (!split) return { status: 'forbidden' };
    const existing = await tx.session.findUnique({ where: { splitId }, include: participantInclude });
    if (existing) return { status: 'exists', session: toSessionDto(existing) };
    const user = await tx.user.findUnique({ where: { id: ownerId } });
    if (!user) return { status: 'forbidden' };
    const legacyHost = { _id: crypto.randomUUID(), user: ownerId, name: user.name, email: user.email, joinedAt: new Date() };
    const session = await tx.session.create({
      data: {
        id, name, splitId, qrCode, endDate,
        participants: [legacyHost],
        relationalParticipants: { create: { userId: ownerId, displayName: user.name, email: user.email, isHost: true } },
      },
      include: participantInclude,
    });
    if (invitation) await tx.invitation.create({ data: {
      type: 'SESSION', tokenHash: invitation.tokenHash, createdById: ownerId,
      sessionId: id, expiresAt: endDate, maxUses: invitation.maxUses || 0,
    } });
    return { status: 'created', session: toSessionDto(session) };
  });
}

export async function listSessionsForUser(userId, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const where = { relationalParticipants: { some: { userId, leftAt: null } } };
  const prisma = getPrisma();
  const [sessions, total] = await prisma.$transaction([
    prisma.session.findMany({ where, include: participantInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.session.count({ where }),
  ]);
  const items = sessions.map(toSessionDto);
  return options.withMeta ? { items, total, page, limit } : items;
}

export async function findSessionForUser({ id, splitId, userId }) {
  const session = await getPrisma().session.findFirst({
    where: {
      ...(id ? { id } : { splitId }),
      relationalParticipants: { some: { userId, leftAt: null } },
    },
    include: participantInclude,
  });
  return toSessionDto(session);
}

export async function joinSessionAsUser({ sessionId, userId, inviteToken, requireInvitation = false }) {
  const prisma = getPrisma();
  const status = await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId }, include: participantInclude });
    if (!session) return 'not-found';
    if (session.endDate < new Date()) return 'expired';
    if (requireInvitation && !await consumeInvitation(tx, { token: inviteToken, type: 'SESSION', sessionId })) return 'invalid-invitation';
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return 'user-not-found';
    const active = session.relationalParticipants.find((row) => row.userId === userId && !row.leftAt);
    if (active) return 'exists';
    await tx.sessionParticipant.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, displayName: user.name, email: user.email },
      update: { displayName: user.name, email: user.email, leftAt: null },
    });
    const legacy = Array.isArray(session.participants) ? session.participants : [];
    if (!legacy.some((row) => String(row?.user) === userId)) {
      await tx.session.update({
        where: { id: sessionId },
        data: { participants: [...legacy, { _id: crypto.randomUUID(), user: userId, name: user.name, email: user.email, joinedAt: new Date() }] },
      });
    }
    return 'joined';
  });
  return { status, session: ['joined', 'exists'].includes(status) ? await findSessionForUser({ id: sessionId, userId }) : null };
}

export async function canAccessRealtimeRoom(roomId, userId, hostOnly = false) {
  const prisma = getPrisma();
  const sessionMembership = await prisma.sessionParticipant.findFirst({
    where: { sessionId: roomId, userId, leftAt: null, ...(hostOnly ? { isHost: true } : {}) },
    select: { id: true },
  });
  if (sessionMembership) return true;
  const groupMembership = await prisma.groupMember.findFirst({
    where: { groupId: roomId, userId, removedAt: null, ...(hostOnly ? { role: 'OWNER' } : {}) },
    select: { id: true },
  });
  return Boolean(groupMembership);
}
