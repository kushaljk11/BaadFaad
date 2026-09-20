import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPaisa,
  fromPaisa,
  allocateEvenly,
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateCustomSplit,
  calculateItemSplit,
  assertReconciled,
} from '../src/utills/calculationEngine.js';

test('toPaisa and fromPaisa conversion', () => {
  assert.equal(toPaisa(100), 10000n);
  assert.equal(toPaisa('100.50'), 10050n);
  assert.equal(toPaisa('0.33'), 33n);
  assert.equal(toPaisa(0), 0n);
  assert.equal(fromPaisa(10050n), 100.5);
  assert.equal(fromPaisa(33n), 0.33);
});

test('allocateEvenly remainder allocation in integer paisa', () => {
  const splits = allocateEvenly(10000n, 3);
  assert.deepEqual(splits, [3334n, 3333n, 3333n]);
  assert.equal(splits.reduce((acc, v) => acc + v, 0n), 10000n);
});

test('Equal split with 1 participant', () => {
  const result = calculateEqualSplit(100, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 100);
  assert.equal(assertReconciled(100, result), true);
});

test('Equal split with 2 participants', () => {
  const result = calculateEqualSplit(100, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].amount, 50);
  assert.equal(result[1].amount, 50);
  assert.equal(assertReconciled(100, result), true);
});

test('Equal split with 3 participants allocates remainder predictably', () => {
  // 100.00 / 3 => 33.34, 33.33, 33.33 => Exactly 100.00
  const result = calculateEqualSplit(100, 3);
  assert.equal(result.length, 3);
  assert.equal(result[0].amount, 33.34);
  assert.equal(result[1].amount, 33.33);
  assert.equal(result[2].amount, 33.33);
  assert.equal(assertReconciled(100, result), true);
});

test('Equal split with large amounts and paisa precision', () => {
  const result = calculateEqualSplit(100000.05, 4);
  assert.equal(result.length, 4);
  assert.equal(assertReconciled(100000.05, result), true);
});

test('Percentage split exactly 100%', () => {
  const entries = [
    { participant: { name: 'Ram' }, percentage: 40 },
    { participant: { name: 'Sita' }, percentage: 35 },
    { participant: { name: 'Hari' }, percentage: 25 },
  ];
  const result = calculatePercentageSplit(1000, entries);
  assert.equal(result.isValid, true);
  assert.equal(result.totalPercentage, 100);
  assert.equal(result.rows[0].amount, 400);
  assert.equal(result.rows[1].amount, 350);
  assert.equal(result.rows[2].amount, 250);
  assert.equal(assertReconciled(1000, result.rows), true);
});

test('Percentage split with fractional percentages allocates remainder', () => {
  const entries = [
    { participant: { name: 'Ram' }, percentage: 33.34 },
    { participant: { name: 'Sita' }, percentage: 33.33 },
    { participant: { name: 'Hari' }, percentage: 33.33 },
  ];
  const result = calculatePercentageSplit(100, entries);
  assert.equal(result.isValid, true);
  assert.equal(assertReconciled(100, result.rows), true);
});

test('Percentage split below 100% shows remaining feedback', () => {
  const entries = [
    { participant: { name: 'Ram' }, percentage: 40 },
    { participant: { name: 'Sita' }, percentage: 55 },
  ];
  const result = calculatePercentageSplit(1000, entries);
  assert.equal(result.isValid, false);
  assert.equal(result.totalPercentage, 95);
  assert.equal(result.remainingPercentage, 5);
  assert.match(result.errorMessage, /5% remaining/);
});

test('Percentage split above 100% shows over feedback', () => {
  const entries = [
    { participant: { name: 'Ram' }, percentage: 50 },
    { participant: { name: 'Sita' }, percentage: 55 },
  ];
  const result = calculatePercentageSplit(1000, entries);
  assert.equal(result.isValid, false);
  assert.equal(result.totalPercentage, 105);
  assert.match(result.errorMessage, /5% over/);
});

test('Custom split exact total', () => {
  const entries = [
    { participant: { name: 'Ram' }, amount: 450 },
    { participant: { name: 'Sita' }, amount: 550 },
  ];
  const result = calculateCustomSplit(1000, entries);
  assert.equal(result.isExact, true);
  assert.equal(result.remainingAmount, 0);
  assert.equal(result.totalAllocated, 1000);
  assert.equal(assertReconciled(1000, result.rows), true);
});

test('Custom split below and above total', () => {
  const under = calculateCustomSplit(1000, [{ participant: { name: 'Ram' }, amount: 800 }]);
  assert.equal(under.isExact, false);
  assert.equal(under.remainingAmount, 200);

  const over = calculateCustomSplit(1000, [{ participant: { name: 'Ram' }, amount: 1200 }]);
  assert.equal(over.isExact, false);
  assert.equal(over.remainingAmount, -200);
});

test('Item-based split with single and shared items', () => {
  const participants = [
    { id: '1', name: 'Ram' },
    { id: '2', name: 'Sita' },
  ];
  const items = [
    { name: 'Momo', price: 200, assigned: ['1'] },
    { name: 'Pizza', price: 600, assigned: ['1', '2'] },
  ];
  const result = calculateItemSplit(items, participants);
  assert.equal(result.subtotal, 800);
  // Ram: 200 + 300 = 500
  assert.equal(result.rows.find((r) => r.participant.id === '1').share, 500);
  // Sita: 300
  assert.equal(result.rows.find((r) => r.participant.id === '2').share, 300);
  assert.equal(assertReconciled(800, result.rows), true);
});

test('Item-based split with tax and service charge distributed proportionally', () => {
  const participants = [
    { id: '1', name: 'Ram' },
    { id: '2', name: 'Sita' },
  ];
  const items = [
    { name: 'Item 1', price: 400, assigned: ['1'] }, // 40%
    { name: 'Item 2', price: 600, assigned: ['2'] }, // 60%
  ];
  const charges = {
    tax: 130, // 13% of 1000
    serviceCharge: 100, // 10%
    discount: 50, // 5%
  };
  // Net adjustment = 130 + 100 - 50 = 180. Total = 1180.
  const result = calculateItemSplit(items, participants, charges);
  assert.equal(result.subtotal, 1000);
  assert.equal(result.finalTotal, 1180);
  assert.equal(assertReconciled(1180, result.rows), true);
});
