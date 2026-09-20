import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { protectStrict } from '../middleware/auth.middleware.js';
import { generateHmacSha256Hash } from '../utils/helper.js';
import { breakdownWithAllocations } from '../utils/paymentAllocations.js';

const invokeMiddleware = (middleware, authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  let statusCode;
  let body;
  let nextCalled = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  middleware(req, res, () => { nextCalled = true; });
  return { req, statusCode, body, nextCalled };
};

test('strict authentication rejects a missing bearer token', () => {
  const result = invokeMiddleware(protectStrict);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('strict authentication rejects tokens when no JWT secret is configured', () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const result = invokeMiddleware(protectStrict, 'Bearer invalid');
  if (previous !== undefined) process.env.JWT_SECRET = previous;
  assert.equal(result.statusCode, 401);
});

test('strict authentication accepts a correctly signed token', () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'unit-test-secret-with-sufficient-entropy';
  const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
  const result = invokeMiddleware(protectStrict, `Bearer ${token}`);
  if (previous === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previous;
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.user.id, 'user-1');
});

test('HMAC generation is stable and rejects missing inputs', () => {
  assert.equal(generateHmacSha256Hash('payload', 'secret'), 'uC/LeRrOxXhZuYm0MKgmSIzi5Hn9+SMmvQoug3WkK6Q=');
  assert.throws(() => generateHmacSha256Hash('', 'secret'));
});

test('payment allocations aggregate by canonical user id', () => {
  const split = {
    breakdown: [{ _id: 'row-1', user: 'user-1', amount: 50 }],
    payments: [{ paidBy: { name: 'Payer' }, allocations: [{ paidFor: 'row-1', amount: 20 }] }],
  };
  const [row] = breakdownWithAllocations(split);
  assert.equal(row.amountPaid, 20);
  assert.equal(row.paidByName, 'Payer');
});
