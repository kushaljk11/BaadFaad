import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import {
  createUser,
  findOrCreateOAuthUser,
  findUserByEmail,
  findUserById,
} from '../repositories/user.repository.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('user repository creates, finds, and idempotently resolves OAuth users', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const marker = randomUUID();
  const guestEmail = `USER-REPO-${marker}@EXAMPLE.TEST`;
  const oauthEmail = `oauth-${marker}@example.test`;
  const createdIds = [];

  try {
    const guest = await createUser({ name: 'Guest', email: guestEmail });
    createdIds.push(guest.id);
    assert.equal(guest.email, guestEmail.toLowerCase());
    assert.equal((await findUserByEmail(guestEmail)).id, guest.id);
    assert.equal((await findUserById(guest.id)).email, guestEmail.toLowerCase());

    const firstOAuth = await findOrCreateOAuthUser({ name: 'OAuth User', email: oauthEmail });
    createdIds.push(firstOAuth.id);
    const secondOAuth = await findOrCreateOAuthUser({ name: 'Changed Name', email: oauthEmail });
    assert.equal(secondOAuth.id, firstOAuth.id);
    assert.equal(await prisma.user.count({ where: { email: oauthEmail } }), 1);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  }
});
