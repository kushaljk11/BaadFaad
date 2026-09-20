import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSplitRows } from '../utils/splitEngine.js';

test('split engine reconciles equal allocation', () => {
  assert.deepEqual(calculateSplitRows('equal', 10000n, [{}, {}, {}]).map((row) => row.amountPaisa), [3334n, 3333n, 3333n]);
});

test('split engine calculates percentage allocation in basis points', () => {
  assert.deepEqual(calculateSplitRows('percentage', 101n, [{ percentage: 33.34 }, { percentage: 33.33 }, { percentage: 33.33 }]).map((row) => row.amountPaisa), [34n, 34n, 33n]);
});

test('split engine requires custom allocations to reconcile', () => {
  assert.deepEqual(calculateSplitRows('custom', 10000n, [{ amount: 40 }, { amount: 60 }]).map((row) => row.amountPaisa), [4000n, 6000n]);
  assert.throws(() => calculateSplitRows('custom', 10000n, [{ amount: 99 }]), /do not reconcile/);
});

test('split engine calculates item-based totals and rejects missing value', () => {
  const rows = calculateSplitRows('item_based', 30000n, [
    { items: [{ itemPrice: 100, quantity: 2 }] },
    { items: [{ amount: 100 }] },
  ]);
  assert.deepEqual(rows.map((row) => row.amountPaisa), [20000n, 10000n]);
  assert.throws(() => calculateSplitRows('item_based', 100n, [{ items: [{}] }]), TypeError);
});
