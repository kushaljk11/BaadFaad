import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProviderPayment } from '../services/paymentProvider.service.js';

test('eSewa verification requires provider success and exact amount', async () => {
  process.env.ESEWA_PAYMENT_STATUS_CHECK_URL = 'https://example.test/status';
  process.env.ESEWA_MERCHANT_ID = 'merchant';
  const transaction = { payment_gateway: 'esewa', product_id: 'p1', amount: 10, amountPaisa: 1000n };
  const valid = await verifyProviderPayment(transaction, {}, { get: async () => ({ data: { status: 'COMPLETE', total_amount: 10, ref_id: 'ref' } }) });
  const mismatch = await verifyProviderPayment(transaction, {}, { get: async () => ({ data: { status: 'COMPLETE', total_amount: 9 } }) });
  assert.equal(valid.verified, true);
  assert.equal(valid.providerTransactionId, 'ref');
  assert.equal(mismatch.verified, false);
});

test('Khalti verification compares provider paisa and requires pidx', async () => {
  process.env.KHALTI_VERIFICATION_URL = 'https://example.test/lookup';
  process.env.KHALTI_SECRET_KEY = 'test-secret';
  const transaction = { payment_gateway: 'khalti', product_id: 'p2', amount: 10, amountPaisa: 1000n };
  const valid = await verifyProviderPayment(transaction, { pidx: 'px' }, { post: async () => ({ data: { status: 'Completed', total_amount: 1000, pidx: 'px' } }) });
  assert.equal(valid.verified, true);
  await assert.rejects(() => verifyProviderPayment(transaction, {}, { post: async () => ({}) }), /pidx is required/);
});
