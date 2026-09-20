/**
 * @fileoverview Pagination metadata integration test
 * @description Verifies that list endpoints (splits, groups, sessions, nudges)
 *              return `pagination` metadata with page, limit, total, and totalPages
 *              fields when `withMeta: true` is supplied. Tests the repositories
 *              directly against PostgreSQL so they do not require HTTP overhead.
 *
 * @module tests/pagination.integration.test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../config/prisma.js';
import { listSplitsForUser } from '../repositories/split.repository.js';
import { listGroupsForUser } from '../repositories/group.repository.js';
import { listSessionsForUser } from '../repositories/session.repository.js';
import { listOwnedNudges } from '../repositories/nudge.repository.js';
import { paginationMeta } from '../utils/pagination.js';

const runDatabaseTests = process.env.RUN_DB_TESTS === '1';

test('list repositories return pagination metadata with correct shape', {
  skip: runDatabaseTests ? false : 'set RUN_DB_TESTS=1 to run PostgreSQL integration tests',
}, async () => {
  const prisma = getPrisma();
  const userId = randomUUID();

  try {
    await prisma.user.create({ data: { id: userId, name: 'Paginator', email: `paginator-${userId}@example.test` } });

    // Splits — user has no splits; expects empty list with correct metadata
    const splitResult = await listSplitsForUser(userId, { page: 1, limit: 10, withMeta: true });
    assert.equal(typeof splitResult.total, 'number');
    assert.equal(typeof splitResult.page, 'number');
    assert.equal(typeof splitResult.limit, 'number');
    assert.ok(Array.isArray(splitResult.items), 'items must be an array');
    assert.equal(splitResult.page, 1);
    assert.equal(splitResult.limit, 10);

    // paginationMeta helper: zero total → totalPages 0
    const zeroMeta = paginationMeta({ page: 1, limit: 20, total: 0 });
    assert.equal(zeroMeta.totalPages, 0);
    assert.equal(zeroMeta.total, 0);

    // paginationMeta helper: positive total → ceil division
    const meta = paginationMeta({ page: 2, limit: 5, total: 12 });
    assert.equal(meta.totalPages, 3);
    assert.equal(meta.total, 12);
    assert.equal(meta.page, 2);
    assert.equal(meta.limit, 5);

    // Groups — user has no groups; expects empty list with correct metadata
    const groupResult = await listGroupsForUser(userId, { page: 1, limit: 20, withMeta: true });
    assert.ok(Array.isArray(groupResult.items));
    assert.equal(groupResult.total, 0);
    assert.equal(groupResult.page, 1);

    // Sessions — user has no sessions; expects empty list with correct metadata
    const sessionResult = await listSessionsForUser(userId, { page: 1, limit: 20, withMeta: true });
    assert.ok(Array.isArray(sessionResult.items));
    assert.equal(sessionResult.total, 0);

    // Nudges — user has no nudges; expects empty list with correct metadata
    const nudgeResult = await listOwnedNudges(userId, { page: 1, limit: 20, withMeta: true });
    assert.ok(Array.isArray(nudgeResult.items));
    assert.equal(nudgeResult.total, 0);

  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
