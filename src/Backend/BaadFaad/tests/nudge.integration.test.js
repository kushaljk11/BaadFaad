import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { getOwnedNudge, listOwnedNudges, reserveNudge, setNudgeDelivery } from '../repositories/nudge.repository.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('nudges are sender-bound, authorized, derived from balances, and throttled', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ownerId = randomUUID();
  const targetId = randomUUID();
  const outsiderId = randomUUID();
  const splitId = randomUUID();
  const targetRowId = randomUUID();
  try {
    await prisma.user.createMany({ data: [
      { id: ownerId, name: 'Owner', email: `owner-${ownerId}@example.test` },
      { id: targetId, name: 'Target', email: `target-${targetId}@example.test` },
      { id: outsiderId, name: 'Outsider', email: `outsider-${outsiderId}@example.test` },
    ] });
    await prisma.split.create({ data: {
      id: splitId, createdBy: ownerId, name: 'Dinner', splitType: 'equal', totalAmount: 100, totalPaisa: 10000n,
      relationalParticipants: { create: [
        { userId: ownerId, displayName: 'Owner', email: `owner-${ownerId}@example.test`, amountPaisa: 5000n, sortOrder: 0 },
        { id: targetRowId, userId: targetId, displayName: 'Target', email: `target-${targetId}@example.test`, amountPaisa: 5000n, sortOrder: 1 },
      ] },
    } });
    assert.equal((await reserveNudge({ senderId: outsiderId, splitParticipantId: targetRowId })).status, 'forbidden');
    const first = await reserveNudge({ senderId: ownerId, splitParticipantId: targetRowId });
    assert.equal(first.status, 'reserved');
    assert.equal(first.nudge.amount, 50);
    assert.equal((await reserveNudge({ senderId: ownerId, splitParticipantId: targetRowId })).status, 'throttled');
    assert.equal(await getOwnedNudge(first.nudge.id, outsiderId), null);
    assert.equal((await listOwnedNudges(ownerId)).length, 1);
    await setNudgeDelivery({ id: first.nudge.id, senderId: ownerId, status: 'failed', errorMessage: 'test' });
    assert.equal((await reserveNudge({ senderId: ownerId, splitParticipantId: targetRowId })).status, 'reserved');
  } finally {
    await prisma.nudge.deleteMany({ where: { senderId: ownerId } });
    await prisma.split.deleteMany({ where: { id: splitId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, targetId, outsiderId] } } });
    await prisma.$disconnect();
  }
});
