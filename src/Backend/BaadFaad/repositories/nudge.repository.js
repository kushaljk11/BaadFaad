import { getPrisma } from '../config/prisma.js';
import { fromPaisa, toPaisa } from '../utils/money.js';
import { calculateSettlement, enrichSettlementWithPayments } from '../utils/settlementEngine.js';
import { toSplitDto } from './split.repository.js';

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
      user: true,
      participant: true,
      split: {
        include: {
          relationalParticipants: {
            include: {
              user: true,
              participant: true,
              paymentAllocations: { where: { payment: { status: 'VERIFIED' } } },
            },
          },
          settlementPayments: true,
        },
      },
    },
  });
  if (!target) return { status: 'not-found' };

  // Calculate baseline directed obligations from merchant contributions and expense shares
  const totalPaisa = target.split.totalPaisa ?? toPaisa(target.split.totalAmount);
  const anyContributions = target.split.relationalParticipants.some((r) => r.paidAmountPaisa > 0n);
  const settlementInputs = target.split.relationalParticipants.map((row) => {
    let contributionPaisa = row.paidAmountPaisa || 0n;
    if (!anyContributions && totalPaisa > 0n) {
      if (row.userId === target.split.createdBy || (!row.userId && row.sortOrder === 0)) {
        contributionPaisa = totalPaisa;
      }
    }
    return {
      id: row.id,
      name: row.displayName || (row.user || row.participant)?.name || 'Participant',
      shareAmountPaisa: row.amountPaisa,
      paidAmountPaisa: contributionPaisa,
    };
  });

  const settlementResult = calculateSettlement(settlementInputs);
  const enriched = enrichSettlementWithPayments(settlementResult.transfers, target.split.settlementPayments || []);

  // Filter transfers where target is the debtor and has unpaid balance
  const targetDebts = enriched.transfers.filter(
    (t) => String(t.fromParticipantId) === String(target.id) && t.remainingAmountPaisa > 0n
  );

  const duePaisa = targetDebts.reduce((sum, t) => sum + BigInt(t.remainingAmountPaisa), 0n);
  if (duePaisa <= 0n) return { status: 'settled' };

  // Permission check: sender must be the split host OR a creditor of target's remaining debt
  const isHost = target.split.createdBy === senderId;
  const isCreditor = targetDebts.some((t) => {
    const creditorRow = target.split.relationalParticipants.find(
      (p) => String(p.id) === String(t.toParticipantId)
    );
    return creditorRow?.userId === senderId;
  });

  if (!isHost && !isCreditor) return { status: 'forbidden' };

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
    include: {
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
      },
      settlementPayments: {
        include: {
          fromParticipant: true,
          toParticipant: true,
          recordedByUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!split) return null;
  const dto = toSplitDto(split);
  return {
    groupName: split.name || 'Split',
    totalAmount: dto.totalAmount,
    breakdown: dto.breakdown.map((row) => ({
      name: row.name,
      email: row.email,
      share: row.shareAmount,
      amountPaid: row.paidAmount,
      balanceDue: row.reimbursementRemaining,
    })),
  };
}
