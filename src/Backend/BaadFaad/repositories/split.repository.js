import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { allocateEvenly, fromPaisa, toPaisa } from '../utils/money.js';
import { calculateSplitRows } from '../utils/splitEngine.js';
import { toReceiptDto } from './receipt.repository.js';

const includeSplit = {
  receipt: { include: { relationalItems: { orderBy: { sortOrder: 'asc' } } } },
  relationalParticipants: {
    include: {
      user: true,
      participant: true,
      itemAssignments: { include: { receiptItem: true } },
      paymentAllocations: {
        where: { payment: { status: 'VERIFIED' } },
        include: { payment: { include: { paidByUser: true } } },
      },
    },
    orderBy: { sortOrder: 'asc' },
  },
  relationalPayments: {
    include: { paidByUser: true, allocations: true },
    orderBy: { createdAt: 'asc' },
  },
};

const moneyNumber = (value) => Number(fromPaisa(value));
const identityId = (row) => row.userId || row.participantId || row.id;

export function toSplitDto(split) {
  if (!split) return null;
  const legacy = Array.isArray(split.breakdown) ? split.breakdown : [];
  const breakdown = split.relationalParticipants.map((row, index) => {
    const old = legacy.find((entry) => String(entry?._id || entry?.user || entry?.participant || '') === String(row.id || identityId(row))) || legacy[index] || {};
    const identity = row.user || row.participant;
    const paidPaisa = row.paymentAllocations.reduce((sum, allocation) => sum + allocation.amountPaisa, 0n);
    const payer = row.paymentAllocations.find((allocation) => allocation.payment.paidByUser)?.payment.paidByUser;
    return {
      ...old,
      _id: row.id,
      id: row.id,
      user: row.user ? { _id: row.user.id, id: row.user.id, name: row.user.name, email: row.user.email } : undefined,
      participant: row.participant ? { _id: row.participant.id, id: row.participant.id, name: row.participant.name, email: row.participant.email } : undefined,
      name: row.displayName || identity?.name || 'Participant',
      email: row.email || identity?.email || '',
      amount: moneyNumber(row.amountPaisa),
      amountPaid: moneyNumber(paidPaisa),
      paidByName: payer?.name || old.paidByName || '',
      percentage: row.percentageBps == null ? old.percentage : row.percentageBps / 100,
      paymentStatus: row.status.toLowerCase(),
      items: row.itemAssignments.length ? row.itemAssignments.map((assignment) => ({
        _id: assignment.receiptItemId,
        itemName: assignment.receiptItem.name,
        itemPrice: moneyNumber(assignment.receiptItem.unitPricePaisa),
        quantity: Number(assignment.quantity),
        amount: moneyNumber(assignment.amountPaisa),
      })) : (old.items || []),
    };
  });
  return {
    _id: split.id, id: split.id, createdBy: split.createdBy, name: split.name,
    receiptId: split.receiptId, receipt: split.receipt ? toReceiptDto(split.receipt) : null,
    splitType: split.splitType, status: split.status, breakdown,
    payments: split.payments, totalAmount: moneyNumber(split.totalPaisa ?? toPaisa(split.totalAmount)),
    calculatedAt: split.calculatedAt, finalizedAt: split.finalizedAt, notes: split.notes,
    createdAt: split.createdAt, updatedAt: split.updatedAt,
  };
}

async function resolveIdentities(tx, entries) {
  const ids = [...new Set(entries.map((entry) => String(entry?.user?._id || entry?.user || entry?.participant?._id || entry?.participant || entry?._id || entry?.id || '')).filter(Boolean))];
  const users = await tx.user.findMany({ where: { id: { in: ids } } });
  const participants = await tx.participant.findMany({ where: { id: { in: ids } } });
  const userMap = new Map(users.map((row) => [row.id, row]));
  const participantMap = new Map(participants.map((row) => [row.id, row]));
  return entries.map((entry) => {
    const id = String(entry?.user?._id || entry?.user || entry?.participant?._id || entry?.participant || entry?._id || entry?.id || '');
    const user = userMap.get(id);
    const participant = participantMap.get(id);
    if (!user && !participant && !entry?.name) throw new TypeError(`Participant ${id || '(missing)'} was not found`);
    return { entry, user, participant };
  });
}

function equalRows(totalPaisa, identities) {
  const keys = identities.map((identity, index) => identity.user?.id || identity.participant?.id || `guest:${index}`);
  const allocations = allocateEvenly(totalPaisa, keys);
  return identities.map((identity, index) => ({ ...identity, amountPaisa: allocations[index].amountPaisa, percentageBps: Math.floor(10000 / identities.length) + (index < 10000 % identities.length ? 1 : 0) }));
}

function legacyBreakdown(rows) {
  return rows.map((row) => ({
    _id: row.id,
    ...(row.userId ? { user: row.userId } : {}),
    ...(row.participantId ? { participant: row.participantId } : {}),
    name: row.displayName, email: row.email || '', amount: moneyNumber(row.amountPaisa),
    amountPaid: 0, paidByName: '', paymentStatus: row.status.toLowerCase(),
    percentage: row.percentageBps == null ? undefined : row.percentageBps / 100, items: row.sourceItems || [],
  }));
}

export async function createSplitRecord({ createdBy, receiptId, splitType, participants, breakdown, name, totalAmount }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    let totalPaisa = toPaisa(totalAmount ?? 0);
    let receiptItems = [];
    if (receiptId) {
      const receipt = await tx.receipt.findFirst({ where: { id: receiptId, createdBy }, include: { relationalItems: true } });
      if (!receipt) return { status: 'receipt-not-found' };
      totalPaisa = receipt.totalPaisa ?? toPaisa(receipt.totalAmount);
      receiptItems = receipt.relationalItems;
    }
    const input = breakdown?.length ? breakdown : participants?.length ? participants : [{ _id: createdBy, name: 'You' }];
    const identities = await resolveIdentities(tx, input);
    const calculations = calculateSplitRows(splitType || 'equal', totalPaisa, identities.map((identity) => identity.entry));
    const allocated = identities.map((identity, index) => ({ ...identity, ...calculations[index] }));
    const rows = allocated.map((row, sortOrder) => ({
      id: randomUUID(), userId: row.user?.id || null, participantId: row.user ? null : row.participant?.id || null,
      displayName: row.entry.name || row.user?.name || row.participant?.name || 'Participant',
      email: row.entry.email || row.user?.email || row.participant?.email || null,
      amountPaisa: row.amountPaisa, percentageBps: row.percentageBps, status: 'UNPAID', sortOrder, sourceItems: row.entry.items || [],
    }));
    if ((splitType || 'equal') === 'item_based' && !receiptId) throw new TypeError('Item-based splits require a receipt');
    const databaseRows = rows.map(({ sourceItems: _sourceItems, ...row }) => row);
    const split = await tx.split.create({ data: {
      createdBy, name: String(name || '').slice(0, 100), receiptId: receiptId || null,
      splitType: splitType || 'equal', status: 'calculated', totalAmount: moneyNumber(totalPaisa), totalPaisa,
      calculatedAt: new Date(), breakdown: legacyBreakdown(rows),
      relationalParticipants: { create: databaseRows },
    } });
    if ((splitType || 'equal') === 'item_based') {
      const itemMap = new Map();
      for (const item of receiptItems) {
        itemMap.set(item.id.toLowerCase(), item);
        if (!itemMap.has(item.name.toLowerCase())) itemMap.set(item.name.toLowerCase(), item);
      }
      for (const row of rows) {
        const seen = new Set();
        for (const item of row.sourceItems) {
          const key = String(item?.receiptItemId || item?._id || item?.itemName || item?.name || '').toLowerCase();
          const receiptItem = itemMap.get(key);
          if (!receiptItem) throw new TypeError(`Receipt item ${key || '(missing)'} was not found`);
          if (seen.has(receiptItem.id)) throw new TypeError(`Receipt item ${receiptItem.name} is duplicated for one participant`);
          seen.add(receiptItem.id);
          const quantity = Number(item?.quantity ?? 1);
          const amountPaisa = toPaisa(item?.amount ?? item?.totalPrice ?? Number(item?.itemPrice ?? item?.price) * quantity);
          await tx.splitItemAssignment.create({ data: { splitParticipantId: row.id, receiptItemId: receiptItem.id, quantity, amountPaisa } });
        }
      }
    }
    return { status: 'created', split: toSplitDto(await tx.split.findUnique({ where: { id: split.id }, include: includeSplit })) };
  });
}

export async function findSplitForUser(id, userId) {
  const split = await getPrisma().split.findFirst({ where: {
    id,
    OR: [{ createdBy: userId }, { relationalParticipants: { some: { userId } } }],
  }, include: includeSplit });
  return toSplitDto(split);
}

export async function listSplitsForUser(userId, options = {}) {
  const prisma = getPrisma();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const where = {
    OR: [
      { createdBy: userId },
      { relationalParticipants: { some: { userId } } },
      { sessions: { some: { relationalParticipants: { some: { userId, leftAt: null } } } } },
    ],
  };
  const [rows, total] = await prisma.$transaction([
    prisma.split.findMany({
      where,
      include: { ...includeSplit, sessions: { select: { name: true }, take: 1 } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.split.count({ where }),
  ]);
  const items = rows.map((row) => ({ ...toSplitDto(row), sessionName: row.sessions[0]?.name || '' }));
  return options.withMeta ? { items, total, page, limit } : items;
}

export async function updateOwnedSplit({ id, ownerId, data }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const split = await tx.split.findFirst({ where: { id, createdBy: ownerId } });
    if (!split) return null;
    const update = {};
    if (data.receiptId) {
      const receipt = await tx.receipt.findFirst({ where: { id: data.receiptId, createdBy: ownerId } });
      if (!receipt) throw new TypeError('Receipt not found');
      update.receiptId = receipt.id; update.totalPaisa = receipt.totalPaisa ?? toPaisa(receipt.totalAmount); update.totalAmount = moneyNumber(update.totalPaisa);
    } else if (data.totalAmount !== undefined) {
      update.totalPaisa = toPaisa(data.totalAmount); update.totalAmount = moneyNumber(update.totalPaisa);
    }
    if (data.splitType) update.splitType = String(data.splitType);
    if (data.notes !== undefined) update.notes = String(data.notes).slice(0, 2000);
    if (data.status) { update.status = String(data.status); if (data.status === 'finalized') update.finalizedAt = new Date(); }
    const memberships = await tx.sessionParticipant.findMany({ where: { session: { splitId: id }, leftAt: null }, include: { user: true, participant: true }, orderBy: { joinedAt: 'asc' } });
    const groupMembers = memberships.length ? [] : await tx.groupMember.findMany({ where: { group: { splitId: id }, removedAt: null }, include: { user: true }, orderBy: { joinedAt: 'asc' } });
    const identities = memberships.length
      ? memberships.map((row) => ({ entry: row, user: row.user, participant: row.participant }))
      : groupMembers.map((row) => ({ entry: row, user: row.user, participant: null }));
    if (identities.length && (data.receiptId || data.totalAmount !== undefined || data.ensureMembers)) {
      const totalPaisa = update.totalPaisa ?? split.totalPaisa ?? toPaisa(split.totalAmount);
      const allocated = equalRows(totalPaisa, identities);
      const rows = [];
      for (const [sortOrder, row] of allocated.entries()) {
        const userId = row.user?.id || null; const participantId = userId ? null : row.participant?.id || null;
        const existing = await tx.splitParticipant.findFirst({ where: { splitId: id, ...(userId ? { userId } : { participantId }) } });
        const values = { displayName: row.entry.displayName || row.user?.name || row.participant?.name || 'Participant', email: row.entry.email || row.user?.email || row.participant?.email || null, amountPaisa: row.amountPaisa, percentageBps: row.percentageBps, sortOrder };
        const saved = existing ? await tx.splitParticipant.update({ where: { id: existing.id }, data: values }) : await tx.splitParticipant.create({ data: { splitId: id, userId, participantId, status: 'UNPAID', ...values } });
        rows.push(saved);
      }
      update.breakdown = legacyBreakdown(rows); update.status = 'calculated'; update.calculatedAt = new Date();
    }
    await tx.split.update({ where: { id }, data: update });
    return toSplitDto(await tx.split.findUnique({ where: { id }, include: includeSplit }));
  });
}

export async function updateSplitParticipantStatus({ splitId, index, actorId, amountPaid, paymentStatus }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const split = await tx.split.findUnique({ where: { id: splitId }, include: { relationalParticipants: { orderBy: { sortOrder: 'asc' } } } });
    if (!split) return { status: 'not-found' };
    const participant = split.relationalParticipants[index];
    if (!participant) return { status: 'bad-index' };
    if (split.createdBy !== actorId && participant.userId !== actorId) return { status: 'forbidden' };
    const paid = amountPaid === undefined ? null : toPaisa(amountPaid);
    const nextStatus = paymentStatus ? String(paymentStatus).toUpperCase() : paid >= participant.amountPaisa ? 'PAID' : paid > 0n ? 'PARTIAL' : 'UNPAID';
    if (!['UNPAID', 'PARTIAL', 'PAID'].includes(nextStatus)) throw new TypeError('Invalid payment status');
    if (paid !== null) {
      const note = `manual-status:${participant.id}`;
      const existingAllocation = await tx.paymentAllocation.findFirst({
        where: { splitParticipantId: participant.id, payment: { splitId, method: 'manual-status', note } },
        include: { payment: true },
      });
      if (paid === 0n && existingAllocation) {
        await tx.payment.delete({ where: { id: existingAllocation.paymentId } });
      } else if (paid > 0n && existingAllocation) {
        await tx.payment.update({ where: { id: existingAllocation.paymentId }, data: { amountPaisa: paid, paidByUserId: actorId, status: 'VERIFIED', verifiedAt: new Date() } });
        await tx.paymentAllocation.update({ where: { id: existingAllocation.id }, data: { amountPaisa: paid } });
      } else if (paid > 0n) {
        await tx.payment.create({ data: {
          splitId, paidByUserId: actorId, amountPaisa: paid, method: 'manual-status', status: 'VERIFIED', note, verifiedAt: new Date(),
          allocations: { create: { splitParticipantId: participant.id, amountPaisa: paid } },
        } });
      }
    }
    await tx.splitParticipant.update({ where: { id: participant.id }, data: { status: nextStatus } });
    const legacy = Array.isArray(split.breakdown) ? [...split.breakdown] : [];
    if (legacy[index]) legacy[index] = { ...legacy[index], ...(paid == null ? {} : { amountPaid: moneyNumber(paid) }), paymentStatus: nextStatus.toLowerCase() };
    await tx.split.update({ where: { id: splitId }, data: { breakdown: legacy } });
    return { status: 'updated' };
  }).then(async (result) => ({ ...result, split: result.status === 'updated' ? await findSplitForUser(splitId, actorId) : null }));
}

export async function finalizeOwnedSplit(id, ownerId) {
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const split = await tx.split.findFirst({ where: { id, createdBy: ownerId }, include: { relationalParticipants: true } });
    if (!split) return 'not-found';
    if (split.status === 'finalized') return 'already';
    for (const row of split.relationalParticipants) if (row.participantId) await tx.participant.update({ where: { id: row.participantId }, data: { totalOwed: { increment: moneyNumber(row.amountPaisa) } } });
    await tx.split.update({ where: { id }, data: { status: 'finalized', finalizedAt: new Date() } });
    return 'finalized';
  });
  return { status: result, split: result === 'not-found' ? null : await findSplitForUser(id, ownerId) };
}

export async function deleteOwnedSplit(id, ownerId) {
  const prisma = getPrisma();
  const existing = await prisma.split.findFirst({ where: { id, createdBy: ownerId }, select: { id: true } });
  if (!existing) return 'not-found';
  if (await prisma.payment.count({ where: { splitId: id } })) return 'financial-history';
  await prisma.split.delete({ where: { id } });
  return 'deleted';
}
