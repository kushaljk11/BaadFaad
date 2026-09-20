import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import {
  addGroupMember,
  createGroupRecord,
  findGroupForUser,
  listGroupsForUser,
  removeGroupMember,
} from '../repositories/group.repository.js';
import { createInvitationToken } from '../utils/invitation.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('group repository enforces membership and keeps normalized membership in sync', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const ownerId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();
  let groupId;
  let secondGroupId;
  try {
    await prisma.user.createMany({ data: [
      { id: ownerId, name: 'Owner', email: `owner-${ownerId}@example.test` },
      { id: memberId, name: 'Member', email: `member-${memberId}@example.test` },
      { id: outsiderId, name: 'Outsider', email: `outsider-${outsiderId}@example.test` },
    ] });
    const invitation = createInvitationToken();
    const group = await createGroupRecord({
      name: 'Repository Test', description: '', createdBy: ownerId, memberIds: [],
      defaultCurrency: 'NPR', image: '', splitId: null, sessionId: null, qrCode: '',
      invitation: { tokenHash: invitation.tokenHash, expiresAt: new Date(Date.now() + 3600000) },
    });
    groupId = group.id;
    assert.equal(group.members.length, 1);
    assert.equal(await findGroupForUser({ id: groupId, userId: outsiderId }), null);

    const secondGroup = await createGroupRecord({
      name: 'Repository Test 2', description: '', createdBy: ownerId, memberIds: [],
      defaultCurrency: 'NPR', image: '', splitId: null, sessionId: null, qrCode: '',
    });
    secondGroupId = secondGroup.id;
    const firstPage = await listGroupsForUser(ownerId, { page: 1, limit: 1, withMeta: true });
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.total, 2);
    assert.equal(firstPage.page, 1);
    assert.equal(firstPage.limit, 1);

    assert.equal((await addGroupMember({ groupId, actorId: memberId, userId: memberId, inviteToken: 'invalid', requireInvitation: true })).status, 'invalid-invitation');
    assert.equal((await addGroupMember({ groupId, actorId: memberId, userId: memberId, inviteToken: invitation.token, requireInvitation: true })).status, 'added');
    assert.equal((await findGroupForUser({ id: groupId, userId: memberId })).id, groupId);
    assert.equal(await prisma.groupMember.count({ where: { groupId, removedAt: null } }), 2);

    assert.equal((await removeGroupMember({ groupId, ownerId, userId: memberId })).status, 'removed');
    assert.equal(await findGroupForUser({ id: groupId, userId: memberId }), null);
  } finally {
    if (groupId) await prisma.group.deleteMany({ where: { id: groupId } });
    if (secondGroupId) await prisma.group.deleteMany({ where: { id: secondGroupId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, outsiderId] } } });
    await prisma.$disconnect();
  }
});
