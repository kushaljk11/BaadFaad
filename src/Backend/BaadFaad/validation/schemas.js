import { z } from 'zod';

export const uuid = z.uuid();
export const positiveMoney = z.coerce.number().finite().positive().max(100_000_000);
export const nonNegativeMoney = z.coerce.number().finite().nonnegative().max(100_000_000);
export const email = z.email().max(320).transform((value) => value.trim().toLowerCase());
const shortText = (max) => z.string().trim().min(1).max(max);
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParams = z.object({ id: uuid });
export const participantIndexParams = z.object({ id: uuid, participantIndex: z.coerce.number().int().nonnegative().max(999) });
export const authLoginBody = z.object({ email, password: z.string().min(1).max(200) });
export const authContinueBody = z.object({ fullName: shortText(100) });
export const participantCreateBody = z.object({ name: shortText(100), email, isHost: z.boolean().optional() });
export const participantUpdateBody = z.object({ name: shortText(100).optional(), email: email.optional(), isHost: z.boolean().optional() }).refine((body) => Object.keys(body).length > 0, 'At least one field is required');

const receiptItem = z.object({ name: shortText(200), price: nonNegativeMoney, quantity: z.coerce.number().positive().max(100000).default(1) });
export const receiptCreateBody = z.object({ restaurant: z.string().trim().max(200).optional(), address: z.string().trim().max(500).optional(), items: z.array(receiptItem).min(1).max(500), totalAmount: nonNegativeMoney });

export const groupIdParams = z.object({ groupId: uuid });
export const splitIdParams = z.object({ splitId: uuid });
export const groupMemberParams = z.object({ groupId: uuid, userId: uuid });
export const groupCreateBody = z.object({ name: shortText(100), description: z.string().trim().max(500).optional(), members: z.array(uuid).max(100).optional(), defaultCurrency: z.string().trim().length(3).optional(), splitId: uuid.nullish(), sessionId: uuid.nullish() });
export const groupUpdateBody = z.object({ name: shortText(100).optional(), description: z.string().trim().max(500).optional(), defaultCurrency: z.string().trim().length(3).optional() }).refine((body) => Object.keys(body).length > 0, 'At least one field is required');
export const addMemberBody = z.object({ userId: uuid });
export const invitationJoinBody = z.object({ inviteToken: z.string().min(40).max(128).regex(/^[A-Za-z0-9_-]+$/) });

export const sessionCreateBody = z.object({ name: shortText(100), splitId: uuid });
export const sessionIdParams = z.object({ sessionId: uuid });

const splitEntry = z.object({
  _id: uuid.optional(), id: uuid.optional(), user: z.union([uuid, z.object({ _id: uuid }).passthrough()]).optional(), participant: z.union([uuid, z.object({ _id: uuid }).passthrough()]).optional(),
  name: z.string().trim().max(100).optional(), email: email.optional(), amount: nonNegativeMoney.optional(), percentage: z.coerce.number().min(0).max(100).optional(),
  items: z.array(z.object({ receiptItemId: uuid.optional(), _id: uuid.optional(), itemName: z.string().max(200).optional(), name: z.string().max(200).optional(), itemPrice: nonNegativeMoney.optional(), price: nonNegativeMoney.optional(), totalPrice: nonNegativeMoney.optional(), amount: nonNegativeMoney.optional(), quantity: z.coerce.number().positive().max(100000).optional() })).max(500).optional(),
}).passthrough();
export const splitCreateBody = z.object({ receiptId: uuid.optional(), splitType: z.enum(['equal', 'percentage', 'custom', 'item_based']).optional(), participants: z.array(splitEntry).min(1).max(100).optional(), breakdown: z.array(splitEntry).min(1).max(100).optional(), name: z.string().trim().max(100).optional(), totalAmount: nonNegativeMoney.optional() });
export const splitUpdateBody = z.object({ receiptId: uuid.optional(), totalAmount: nonNegativeMoney.optional(), splitType: z.enum(['equal', 'percentage', 'custom', 'item_based']).optional(), breakdown: z.array(splitEntry).max(100).optional(), status: z.enum(['pending', 'calculated', 'finalized', 'cancelled']).optional(), notes: z.string().max(2000).optional(), sessionId: uuid.optional() });
export const participantPaymentBody = z.object({ amountPaid: nonNegativeMoney.optional(), paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(), enforceHighestPayer: z.boolean().optional() }).refine((body) => body.amountPaid !== undefined || body.paymentStatus !== undefined, 'Payment amount or status is required');

export const paymentInitiateBody = z.object({ amount: positiveMoney, productId: shortText(200), paymentGateway: z.enum(['esewa', 'khalti']), customerPhone: z.string().trim().max(30).optional(), productName: z.string().trim().max(200).optional(), splitId: uuid.optional() });
export const paymentStatusBody = z.object({ product_id: shortText(200), pidx: z.string().trim().max(300).nullish() });
export const nudgeSendBody = z.object({ splitParticipantId: uuid, currency: z.string().trim().max(3).optional(), dueDate: z.string().trim().max(100).optional(), payLink: z.url().max(2000).optional() });
export const summaryBody = z.object({ splitId: uuid });
export const nudgeStatusBody = z.object({ status: z.enum(['pending', 'sent', 'failed', 'acknowledged']) });
export const mailBody = z.object({ subject: z.string().max(200).optional(), text: z.string().trim().min(1).max(10000) });
export const billBody = z.object({ image: z.string().max(8_000_000).regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i, 'Invalid image data') });
