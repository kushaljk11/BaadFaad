import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import {
  createSplitRecord,
  deleteOwnedSplit,
  findSplitForUser,
  updateSplitParticipantStatus,
} from '../repositories/split.repository.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('split repository reconciles paisa and enforces participant ownership', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  let splitId;
  try {
    await prisma.user.createMany({ data: ids.map((id, index) => ({ id, name: `User ${index}`, email: `split-${id}@example.test` })) });
    const result = await createSplitRecord({
      createdBy: ids[0], splitType: 'equal', participants: ids.slice(0, 3).map((_id) => ({ _id })), totalAmount: 100, name: 'Test split',
    });
    splitId = result.split.id;
    assert.deepEqual(result.split.breakdown.map((row) => row.amount), [33.34, 33.33, 33.33]);
    assert.equal(result.split.breakdown.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 10000);
    assert.equal(await findSplitForUser(splitId, ids[3]), null);
    assert.equal((await findSplitForUser(splitId, ids[1])).id, splitId);

    const paymentUpdate = await updateSplitParticipantStatus({ splitId, index: 1, actorId: ids[0], amountPaid: 10 });
    assert.equal(paymentUpdate.status, 'updated');
    assert.equal(paymentUpdate.split.breakdown[1].amountPaid, 10);
    assert.equal(await prisma.paymentAllocation.count({ where: { splitParticipant: { splitId } } }), 1);
    assert.equal((await updateSplitParticipantStatus({ splitId, index: 0, actorId: ids[3], amountPaid: 10 })).status, 'forbidden');
    assert.equal(await deleteOwnedSplit(splitId, ids[3]), 'not-found');
    assert.equal(await deleteOwnedSplit(splitId, ids[0]), 'financial-history');
    await prisma.payment.deleteMany({ where: { splitId } });
    assert.equal(await deleteOwnedSplit(splitId, ids[0]), 'deleted');
    splitId = null;
  } finally {
    if (splitId) await prisma.split.deleteMany({ where: { id: splitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});

test('split repository persists percentage, custom, and item assignments', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const splitIds = [];
  let receiptId;
  try {
    await prisma.user.createMany({ data: [
      { id: ownerId, name: 'Owner', email: `modes-${ownerId}@example.test` },
      { id: memberId, name: 'Member', email: `modes-${memberId}@example.test` },
    ] });
    const percentage = await createSplitRecord({ createdBy: ownerId, splitType: 'percentage', totalAmount: 101, breakdown: [
      { user: ownerId, percentage: 60 }, { user: memberId, percentage: 40 },
    ] });
    splitIds.push(percentage.split.id);
    assert.deepEqual(percentage.split.breakdown.map((row) => row.amount), [60.6, 40.4]);

    const custom = await createSplitRecord({ createdBy: ownerId, splitType: 'custom', totalAmount: 101, breakdown: [
      { user: ownerId, amount: 50.5 }, { user: memberId, amount: 50.5 },
    ] });
    splitIds.push(custom.split.id);
    assert.deepEqual(custom.split.breakdown.map((row) => row.amount), [50.5, 50.5]);

    const receipt = await prisma.receipt.create({ data: {
      createdBy: ownerId, totalAmount: 300, totalPaisa: 30000n,
      relationalItems: { create: [
        { name: 'Momo', quantity: 1, unitPricePaisa: 20000n, totalPricePaisa: 20000n, sortOrder: 0 },
        { name: 'Tea', quantity: 1, unitPricePaisa: 10000n, totalPricePaisa: 10000n, sortOrder: 1 },
      ] },
    }, include: { relationalItems: true } });
    receiptId = receipt.id;
    const itemSplit = await createSplitRecord({ createdBy: ownerId, receiptId, splitType: 'item_based', breakdown: [
      { user: ownerId, items: [{ receiptItemId: receipt.relationalItems[0].id, itemPrice: 200 }] },
      { user: memberId, items: [{ receiptItemId: receipt.relationalItems[1].id, itemPrice: 100 }] },
    ] });
    splitIds.push(itemSplit.split.id);
    assert.deepEqual(itemSplit.split.breakdown.map((row) => row.amount), [200, 100]);
    assert.equal(await prisma.splitItemAssignment.count({ where: { splitParticipant: { splitId: itemSplit.split.id } } }), 2);
  } finally {
    await prisma.split.deleteMany({ where: { id: { in: splitIds } } });
    if (receiptId) await prisma.receipt.deleteMany({ where: { id: receiptId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
    await prisma.$disconnect();
  }
});
