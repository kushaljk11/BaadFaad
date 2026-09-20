import test from 'node:test';
import assert from 'node:assert/strict';
import { toReceiptDto } from '../repositories/receipt.repository.js';

test('receipt DTO prefers normalized items and converts bigint money safely', () => {
  const dto = toReceiptDto({
    id: 'receipt-id',
    createdBy: 'user-id',
    restaurant: 'Momo House',
    address: 'Kathmandu',
    items: [{ name: 'stale legacy item', price: 1, quantity: 1 }],
    totalAmount: 1,
    totalPaisa: 52550n,
    imageUrl: '',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    relationalItems: [{
      name: 'Momo',
      quantity: '2.000',
      unitPricePaisa: 25000n,
      totalPricePaisa: 50000n,
    }],
  });

  assert.equal(dto._id, 'receipt-id');
  assert.equal(dto.totalAmount, 525.5);
  assert.deepEqual(dto.items, [{ name: 'Momo', price: 250, quantity: 2 }]);
});

test('receipt DTO retains legacy items during the compatibility window', () => {
  const legacyItems = [{ name: 'Tea', price: 40, quantity: 1 }];
  const dto = toReceiptDto({
    id: 'legacy-id',
    createdBy: 'user-id',
    restaurant: '',
    address: '',
    items: legacyItems,
    totalAmount: 40,
    totalPaisa: null,
    imageUrl: '',
    relationalItems: [],
  });

  assert.equal(dto.totalAmount, 40);
  assert.deepEqual(dto.items, legacyItems);
});
