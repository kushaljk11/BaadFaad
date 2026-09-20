import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateByBasisPoints,
  allocateEvenly,
  assertReconciled,
  fromPaisa,
  toPaisa,
} from '../utils/money.js';

test('converts NPR values to and from integer paisa', () => {
  assert.equal(toPaisa('1250.50'), 125050n);
  assert.equal(fromPaisa(125050n), '1250.50');
  assert.equal(fromPaisa(-5n), '-0.05');
});

test('rejects invalid or unsafe money values', () => {
  assert.throws(() => toPaisa('not-money'), TypeError);
  assert.throws(() => toPaisa(Number.MAX_VALUE), RangeError);
});

test('equal allocation deterministically assigns the rounding remainder', () => {
  const allocations = allocateEvenly(10_000n, ['host', 'friend-1', 'friend-2']);
  assert.deepEqual(allocations, [
    { key: 'host', amountPaisa: 3334n },
    { key: 'friend-1', amountPaisa: 3333n },
    { key: 'friend-2', amountPaisa: 3333n },
  ]);
  assert.equal(assertReconciled(10_000n, allocations), true);
});

test('percentage allocation uses basis points and reconciles fractional paisa', () => {
  const allocations = allocateByBasisPoints(101n, [
    { key: 'a', basisPoints: 3334 },
    { key: 'b', basisPoints: 3333 },
    { key: 'c', basisPoints: 3333 },
  ]);
  assert.deepEqual(allocations, [
    { key: 'a', amountPaisa: 34n },
    { key: 'b', amountPaisa: 34n },
    { key: 'c', amountPaisa: 33n },
  ]);
  assert.equal(assertReconciled(101n, allocations), true);
});

test('percentage allocation rejects totals other than exactly 100 percent', () => {
  assert.throws(() => allocateByBasisPoints(100n, [
    { key: 'a', basisPoints: 5000 },
    { key: 'b', basisPoints: 4999 },
  ]), /10000 basis points/);
});
