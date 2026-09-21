import { getPrisma } from '../config/prisma.js';
import { fromPaisa, toPaisa } from '../utils/money.js';

const moneyNumber = (paisa) => Number(fromPaisa(paisa));
const toDto = (row) =>
  row && {
    ...row,
    _id: row.id,
    amount: row.amountPaisa == null ? row.amount : moneyNumber(row.amountPaisa),
    amountPaisa: row.amountPaisa != null ? row.amountPaisa.toString() : null,
  };

async function splitContext(tx, splitParticipantId, senderId) {
  const target = await tx.splitParticipant.findUnique({
    where: { id: splitParticipantId },
    include: {
      user: true, participant: true,
      split: { include: { relationalParticipants: { include: { paymentAllocations: { where: { payment: { status: 'VERIFIED' } } } } } } },
    },
  });
  if (!target) return { status: 'not-found' };
  const paidByParticipant = new Map(target.split.relationalParticipants.map((row) => [
    row.id, row.paymentAllocations.reduce((sum, allocation) => sum + allocation.amountPaisa, 0n),
  ]));
  const highestPaid = [...paidByParticipant.values()].reduce((max, value) => value > max ? value : max, 0n);
  const senderRow = target.split.relationalParticipants.find((row) => row.userId === senderId);
  const authorized = target.split.createdBy === senderId || (highestPaid > 0n && senderRow && paidByParticipant.get(senderRow.id) === highestPaid);
  if (!authorized) return { status: 'forbidden' };
  const gatewayPaid = paidByParticipant.get(target.id) || 0n;
  const directPaid = target.paidAmountPaisa || 0n;
  const totalPaid = gatewayPaid > directPaid ? gatewayPaid : directPaid;
  const duePaisa = target.amountPaisa > totalPaid ? target.amountPaisa - totalPaid : 0n;
  if (duePaisa === 0n) return { status: 'settled' };
  const group = await tx.group.findFirst({ where: { splitId: target.splitId }, select: { name: true, id: true } });
  const sender = await tx.user.findUnique({ where: { id: senderId }, select: { name: true, email: true } });
  return { status: 'ok', target, sender, group, duePaisa };
}

export async function reserveNudge({ senderId, splitParticipantId, currency = 'NPR', dueDate = 'soon', payLink = '#' }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${senderId}:${splitParticipantId}`})) IS NULL AS "lockAcquired"`;
    const context = await splitContext(tx, splitParticipantId, senderId);
    if (context.status !== 'ok') return context;
    const cooldownMinutes = Math.max(1, Number(process.env.NUDGE_COOLDOWN_MINUTES) || 15);
    const recent = await tx.nudge.findFirst({ where: {
      senderId, splitParticipantId, status: { in: ['pending', 'sent'] },
      createdAt: { gte: new Date(Date.now() - cooldownMinutes * 60000) },
    } });
    if (recent) return { status: 'throttled', retryAfterSeconds: Math.max(1, Math.ceil((recent.createdAt.getTime() + cooldownMinutes * 60000 - Date.now()) / 1000)) };
    const identity = context.target.user || context.target.participant;
    const nudge = await tx.nudge.create({ data: {
      senderId, splitParticipantId, recipientName: context.target.displayName,
      recipientEmail: context.target.email || identity?.email || '', senderName: context.sender?.name || 'Group Host',
      groupName: context.group?.name || context.target.split?.name || 'Split', amount: moneyNumber(context.duePaisa), amountPaisa: context.duePaisa,
      currency: String(currency || 'NPR').slice(0, 3), dueDate: String(dueDate || 'soon').slice(0, 100),
      payLink: String(payLink || '#').slice(0, 2000), status: 'pending',
    } });
    return { status: 'reserved', nudge: toDto(nudge) };
  });
}

export async function setNudgeDelivery({ id, senderId, status, errorMessage = null }) {
  const result = await getPrisma().nudge.updateMany({ where: { id, senderId }, data: { status, errorMessage } });
  return result.count ? getOwnedNudge(id, senderId) : null;
}

export async function getOwnedNudge(id, senderId) {
  return toDto(await getPrisma().nudge.findFirst({ where: { id, senderId } }));
}

export async function listOwnedNudges(senderId, options = {}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const where = { senderId };
  const prisma = getPrisma();
  const [rows, total] = await prisma.$transaction([
    prisma.nudge.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.nudge.count({ where }),
  ]);
  const items = rows.map(toDto);
  return options.withMeta ? { items, total, page, limit } : items;
}

export async function getOwnedSplitSummary(splitId, senderId) {
  const split = await getPrisma().split.findFirst({
    where: { id: splitId, createdBy: senderId },
    include: { relationalParticipants: { include: { user: true, participant: true, paymentAllocations: { where: { payment: { status: 'VERIFIED' } } } }, orderBy: { sortOrder: 'asc' } } },
  });
  if (!split) return null;
  return {
    groupName: split.name || 'Split', totalAmount: moneyNumber(split.totalPaisa ?? toPaisa(split.totalAmount)),
    breakdown: split.relationalParticipants.map((row) => {
      const paid = row.paymentAllocations.reduce((sum, item) => sum + item.amountPaisa, 0n);
      const identity = row.user || row.participant;
      return { name: row.displayName, email: row.email || identity?.email || '', share: moneyNumber(row.amountPaisa), amountPaid: moneyNumber(paid), balanceDue: moneyNumber(row.amountPaisa > paid ? row.amountPaisa - paid : 0n) };
    }),
  };
}
