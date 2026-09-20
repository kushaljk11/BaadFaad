import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { allocateEvenly, fromPaisa, toPaisa } from '../utils/money.js';
import { consumeInvitation } from '../utils/invitation.js';

const userDto = (user) => user && ({
  _id: user.id, id: user.id, name: user.name, fullName: user.name,
  email: user.email, image: user.image, avatarUrl: user.image,
});

export function toGroupDto(group) {
  if (!group) return null;
  const activeMemberships = (group.relationalMembers || []).filter((member) => !member.removedAt);
  return {
    _id: group.id,
    id: group.id,
    name: group.name,
    description: group.description,
    members: activeMemberships.map((member) => userDto(member.user)),
    createdBy: userDto(group.owner) || group.createdBy,
    image: group.image,
    splitId: group.splitId,
    sessionId: group.sessionId,
    qrCode: group.qrCode,
    defaultCurrency: group.defaultCurrency,
    isActive: group.isActive,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

const includeMembers = {
  relationalMembers: {
    where: { removedAt: null },
    include: { user: true },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  },
};

async function withOwner(prisma, group) {
  if (!group) return null;
  const owner = await prisma.user.findUnique({ where: { id: group.createdBy } });
  return { ...group, owner };
}

export async function createGroupRecord({ id = randomUUID(), name, description, createdBy, memberIds, defaultCurrency, image, splitId, sessionId, qrCode, invitation }) {
  const prisma = getPrisma();
  const uniqueMembers = [...new Set([createdBy, ...memberIds])];
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        id, name, description, createdBy, members: uniqueMembers, defaultCurrency, image,
        splitId: splitId || null, sessionId: sessionId || null, qrCode,
        relationalMembers: {
          create: uniqueMembers.map((userId) => ({ userId, role: userId === createdBy ? 'OWNER' : 'MEMBER' })),
        },
      },
      include: includeMembers,
    });
    if (invitation) await tx.invitation.create({ data: {
      type: 'GROUP', tokenHash: invitation.tokenHash, createdById: createdBy,
      groupId: id, expiresAt: invitation.expiresAt, maxUses: invitation.maxUses || 0,
    } });
    return created;
  });
  return toGroupDto(await withOwner(prisma, group));
}

export async function listGroupsForUser(userId, options = {}) {
  const prisma = getPrisma();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const where = { OR: [{ createdBy: userId }, { relationalMembers: { some: { userId, removedAt: null } } }] };
  const [groups, total] = await prisma.$transaction([prisma.group.findMany({
    where,
    include: includeMembers,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  }), prisma.group.count({ where })]);
  const owners = await prisma.user.findMany({ where: { id: { in: [...new Set(groups.map((g) => g.createdBy))] } } });
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));
  const items = groups.map((group) => toGroupDto({ ...group, owner: ownerMap.get(group.createdBy) }));
  return options.withMeta ? { items, total, page, limit } : items;
}

export async function findGroupForUser({ id, userId, splitId }) {
  const prisma = getPrisma();
  const group = await prisma.group.findFirst({
    where: {
      ...(id ? { id } : { splitId }),
      OR: [{ createdBy: userId }, { relationalMembers: { some: { userId, removedAt: null } } }],
    },
    include: includeMembers,
  });
  return toGroupDto(await withOwner(prisma, group));
}

export async function updateOwnedGroup({ id, ownerId, data }) {
  const prisma = getPrisma();
  const updated = await prisma.group.updateMany({ where: { id, createdBy: ownerId }, data });
  return updated.count ? findGroupForUser({ id, userId: ownerId }) : null;
}

export async function addGroupMember({ groupId, actorId, userId, ownerOnly = false, inviteToken, requireInvitation = false }) {
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.findFirst({
      where: { id: groupId, isActive: true, ...(ownerOnly ? { createdBy: actorId } : {}) },
      include: includeMembers,
    });
    if (!group) return { status: 'not-found' };
    if (requireInvitation && !await consumeInvitation(tx, { token: inviteToken, type: 'GROUP', groupId })) return { status: 'invalid-invitation' };
    const existing = group.relationalMembers.find((member) => member.userId === userId && !member.removedAt);
    if (!existing) {
      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId, userId } },
        create: { groupId, userId, role: 'MEMBER' },
        update: { removedAt: null },
      });
      await tx.group.update({ where: { id: groupId }, data: { members: [...new Set([...group.members, userId])] } });
    }
    return { status: existing ? 'exists' : 'added' };
  });
  if (result.status === 'not-found') return result;
  return { ...result, group: await findGroupForUser({ id: groupId, userId: actorId }) };
}

export async function removeGroupMember({ groupId, ownerId, userId }) {
  const prisma = getPrisma();
  const status = await prisma.$transaction(async (tx) => {
    const group = await tx.group.findFirst({ where: { id: groupId, createdBy: ownerId } });
    if (!group) return 'not-found';
    if (userId === group.createdBy) return 'owner';
    const member = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!member || member.removedAt) return 'not-member';
    await tx.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { removedAt: new Date() } });
    await tx.group.update({ where: { id: groupId }, data: { members: group.members.filter((id) => id !== userId) } });
    return 'removed';
  });
  return { status, group: status === 'removed' ? await findGroupForUser({ id: groupId, userId: ownerId }) : null };
}

export async function recalculateGroupSplit(groupId) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId }, include: includeMembers });
    if (!group?.splitId || !group.relationalMembers.length) return null;
    const split = await tx.split.findUnique({ where: { id: group.splitId } });
    if (!split) return null;
    const totalPaisa = split.totalPaisa ?? toPaisa(split.totalAmount);
    const allocations = allocateEvenly(totalPaisa, group.relationalMembers.map((member) => member.userId));
    const amountMap = new Map(allocations.map((row) => [row.key, row.amountPaisa]));
    const breakdown = group.relationalMembers.map((member, index) => ({
      user: member.userId,
      name: member.user.name,
      email: member.user.email,
      amount: Number(fromPaisa(amountMap.get(member.userId))),
      amountPaid: 0,
      paymentStatus: 'unpaid',
      percentage: Math.round((10000 / group.relationalMembers.length)) / 100,
      items: [],
    }));
    await tx.split.update({ where: { id: split.id }, data: { totalPaisa, breakdown, status: 'calculated', calculatedAt: new Date() } });
    for (const [sortOrder, member] of group.relationalMembers.entries()) {
      await tx.splitParticipant.upsert({
        where: { splitId_userId: { splitId: split.id, userId: member.userId } },
        create: { splitId: split.id, userId: member.userId, displayName: member.user.name, email: member.user.email, amountPaisa: amountMap.get(member.userId), sortOrder },
        update: { displayName: member.user.name, email: member.user.email, amountPaisa: amountMap.get(member.userId), sortOrder },
      });
    }
    return split.id;
  });
}
