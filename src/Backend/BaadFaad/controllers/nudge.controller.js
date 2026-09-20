import { sendEmail } from '../config/mail.js';
import createNudgeTemplate from '../templates/nudge.templates.js';
import createSplitSummaryTemplate from '../templates/splitSummary.templates.js';
import {
  getOwnedNudge,
  getOwnedSplitSummary,
  listOwnedNudges,
  reserveNudge,
  setNudgeDelivery,
} from '../repositories/nudge.repository.js';
import { paginationFrom, paginationMeta } from '../utils/pagination.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createAndSendNudge = async (req, res) => {
  const splitParticipantId = req.body?.splitParticipantId;
  if (!UUID.test(String(splitParticipantId || ''))) return res.status(400).json({ message: 'Valid splitParticipantId is required' });
  try {
    const result = await reserveNudge({
      senderId: req.user.id, splitParticipantId, currency: req.body?.currency,
      dueDate: req.body?.dueDate, payLink: req.body?.payLink,
    });
    if (result.status === 'not-found') return res.status(404).json({ message: 'Split participant not found' });
    if (result.status === 'forbidden') return res.status(403).json({ message: 'You are not allowed to nudge this participant' });
    if (result.status === 'settled') return res.status(409).json({ message: 'This participant has no outstanding balance' });
    if (result.status === 'throttled') {
      res.set('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({ message: 'A recent nudge already exists', retryAfterSeconds: result.retryAfterSeconds });
    }
    const nudge = result.nudge;
    if (!nudge.recipientEmail) {
      await setNudgeDelivery({ id: nudge.id, senderId: req.user.id, status: 'failed', errorMessage: 'Recipient has no email address' });
      return res.status(400).json({ success: false, delivered: false, message: 'Recipient has no email address' });
    }
    const template = createNudgeTemplate(nudge);
    try {
      const mail = await sendEmail({ to: nudge.recipientEmail, subject: template.subject, text: template.text, html: template.html });
      const saved = await setNudgeDelivery({ id: nudge.id, senderId: req.user.id, status: 'sent' });
      return res.status(201).json({ success: true, delivered: true, message: 'Nudge sent successfully', provider: mail?.provider || null, nudge: saved });
    } catch (error) {
      const saved = await setNudgeDelivery({ id: nudge.id, senderId: req.user.id, status: 'failed', errorMessage: String(error?.message || 'Mail delivery failed').slice(0, 500) });
      return res.status(502).json({ success: false, delivered: false, message: 'Nudge saved, but email delivery failed', nudge: saved });
    }
  } catch (error) {
    console.error('Nudge creation failed:', error);
    return res.status(500).json({ message: 'Failed to create nudge' });
  }
};

export const getAllNudges = async (req, res) => {
  try {
    const pagination = paginationFrom(req.query);
    const result = await listOwnedNudges(req.user.id, { ...pagination, withMeta: true });
    return res.json({ nudges: result.items, pagination: paginationMeta(result) });
  }
  catch (error) { console.error('Nudge list failed:', error); return res.status(500).json({ message: 'Failed to fetch nudges' }); }
};

export const getNudgeById = async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ message: 'Invalid nudge id' });
  const nudge = await getOwnedNudge(req.params.id, req.user.id);
  return nudge ? res.json(nudge) : res.status(404).json({ message: 'Nudge not found' });
};

export const sendSplitSummary = async (req, res) => {
  const splitId = req.body?.splitId;
  if (!UUID.test(String(splitId || ''))) return res.status(400).json({ message: 'Valid splitId is required' });
  try {
    const summary = await getOwnedSplitSummary(splitId, req.user.id);
    if (!summary) return res.status(404).json({ message: 'Split not found' });
    const recipients = summary.breakdown.filter((row) => row.email);
    const settled = await Promise.allSettled(recipients.map(async (recipient) => {
      const template = createSplitSummaryTemplate({
        recipientName: recipient.name, groupName: summary.groupName, totalAmount: summary.totalAmount,
        participantCount: summary.breakdown.length, recipientShare: recipient.share,
        recipientPaid: recipient.amountPaid, recipientDue: recipient.balanceDue, participants: summary.breakdown,
      });
      const result = await sendEmail({ to: recipient.email, subject: template.subject, text: template.text, html: template.html });
      return { email: recipient.email, provider: result?.provider || null };
    }));
    const failures = settled.flatMap((item, index) => item.status === 'rejected' ? [{ email: recipients[index].email, error: 'Email delivery failed' }] : []);
    const sent = settled.length - failures.length;
    return res.status(failures.length ? 207 : 200).json({ message: failures.length ? 'Summary emails processed with some failures' : 'Summary emails processed', sent, failed: failures.length, totalRecipients: recipients.length, failures });
  } catch (error) {
    console.error('Split summary failed:', error);
    return res.status(500).json({ message: 'Failed to send split summary' });
  }
};

export const updateNudgeStatus = async (req, res) => {
  const status = String(req.body?.status || '').toLowerCase();
  if (!['pending', 'sent', 'failed', 'acknowledged'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const nudge = await setNudgeDelivery({ id: req.params.id, senderId: req.user.id, status });
  return nudge ? res.json({ message: 'Nudge status updated', nudge }) : res.status(404).json({ message: 'Nudge not found' });
};
