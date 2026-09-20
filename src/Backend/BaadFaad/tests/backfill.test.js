import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicUuid, referenceId } from '../scripts/backfill-normalized-data.js';

test('backfill identifiers are deterministic valid UUIDs', () => {
  const first = deterministicUuid('receipt:item:1');
  assert.equal(first, deterministicUuid('receipt:item:1'));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('referenceId accepts UUID strings and populated records only', () => {
  const id = '34bc44f0-12b6-4e5a-a927-cd6875e12b20';
  assert.equal(referenceId(id), id);
  assert.equal(referenceId({ _id: id }), id);
  assert.equal(referenceId('legacy-object-id'), null);
});
