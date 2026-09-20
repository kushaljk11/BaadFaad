import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { completeGatewayTransaction, reserveGatewayTransaction } from '../repositories/payment.repository.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('gateway transaction is user-bound, idempotent, amount-checked, and allocated', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const userId = randomUUID();
  const otherId = randomUUID();
  const splitId = randomUUID();
  const splitParticipantId = randomUUID();
  const productId = `test-${randomUUID()}`;
  try {
    await prisma.user.createMany({ data: [
      { id: userId, name: 'Payer', email: `payer-${userId}@example.test` },
      { id: otherId, name: 'Other', email: `other-${otherId}@example.test` },
    ] });
    await prisma.split.create({ data: {
      id: splitId, createdBy: userId, splitType: 'equal', totalAmount: 50, totalPaisa: 5000n,
      relationalParticipants: { create: { id: splitParticipantId, userId, displayName: 'Payer', email: `payer-${userId}@example.test`, amountPaisa: 5000n } },
    } });
    const reservation = await reserveGatewayTransaction({ userId, splitId, productId, productName: 'Test', gateway: 'khalti', amount: 50, idempotencyKey: productId });
    assert.equal(reservation.status, 'reserved');
    assert.equal((await reserveGatewayTransaction({ userId, splitId, productId, productName: 'Test', gateway: 'khalti', amount: 50, idempotencyKey: productId })).status, 'duplicate');
    assert.equal((await completeGatewayTransaction({ productId, userId: otherId, paidAmountPaisa: 5000n, providerTransactionId: 'wrong-user', providerResponse: {} })).status, 'not-found');
    assert.equal((await completeGatewayTransaction({ productId, userId, paidAmountPaisa: 4900n, providerTransactionId: 'wrong-amount', providerResponse: {} })).status, 'amount-mismatch');
    assert.equal((await completeGatewayTransaction({ productId, userId, paidAmountPaisa: 5000n, providerTransactionId: `provider-${productId}`, providerResponse: {} })).status, 'completed');
    assert.equal((await completeGatewayTransaction({ productId, userId, paidAmountPaisa: 5000n, providerTransactionId: `provider-${productId}`, providerResponse: {} })).status, 'already');
    assert.equal(await prisma.payment.count({ where: { splitId } }), 1);
    assert.equal((await prisma.splitParticipant.findUnique({ where: { id: splitParticipantId } })).status, 'PAID');
  } finally {
    await prisma.transaction.deleteMany({ where: { product_id: productId } });
    await prisma.payment.deleteMany({ where: { splitId } });
    await prisma.split.deleteMany({ where: { id: splitId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await prisma.$disconnect();
  }
});
