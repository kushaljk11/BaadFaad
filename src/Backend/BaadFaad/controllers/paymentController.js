import axios from 'axios';
import { sendEmail } from '../config/mail.js';
import { createPaymentTemplate } from '../templates/payment.templates.js';
import { generateHmacSha256Hash } from '../utils/helper.js';
import { toPaisa } from '../utils/money.js';
import {
  completeGatewayTransaction,
  failGatewayTransaction,
  findOwnedTransaction,
  releasePendingTransaction,
  reserveGatewayTransaction,
} from '../repositories/payment.repository.js';
import { requestOptions, verifyProviderPayment } from '../services/paymentProvider.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');
const khaltiSecret = () => clean(process.env.KHALTI_SECRET_KEY).replace(/^Key\s+/i, '');
const httpUrl = (value) => { try { return ['http:', 'https:'].includes(new URL(String(value)).protocol); } catch { return false; } };
const completedPayload = (transaction, message, mail = { skipped: true }) => ({
  message,
  status: 'COMPLETED',
  amount: transaction.amount,
  currency: transaction.currency || 'NPR',
  gateway: transaction.payment_gateway,
  transactionId: transaction.product_id,
  mail,
});

async function sendReceipt(transaction) {
  const customer = transaction.customerDetails || {};
  if (!customer.email) return { delivered: false, skipped: true };
  const template = createPaymentTemplate({
    recipientName: customer.name || 'Friend', amount: transaction.amount, currency: 'NPR',
    groupName: transaction.product_name, paidTo: 'BaadFaad split',
    paymentMethod: transaction.payment_gateway.toUpperCase(), paymentDate: new Date().toLocaleString(), transactionId: transaction.product_id,
  });
  const sent = await sendEmail({ to: customer.email, subject: template.subject, text: template.text, html: template.html });
  return { delivered: true, skipped: false, provider: sent?.provider || null };
}

export const initiatePayment = async (req, res) => {
  const gateway = String(req.body?.paymentGateway || '').trim().toLowerCase();
  const productId = String(req.body?.productId || '').trim();
  const splitId = req.body?.splitId || null;
  if (!['esewa', 'khalti'].includes(gateway)) return res.status(400).json({ message: 'Invalid payment gateway. Use esewa or khalti' });
  if (!productId || productId.length > 200) return res.status(400).json({ message: 'Valid productId is required' });
  if (splitId && !UUID.test(splitId)) return res.status(400).json({ message: 'Invalid splitId' });
  let reserved = false;
  try {
    const amountPaisa = toPaisa(req.body?.amount);
    const idempotencyKey = String(req.get('Idempotency-Key') || `${req.user.id}:${productId}`).slice(0, 300);
    const reservation = await reserveGatewayTransaction({
      userId: req.user.id, splitId, productId, gateway, amount: req.body?.amount,
      productName: req.body?.productName, idempotencyKey,
    });
    if (reservation.status === 'duplicate') return res.status(409).json({ message: 'A payment already exists for this productId or idempotency key' });
    if (reservation.status === 'split-forbidden') return res.status(403).json({ message: 'You are not a participant in this split' });
    if (reservation.status === 'amount-exceeds-due') return res.status(400).json({ message: 'Payment amount exceeds the outstanding balance' });
    if (reservation.status !== 'reserved') return res.status(401).json({ message: 'User not found' });
    reserved = true;

    let response;
    let paymentUrl;
    if (gateway === 'esewa') {
      const required = ['FAILURE_URL', 'SUCCESS_URL', 'ESEWA_MERCHANT_ID', 'ESEWA_SECRET', 'ESEWA_PAYMENT_URL'];
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length) throw new TypeError(`Missing eSewa configuration: ${missing.join(', ')}`);
      const data = {
        amount: reservation.transaction.amount, failure_url: process.env.FAILURE_URL, product_delivery_charge: '0', product_service_charge: '0',
        product_code: process.env.ESEWA_MERCHANT_ID, signed_field_names: 'total_amount,transaction_uuid,product_code',
        success_url: process.env.SUCCESS_URL, tax_amount: '0', total_amount: reservation.transaction.amount, transaction_uuid: productId,
      };
      data.signature = generateHmacSha256Hash(`total_amount=${data.total_amount},transaction_uuid=${productId},product_code=${data.product_code}`, process.env.ESEWA_SECRET);
      if (!httpUrl(process.env.ESEWA_PAYMENT_URL)) throw new TypeError('eSewa payment URL is invalid');
      response = await axios.post(process.env.ESEWA_PAYMENT_URL, data, { ...requestOptions, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      paymentUrl = response.data?.payment_url || response.request?.res?.responseUrl;
    } else {
      if (!httpUrl(process.env.KHALTI_PAYMENT_URL) || !process.env.SUCCESS_URL || !khaltiSecret()) throw new TypeError('Khalti payment configuration is incomplete');
      response = await axios.post(process.env.KHALTI_PAYMENT_URL, {
        return_url: process.env.SUCCESS_URL, website_url: process.env.WEBSITE_URL || 'https://baadfaad.vercel.app',
        amount: Number(amountPaisa), purchase_order_id: productId, purchase_order_name: reservation.transaction.product_name,
        customer_info: { ...reservation.transaction.customerDetails, phone: String(req.body?.customerPhone || '').slice(0, 30) },
      }, { ...requestOptions, headers: { Authorization: `Key ${khaltiSecret()}`, 'Content-Type': 'application/json' } });
      paymentUrl = response.data?.payment_url;
    }
    if (!httpUrl(paymentUrl)) throw new Error('Payment provider did not return a valid URL');
    return res.json({ url: paymentUrl });
  } catch (error) {
    if (reserved) await releasePendingTransaction({ productId, userId: req.user.id, reason: error.message });
    const clientError = error instanceof TypeError || error instanceof RangeError;
    if (!clientError) console.error('Payment initiation failed', { providerStatus: error?.response?.status, code: error?.code });
    return res.status(clientError ? 400 : 502).json({ message: clientError ? error.message : 'Payment initiation failed' });
  }
};

export const paymentStatus = async (req, res) => {
  const productId = String(req.body?.product_id || '').trim();
  if (!productId) return res.status(400).json({ message: 'product_id is required' });
  try {
    const transaction = await findOwnedTransaction(productId, req.user.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.status === 'COMPLETED') return res.json(completedPayload(transaction, 'Transaction already completed'));
    const verification = await verifyProviderPayment(transaction, { pidx: req.body?.pidx });
    if (!verification.verified) {
      await failGatewayTransaction({ productId, userId: req.user.id, reason: verification.reason, providerResponse: verification.response });
      return res.json({ message: 'Transaction status updated to FAILED', status: 'FAILED' });
    }
    const result = await completeGatewayTransaction({
      productId, userId: req.user.id, paidAmountPaisa: verification.paidAmountPaisa,
      providerTransactionId: verification.providerTransactionId, providerResponse: verification.response,
    });
    if (result.status === 'amount-mismatch') return res.status(400).json({ message: 'Provider amount does not match the requested amount' });
    let mail = { delivered: false, skipped: true };
    if (result.status === 'completed') try { mail = await sendReceipt(result.transaction); } catch (error) { mail = { delivered: false, skipped: false, error: 'Receipt email failed' }; }
    return res.json(completedPayload(result.transaction, 'Transaction status updated successfully', mail));
  } catch (error) {
    console.error('Payment verification failed', { providerStatus: error?.response?.status, code: error?.code });
    return res.status(error instanceof TypeError ? 400 : 502).json({ message: 'Payment status check failed' });
  }
};
