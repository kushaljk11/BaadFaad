import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import {
  canAccessRealtimeRoom,
  createSessionForSplit,
  findSessionForUser,
  joinSessionAsUser,
} from '../repositories/session.repository.js';
import { createInvitationToken } from '../utils/invitation.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('session repository enforces split ownership, membership, host access, and unique joining', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  const splitId = randomUUID();
  const sessionId = randomUUID();
  try {
    await prisma.user.createMany({ data: [
      { id: ownerId, name: 'Host', email: `host-${ownerId}@example.test` },
      { id: memberId, name: 'Member', email: `member-${memberId}@example.test` },
      { id: outsiderId, name: 'Outsider', email: `outsider-${outsiderId}@example.test` },
    ] });
    await prisma.split.create({ data: {
      id: splitId, createdBy: ownerId, splitType: 'equal', status: 'pending', totalAmount: 100,
    } });
    const denied = await createSessionForSplit({ id: randomUUID(), name: 'Denied', splitId, ownerId: outsiderId, qrCode: '', endDate: new Date(Date.now() + 3600000) });
    assert.equal(denied.status, 'forbidden');
    const invitation = createInvitationToken();
    const created = await createSessionForSplit({ id: sessionId, name: 'Dinner', splitId, ownerId, qrCode: '', endDate: new Date(Date.now() + 3600000), invitation: { tokenHash: invitation.tokenHash } });
    assert.equal(created.status, 'created');
    assert.equal(await canAccessRealtimeRoom(sessionId, ownerId, true), true);
    assert.equal(await findSessionForUser({ id: sessionId, userId: outsiderId }), null);

    assert.equal((await joinSessionAsUser({ sessionId, userId: memberId, inviteToken: 'invalid', requireInvitation: true })).status, 'invalid-invitation');
    assert.equal((await joinSessionAsUser({ sessionId, userId: memberId, inviteToken: invitation.token, requireInvitation: true })).status, 'joined');
    assert.equal((await joinSessionAsUser({ sessionId, userId: memberId, inviteToken: invitation.token, requireInvitation: true })).status, 'exists');
    assert.equal(await prisma.sessionParticipant.count({ where: { sessionId, userId: memberId } }), 1);
    assert.equal(await canAccessRealtimeRoom(sessionId, memberId), true);
    assert.equal(await canAccessRealtimeRoom(sessionId, memberId, true), false);
    await prisma.invitation.updateMany({ where: { sessionId }, data: { revokedAt: new Date() } });
    assert.equal((await joinSessionAsUser({ sessionId, userId: outsiderId, inviteToken: invitation.token, requireInvitation: true })).status, 'invalid-invitation');
  } finally {
    await prisma.groupMember.deleteMany({ where: { userId: { in: [ownerId, memberId, outsiderId] } } }).catch(() => {});
    await prisma.group.deleteMany({ where: { splitId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {});
    await prisma.split.deleteMany({ where: { id: splitId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, outsiderId] } } }).catch(() => {});
    await prisma.$disconnect();
  }
});
