import { getPrisma } from '../config/prisma.js';
import { fromPaisa, toPaisa } from '../utils/money.js';

const amountNumber = (paisa) => Number(fromPaisa(paisa));

export async function reserveGatewayTransaction({ userId, splitId, productId, productName, gateway, amount, idempotencyKey }) {
  const prisma = getPrisma();
  const amountPaisa = toPaisa(amount);
  if (amountPaisa <= 0n) throw new TypeError('Amount must be greater than 0');
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
      if (!user) return { status: 'user-not-found' };
      let participant = null;
      if (splitId) {
        participant = await tx.splitParticipant.findFirst({
          where: { splitId, userId },
          include: { paymentAllocations: { where: { payment: { status: 'VERIFIED' } } } },
        });
        if (!participant) return { status: 'split-forbidden' };
        const paid = participant.paymentAllocations.reduce((sum, row) => sum + row.amountPaisa, 0n);
        if (amountPaisa > participant.amountPaisa - paid) return { status: 'amount-exceeds-due' };
      }
      const transaction = await tx.transaction.create({ data: {
        userId, splitId: splitId || null, customerDetails: { name: user.name, email: user.email },
        product_name: String(productName || 'Split Settlement').slice(0, 200), product_id: productId,
        amount: amountNumber(amountPaisa), amountPaisa, payment_gateway: gateway,
        idempotencyKey, status: 'PENDING', currency: 'NPR',
      } });
      return { status: 'reserved', transaction, user };
    });
  } catch (error) {
    if (error?.code === 'P2002') return { status: 'duplicate' };
    throw error;
  }
}

export async function releasePendingTransaction({ productId, userId, reason }) {
  return getPrisma().transaction.deleteMany({ where: { product_id: productId, userId, status: 'PENDING', failureReason: null } });
}

export async function findOwnedTransaction(productId, userId) {
  return getPrisma().transaction.findFirst({ where: { product_id: productId, userId } });
}

export async function completeGatewayTransaction({ productId, userId, paidAmountPaisa, providerTransactionId, providerResponse }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({ where: { product_id: productId, userId } });
    if (!transaction) return { status: 'not-found' };
    if (transaction.status === 'COMPLETED') return { status: 'already', transaction };
    const requested = transaction.amountPaisa ?? toPaisa(transaction.amount);
    if (paidAmountPaisa !== requested) return { status: 'amount-mismatch', transaction };
    const claimed = await tx.transaction.updateMany({
      where: { id: transaction.id, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', paidAmountPaisa, providerTransactionId: providerTransactionId || null, providerResponse, completedAt: new Date(), failureReason: null },
    });
    if (!claimed.count) return { status: 'already', transaction };
    if (transaction.splitId) {
      const participant = await tx.splitParticipant.findFirst({ where: { splitId: transaction.splitId, userId } });
      if (!participant) throw new Error('Transaction split participant no longer exists');
      await tx.payment.create({ data: {
        splitId: transaction.splitId, paidByUserId: userId, amountPaisa: paidAmountPaisa,
        method: transaction.payment_gateway, status: 'VERIFIED', note: `gateway:${transaction.id}`, verifiedAt: new Date(),
        allocations: { create: { splitParticipantId: participant.id, amountPaisa: paidAmountPaisa } },
      } });
      const aggregate = await tx.paymentAllocation.aggregate({
        where: { splitParticipantId: participant.id, payment: { status: 'VERIFIED' } }, _sum: { amountPaisa: true },
      });
      const paid = aggregate._sum.amountPaisa ?? 0n;
      await tx.splitParticipant.update({ where: { id: participant.id }, data: { status: paid >= participant.amountPaisa ? 'PAID' : paid > 0n ? 'PARTIAL' : 'UNPAID' } });
    }
    return { status: 'completed', transaction: await tx.transaction.findUnique({ where: { id: transaction.id } }) };
  });
}

export async function failGatewayTransaction({ productId, userId, reason, providerResponse }) {
  const prisma = getPrisma();
  const existing = await prisma.transaction.findFirst({ where: { product_id: productId, userId } });
  if (!existing) return 'not-found';
  if (existing.status === 'COMPLETED') return 'completed';
  await prisma.transaction.update({ where: { id: existing.id }, data: { status: 'FAILED', failureReason: String(reason || 'Provider did not confirm payment').slice(0, 500), providerResponse } });
  return 'failed';
}
