import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import {
  createReceiptWithItems,
  findOwnedReceiptById,
} from '../repositories/receipt.repository.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('receipt repository persists normalized items and enforces ownership', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  let receiptId;

  try {
    await prisma.user.createMany({
      data: [
        { id: ownerId, name: 'Receipt Test Owner', email: `receipt-owner-${ownerId}@example.test` },
        { id: otherUserId, name: 'Receipt Test Other', email: `receipt-other-${otherUserId}@example.test` },
      ],
    });

    const created = await createReceiptWithItems({
      createdBy: ownerId,
      restaurant: 'Integration Test Cafe',
      address: 'Kathmandu',
      items: [
        { name: 'Tea', price: 40.5, quantity: 2 },
        { name: 'Momo', price: 180, quantity: 1 },
      ],
      totalAmount: 261,
    });
    receiptId = created.id;

    assert.equal(created.totalAmount, 261);
    assert.deepEqual(created.items, [
      { name: 'Tea', price: 40.5, quantity: 2 },
      { name: 'Momo', price: 180, quantity: 1 },
    ]);
    assert.equal(await prisma.receiptItem.count({ where: { receiptId } }), 2);

    const owned = await findOwnedReceiptById({ id: receiptId, createdBy: ownerId });
    const denied = await findOwnedReceiptById({ id: receiptId, createdBy: otherUserId });
    assert.equal(owned.id, receiptId);
    assert.equal(denied, null);
  } finally {
    if (receiptId) await prisma.receipt.deleteMany({ where: { id: receiptId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
    await prisma.$disconnect();
  }
});
