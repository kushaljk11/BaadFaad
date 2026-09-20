import axios from 'axios';
import { toPaisa } from '../utils/money.js';

const requestOptions = { timeout: 15_000, maxRedirects: 0, maxContentLength: 1_000_000 };
const secret = () => String(process.env.KHALTI_SECRET_KEY || '').trim().replace(/^Key\s+/i, '');

export async function verifyProviderPayment(transaction, { pidx } = {}, http = axios) {
  const expectedPaisa = transaction.amountPaisa ?? toPaisa(transaction.amount);
  if (transaction.payment_gateway === 'esewa') {
    if (!process.env.ESEWA_PAYMENT_STATUS_CHECK_URL || !process.env.ESEWA_MERCHANT_ID) throw new Error('eSewa verification is not configured');
    const response = await http.get(process.env.ESEWA_PAYMENT_STATUS_CHECK_URL, {
      ...requestOptions,
      params: { product_code: process.env.ESEWA_MERCHANT_ID, total_amount: transaction.amount, transaction_uuid: transaction.product_id },
    });
    const data = response.data || {};
    const paidAmountPaisa = toPaisa(data.total_amount ?? data.totalAmount ?? transaction.amount);
    return {
      verified: data.status === 'COMPLETE' && paidAmountPaisa === expectedPaisa,
      paidAmountPaisa,
      providerTransactionId: data.ref_id || data.transaction_code || null,
      response: data,
      reason: data.status === 'COMPLETE' ? 'Provider amount mismatch' : `eSewa status: ${data.status || 'unknown'}`,
    };
  }
  if (transaction.payment_gateway === 'khalti') {
    if (!pidx) throw new TypeError('pidx is required for Khalti verification');
    if (!process.env.KHALTI_VERIFICATION_URL || !secret()) throw new Error('Khalti verification is not configured');
    const response = await http.post(process.env.KHALTI_VERIFICATION_URL, { pidx }, {
      ...requestOptions,
      headers: { Authorization: `Key ${secret()}`, 'Content-Type': 'application/json' },
    });
    const data = response.data || {};
    const paidAmountPaisa = BigInt(Math.round(Number(data.total_amount ?? data.amount ?? 0)));
    return {
      verified: data.status === 'Completed' && paidAmountPaisa === expectedPaisa,
      paidAmountPaisa,
      providerTransactionId: String(data.pidx || pidx),
      response: data,
      reason: data.status === 'Completed' ? 'Provider amount mismatch' : `Khalti status: ${data.status || 'unknown'}`,
    };
  }
  throw new TypeError('Unsupported payment gateway');
}

export { requestOptions };
