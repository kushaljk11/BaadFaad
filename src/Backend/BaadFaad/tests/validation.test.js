import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../middleware/validate.middleware.js';
import { paginationQuery, paymentInitiateBody, receiptCreateBody, splitCreateBody } from '../validation/schemas.js';

function invoke(schema, body) {
  const req = { body, params: {}, query: {} };
  let code;
  let payload;
  let next = false;
  const res = { status(value) { code = value; return this; }, json(value) { payload = value; return this; } };
  validate({ body: schema })(req, res, () => { next = true; });
  return { req, code, payload, next };
}

test('validation rejects malformed receipt money and reports safe field issues', () => {
  const result = invoke(receiptCreateBody, { items: [{ name: 'Tea', price: 'invalid' }], totalAmount: 40 });
  assert.equal(result.code, 400);
  assert.equal(result.next, false);
  assert.equal(result.payload.message, 'Invalid request data');
  assert.equal(result.payload.issues[0].path, 'items.0.price');
});

test('validation normalizes payment input and strips spoofed identity fields', () => {
  const result = invoke(paymentInitiateBody, { amount: '50.25', productId: 'p1', paymentGateway: 'esewa', customerEmail: 'spoof@example.test' });
  assert.equal(result.next, true);
  assert.equal(result.req.body.amount, 50.25);
  assert.equal('customerEmail' in result.req.body, false);
});

test('split validation rejects unsupported split modes', () => {
  const result = invoke(splitCreateBody, { splitType: 'random', totalAmount: 10 });
  assert.equal(result.code, 400);
});

test('pagination validation supplies bounded integer defaults', () => {
  const defaults = invoke(paginationQuery, {});
  assert.equal(defaults.next, true);
  assert.deepEqual(defaults.req.body, { page: 1, limit: 20 });

  const normalized = invoke(paginationQuery, { page: '2', limit: '100' });
  assert.equal(normalized.next, true);
  assert.deepEqual(normalized.req.body, { page: 2, limit: 100 });

  assert.equal(invoke(paginationQuery, { page: 0, limit: 20 }).code, 400);
  assert.equal(invoke(paginationQuery, { page: 1, limit: 101 }).code, 400);
});
