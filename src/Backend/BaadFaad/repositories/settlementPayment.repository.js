import { getPrisma } from '../config/prisma.js';
import { fromPaisa, toPaisa } from '../utils/money.js';
import { calculateSettlement } from '../utils/settlementEngine.js';
import { toSplitDto } from './split.repository.js';

const moneyNumber = (paisa) => Number(fromPaisa(paisa));

export async function recordSettlementPayment({
  splitId,
  actorId,
  fromParticipantId,
  toParticipantId,
  amount,
  amountPaisa: explicitPaisa,
  method = 'CASH',
  note = '',
}) {
  const prisma = getPrisma();
  const paymentAmountPaisa = explicitPaisa !== undefined ? BigInt(explicitPaisa) : toPaisa(amount);

  if (paymentAmountPaisa <= 0n) {
    return { status: 'invalid-amount', message: 'Payment amount must be greater than zero' };
  }

  return prisma.$transaction(async (tx) => {
    // Acquire advisory transaction lock for this split to prevent race condition overpayments
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`settlement:${splitId}:${fromParticipantId}:${toParticipantId}`})) IS NULL AS "lockAcquired"`;

    const split = await tx.split.findUnique({
      where: { id: splitId },
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
          orderBy: { createdAt: 'asc' },
        },
        settlementPayments: {
          include: {
            fromParticipant: true,
            toParticipant: true,
            recordedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!split) return { status: 'not-found', message: 'Split not found' };

    const fromParticipant = split.relationalParticipants.find(
      (p) => String(p.id) === String(fromParticipantId)
    );
    const toParticipant = split.relationalParticipants.find(
      (p) => String(p.id) === String(toParticipantId)
    );

    if (!fromParticipant || !toParticipant) {
      return { status: 'participant-not-found', message: 'Participant not found in this split' };
    }

    if (String(fromParticipant.id) === String(toParticipant.id)) {
      return { status: 'self-payment', message: 'Cannot record payment to self' };
    }

    // Permission check: actor must be the split creator OR the creditor
    const isCreator = split.createdBy === actorId;
    const isCreditor = toParticipant.userId === actorId;
    if (!isCreator && !isCreditor) {
      return {
        status: 'forbidden',
        message: 'Only the split host or the creditor can record this payment',
      };
    }

    // Calculate baseline directed obligations from merchant contributions and expense shares
    const totalPaisa = split.totalPaisa ?? toPaisa(split.totalAmount);
    const anyContributions = split.relationalParticipants.some((r) => r.paidAmountPaisa > 0n);
    const settlementInputs = split.relationalParticipants.map((row) => {
      let contributionPaisa = row.paidAmountPaisa || 0n;
      if (!anyContributions && totalPaisa > 0n) {
        if (row.userId === split.createdBy || (!row.userId && row.sortOrder === 0)) {
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

    const baselineSettlement = calculateSettlement(settlementInputs);
    const transferObligation = baselineSettlement.transfers.find(
      (t) =>
        String(t.fromParticipantId) === String(fromParticipant.id) &&
        String(t.toParticipantId) === String(toParticipant.id)
    );

    if (!transferObligation) {
      return {
        status: 'no-debt',
        message: `${fromParticipant.displayName} has no outstanding debt obligation to ${toParticipant.displayName}`,
      };
    }

    // Sum previous payments on this directed obligation
    const priorPayments = (split.settlementPayments || []).filter(
      (p) =>
        String(p.fromParticipantId) === String(fromParticipant.id) &&
        String(p.toParticipantId) === String(toParticipant.id)
    );
    const alreadyPaidPaisa = priorPayments.reduce((sum, p) => sum + BigInt(p.amountPaisa), 0n);
    const duePaisa = BigInt(transferObligation.amountPaisa);
    const remainingPaisa = duePaisa > alreadyPaidPaisa ? duePaisa - alreadyPaidPaisa : 0n;

    if (remainingPaisa === 0n) {
      return {
        status: 'already-settled',
        message: `This debt obligation has already been fully paid`,
      };
    }

    // Prevent overpayment
    if (paymentAmountPaisa > remainingPaisa) {
      return {
        status: 'exceeds-remaining',
        message: `Payment amount (${moneyNumber(paymentAmountPaisa)} Rs) exceeds remaining balance (${moneyNumber(remainingPaisa)} Rs)`,
        remaining: moneyNumber(remainingPaisa),
      };
    }

    // Record the payment
    const payment = await tx.settlementPayment.create({
      data: {
        splitId,
        fromParticipantId: fromParticipant.id,
        toParticipantId: toParticipant.id,
        amountPaisa: paymentAmountPaisa,
        method: String(method || 'CASH').toUpperCase(),
        note: String(note || '').slice(0, 500),
        recordedByUserId: actorId,
      },
      include: {
        fromParticipant: true,
        toParticipant: true,
        recordedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Update debtor SplitParticipant status
    const allDebtorTransfers = baselineSettlement.transfers.filter(
      (t) => String(t.fromParticipantId) === String(fromParticipant.id)
    );
    const allDebtorPayments = [
      ...(split.settlementPayments || []).filter(
        (p) => String(p.fromParticipantId) === String(fromParticipant.id)
      ),
      payment,
    ];

    const totalDebtorDuePaisa = allDebtorTransfers.reduce(
      (sum, t) => sum + BigInt(t.amountPaisa),
      0n
    );
    const totalDebtorPaidPaisa = allDebtorPayments.reduce(
      (sum, p) => sum + BigInt(p.amountPaisa),
      0n
    );

    const nextDebtorStatus =
      totalDebtorPaidPaisa >= totalDebtorDuePaisa
        ? 'PAID'
        : totalDebtorPaidPaisa > 0n
        ? 'PARTIAL'
        : 'UNPAID';

    await tx.splitParticipant.update({
      where: { id: fromParticipant.id },
      data: { status: nextDebtorStatus },
    });

    // Fetch refreshed split
    const refreshed = await tx.split.findUnique({
      where: { id: splitId },
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
          orderBy: { createdAt: 'asc' },
        },
        settlementPayments: {
          include: {
            fromParticipant: true,
            toParticipant: true,
            recordedByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const splitDto = toSplitDto(refreshed);

    return {
      status: 'success',
      payment: {
        id: payment.id,
        fromParticipantId: payment.fromParticipantId,
        fromName: payment.fromParticipant?.displayName,
        toParticipantId: payment.toParticipantId,
        toName: payment.toParticipant?.displayName,
        amount: moneyNumber(payment.amountPaisa),
        amountPaisa: payment.amountPaisa.toString(),
        method: payment.method,
        note: payment.note,
        recordedByName: payment.recordedByUser?.name || 'Host',
        createdAt: payment.createdAt,
      },
      split: splitDto,
    };
  }, { maxWait: 15000, timeout: 30000 });
}

export async function listSettlementPayments(splitId) {
  const prisma = getPrisma();
  const rows = await prisma.settlementPayment.findMany({
    where: { splitId },
    include: {
      fromParticipant: true,
      toParticipant: true,
      recordedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((p) => ({
    id: p.id,
    fromParticipantId: p.fromParticipantId,
    fromName: p.fromParticipant?.displayName || 'Debtor',
    toParticipantId: p.toParticipantId,
    toName: p.toParticipant?.displayName || 'Creditor',
    amount: moneyNumber(p.amountPaisa),
    amountPaisa: p.amountPaisa.toString(),
    method: p.method,
    note: p.note,
    recordedByName: p.recordedByUser?.name || 'Host',
    createdAt: p.createdAt,
  }));
}
