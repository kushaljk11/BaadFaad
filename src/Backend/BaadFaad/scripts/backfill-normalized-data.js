import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getPrisma } from '../config/prisma.js';
import { toPaisa } from '../utils/money.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deterministicUuid(value) {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  const joined = hex.join('');
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export function referenceId(value) {
  const candidate = value?._id || value?.id || value;
  return UUID_PATTERN.test(String(candidate || '')) ? String(candidate) : null;
}

const money = (value, context) => {
  try {
    const result = toPaisa(value ?? 0);
    if (result < 0n) throw new RangeError('negative');
    return result;
  } catch {
    throw new Error(`Invalid money value at ${context}`);
  }
};

const percentageToBasisPoints = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const basisPoints = Math.round(Number(value) * 100);
  return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= 10_000 ? basisPoints : null;
};

const paymentStatus = (value) => {
  const normalized = String(value || 'unpaid').toUpperCase();
  return ['UNPAID', 'PARTIAL', 'PAID'].includes(normalized) ? normalized : 'UNPAID';
};

const newReport = (apply) => ({
  mode: apply ? 'apply' : 'dry-run',
  examined: { receipts: 0, groups: 0, sessions: 0, splits: 0, transactions: 0 },
  planned: { receiptItems: 0, groupMembers: 0, sessionParticipants: 0, splitParticipants: 0, itemAssignments: 0, payments: 0, paymentAllocations: 0 },
  written: { receiptItems: 0, groupMembers: 0, sessionParticipants: 0, splitParticipants: 0, itemAssignments: 0, payments: 0, paymentAllocations: 0 },
  reconciliation: { receiptTotalsChecked: 0, splitTotalsChecked: 0, paymentTotalsChecked: 0, mismatches: [] },
  warnings: [],
  failures: [],
});

async function backfillReceipts(prisma, apply, report) {
  const receipts = await prisma.receipt.findMany({ select: { id: true, items: true, totalAmount: true, totalPaisa: true } });
  report.examined.receipts = receipts.length;
  for (const receipt of receipts) {
    try {
      const items = Array.isArray(receipt.items) ? receipt.items : [];
      report.planned.receiptItems += items.length;
      const itemTotal = items.reduce((sum, item, index) => sum + money(
        item?.total_price ?? item?.totalPrice ?? Number(item?.price ?? item?.unit_price ?? 0) * Number(item?.quantity ?? 1),
        `receipt ${receipt.id} item ${index} total`,
      ), 0n);
      const receiptTotal = receipt.totalPaisa ?? money(receipt.totalAmount, `receipt ${receipt.id}`);
      report.reconciliation.receiptTotalsChecked += 1;
      if (itemTotal !== receiptTotal) report.reconciliation.mismatches.push({
        entity: 'Receipt', id: receipt.id, expectedPaisa: String(receiptTotal), actualPaisa: String(itemTotal),
        message: 'Item total differs from receipt total (tax, service charge, or discount may explain this)',
      });
      if (!apply) continue;
      await prisma.$transaction(async (tx) => {
        await tx.receipt.update({ where: { id: receipt.id }, data: { totalPaisa: receipt.totalPaisa ?? money(receipt.totalAmount, `receipt ${receipt.id}`) } });
        for (const [index, item] of items.entries()) {
          const id = referenceId(item) || deterministicUuid(`receipt-item:${receipt.id}:${index}`);
          const quantity = Number(item?.quantity ?? 1);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid quantity at receipt ${receipt.id} item ${index}`);
          const unitPricePaisa = money(item?.unit_price ?? item?.unitPrice ?? item?.price ?? 0, `receipt ${receipt.id} item ${index}`);
          const totalPricePaisa = money(item?.total_price ?? item?.totalPrice ?? Number(item?.price ?? item?.unit_price ?? 0) * quantity, `receipt ${receipt.id} item ${index} total`);
          await tx.receiptItem.upsert({
            where: { id },
            create: { id, receiptId: receipt.id, name: String(item?.name || 'Item').slice(0, 200), quantity, unitPricePaisa, totalPricePaisa, sortOrder: index },
            update: { name: String(item?.name || 'Item').slice(0, 200), quantity, unitPricePaisa, totalPricePaisa, sortOrder: index },
          });
          report.written.receiptItems += 1;
        }
      });
    } catch (error) {
      report.failures.push({ entity: 'Receipt', id: receipt.id, message: error.message });
    }
  }
}

async function backfillGroups(prisma, apply, report) {
  const groups = await prisma.group.findMany({ select: { id: true, createdBy: true, members: true, createdAt: true } });
  report.examined.groups = groups.length;
  for (const group of groups) {
    const memberIds = [...new Set([group.createdBy, ...(group.members || [])].filter(Boolean))];
    report.planned.groupMembers += memberIds.length;
    if (!apply) continue;
    try {
      await prisma.$transaction(memberIds.map((userId) => prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        create: { groupId: group.id, userId, role: userId === group.createdBy ? 'OWNER' : 'MEMBER', joinedAt: group.createdAt },
        update: { role: userId === group.createdBy ? 'OWNER' : 'MEMBER', removedAt: null },
      })));
      report.written.groupMembers += memberIds.length;
    } catch (error) {
      report.failures.push({ entity: 'Group', id: group.id, message: error.message });
    }
  }
}

async function resolveSessionIdentity(tx, sessionId, entry, index) {
  const userId = referenceId(entry?.user);
  const linkedParticipantId = referenceId(entry?.participant);
  if (userId) return { userId, participantId: null };
  if (linkedParticipantId) return { userId: null, participantId: linkedParticipantId };

  const participantId = deterministicUuid(`guest-participant:${sessionId}:${referenceId(entry) || index}`);
  await tx.participant.upsert({
    where: { id: participantId },
    create: { id: participantId, userId: null, name: String(entry?.name || 'Guest').slice(0, 100), email: String(entry?.email || `guest-${participantId}@local`).toLowerCase() },
    update: { name: String(entry?.name || 'Guest').slice(0, 100), email: String(entry?.email || `guest-${participantId}@local`).toLowerCase() },
  });
  return { userId: null, participantId };
}

async function backfillSessions(prisma, apply, report) {
  const sessions = await prisma.session.findMany({ select: { id: true, participants: true } });
  report.examined.sessions = sessions.length;
  for (const session of sessions) {
    const participants = Array.isArray(session.participants) ? session.participants : [];
    report.planned.sessionParticipants += participants.length;
    if (!apply) continue;
    try {
      await prisma.$transaction(async (tx) => {
        for (const [index, entry] of participants.entries()) {
          const identity = await resolveSessionIdentity(tx, session.id, entry, index);
          const id = referenceId(entry) || deterministicUuid(`session-participant:${session.id}:${index}`);
          await tx.sessionParticipant.upsert({
            where: { id },
            create: { id, sessionId: session.id, ...identity, displayName: String(entry?.name || entry?.user?.name || 'Participant').slice(0, 100), email: entry?.email || entry?.user?.email || null, isHost: index === 0, joinedAt: entry?.joinedAt ? new Date(entry.joinedAt) : new Date() },
            update: { ...identity, displayName: String(entry?.name || entry?.user?.name || 'Participant').slice(0, 100), email: entry?.email || entry?.user?.email || null, isHost: index === 0 },
          });
          report.written.sessionParticipants += 1;
        }
      });
    } catch (error) {
      report.failures.push({ entity: 'Session', id: session.id, message: error.message });
    }
  }
}

async function backfillSplits(prisma, apply, report) {
  const splits = await prisma.split.findMany({ select: { id: true, receiptId: true, totalAmount: true, totalPaisa: true, breakdown: true, payments: true } });
  report.examined.splits = splits.length;
  for (const split of splits) {
    const breakdown = Array.isArray(split.breakdown) ? split.breakdown : [];
    const payments = Array.isArray(split.payments) ? split.payments : [];
    report.planned.splitParticipants += breakdown.length;
    report.planned.payments += payments.length;
    report.planned.itemAssignments += breakdown.reduce((count, entry) => count + (Array.isArray(entry?.items) ? entry.items.length : 0), 0);
    const splitTotal = split.totalPaisa ?? money(split.totalAmount, `split ${split.id}`);
    const participantTotal = breakdown.reduce((sum, entry, index) => sum + money(entry?.amount, `split ${split.id} participant ${index}`), 0n);
    report.reconciliation.splitTotalsChecked += 1;
    if (breakdown.length && participantTotal !== splitTotal) report.reconciliation.mismatches.push({
      entity: 'Split', id: split.id, expectedPaisa: String(splitTotal), actualPaisa: String(participantTotal),
      message: 'Participant allocations do not reconcile to split total',
    });
    for (const [paymentIndex, legacyPayment] of payments.entries()) {
      const paymentTotal = money(legacyPayment?.amount, `split ${split.id} payment ${paymentIndex}`);
      const allocationTotal = (legacyPayment?.allocations || []).reduce((sum, allocation, allocationIndex) => sum + money(
        allocation?.amount, `payment ${split.id}:${paymentIndex} allocation ${allocationIndex}`,
      ), 0n);
      report.reconciliation.paymentTotalsChecked += 1;
      if ((legacyPayment?.allocations || []).length && allocationTotal !== paymentTotal) report.reconciliation.mismatches.push({
        entity: 'Payment', id: `${split.id}:${paymentIndex}`, expectedPaisa: String(paymentTotal), actualPaisa: String(allocationTotal),
        message: 'Payment allocations do not reconcile to payment total',
      });
    }
    if (!apply) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.split.update({ where: { id: split.id }, data: { totalPaisa: split.totalPaisa ?? money(split.totalAmount, `split ${split.id}`) } });
        const participantLookup = new Map();
        const receiptItems = split.receiptId
          ? await tx.receiptItem.findMany({ where: { receiptId: split.receiptId }, orderBy: { sortOrder: 'asc' } })
          : [];
        const receiptItemLookup = new Map();
        for (const item of receiptItems) {
          receiptItemLookup.set(item.id.toLowerCase(), item);
          if (!receiptItemLookup.has(item.name.toLowerCase())) receiptItemLookup.set(item.name.toLowerCase(), item);
          receiptItemLookup.set(String(item.sortOrder), item);
        }
        for (const [index, entry] of breakdown.entries()) {
          const id = referenceId(entry) || deterministicUuid(`split-participant:${split.id}:${index}`);
          const userId = referenceId(entry?.user);
          const participantId = referenceId(entry?.participant);
          await tx.splitParticipant.upsert({
            where: { id },
            create: { id, splitId: split.id, userId, participantId: userId ? null : participantId, displayName: String(entry?.name || 'Participant').slice(0, 100), email: entry?.email || null, amountPaisa: money(entry?.amount, `split ${split.id} participant ${index}`), percentageBps: percentageToBasisPoints(entry?.percentage), status: paymentStatus(entry?.paymentStatus), sortOrder: index },
            update: { userId, participantId: userId ? null : participantId, displayName: String(entry?.name || 'Participant').slice(0, 100), email: entry?.email || null, amountPaisa: money(entry?.amount, `split ${split.id} participant ${index}`), percentageBps: percentageToBasisPoints(entry?.percentage), status: paymentStatus(entry?.paymentStatus), sortOrder: index },
          });
          [id, referenceId(entry), userId, participantId, entry?.name, entry?.email].filter(Boolean).forEach((key) => participantLookup.set(String(key).toLowerCase(), id));
          report.written.splitParticipants += 1;

          for (const [assignmentIndex, legacyItem] of (Array.isArray(entry?.items) ? entry.items : []).entries()) {
            const rawKey = referenceId(legacyItem) || legacyItem?.receiptItemId || legacyItem?.name || legacyItem;
            const receiptItem = receiptItemLookup.get(String(rawKey ?? assignmentIndex).toLowerCase());
            if (!receiptItem) {
              report.warnings.push({ entity: 'SplitItemAssignment', id: `${split.id}:${index}:${assignmentIndex}`, message: 'Receipt item could not be resolved' });
              continue;
            }
            const quantity = Number(legacyItem?.quantity ?? 1);
            if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid assignment quantity at split ${split.id} participant ${index}`);
            const amountPaisa = legacyItem?.amount !== undefined
              ? money(legacyItem.amount, `split ${split.id} assignment ${assignmentIndex}`)
              : receiptItem.totalPricePaisa;
            await tx.splitItemAssignment.upsert({
              where: { splitParticipantId_receiptItemId: { splitParticipantId: id, receiptItemId: receiptItem.id } },
              create: { splitParticipantId: id, receiptItemId: receiptItem.id, quantity, amountPaisa },
              update: { quantity, amountPaisa },
            });
            report.written.itemAssignments += 1;
          }
        }

        for (const [paymentIndex, legacyPayment] of payments.entries()) {
          const paymentId = referenceId(legacyPayment) || deterministicUuid(`payment:${split.id}:${paymentIndex}`);
          await tx.payment.upsert({
            where: { id: paymentId },
            create: { id: paymentId, splitId: split.id, paidByUserId: referenceId(legacyPayment?.paidBy?.id), amountPaisa: money(legacyPayment?.amount, `split ${split.id} payment ${paymentIndex}`), method: 'legacy', status: 'VERIFIED', note: String(legacyPayment?.note || ''), verifiedAt: legacyPayment?.createdAt ? new Date(legacyPayment.createdAt) : new Date() },
            update: { amountPaisa: money(legacyPayment?.amount, `split ${split.id} payment ${paymentIndex}`), note: String(legacyPayment?.note || '') },
          });
          report.written.payments += 1;
          for (const [allocationIndex, allocation] of (legacyPayment?.allocations || []).entries()) {
            const rawTarget = allocation?.paidFor?._id || allocation?.paidFor || allocation?.paidForEmail || allocation?.paidForName;
            const splitParticipantId = participantLookup.get(String(rawTarget || '').toLowerCase());
            if (!splitParticipantId) {
              report.warnings.push({ entity: 'PaymentAllocation', id: `${split.id}:${paymentIndex}:${allocationIndex}`, message: 'Target participant could not be resolved' });
              continue;
            }
            const id = deterministicUuid(`payment-allocation:${paymentId}:${splitParticipantId}`);
            await tx.paymentAllocation.upsert({ where: { id }, create: { id, paymentId, splitParticipantId, amountPaisa: money(allocation?.amount, `payment ${paymentId} allocation ${allocationIndex}`) }, update: { amountPaisa: money(allocation?.amount, `payment ${paymentId} allocation ${allocationIndex}`) } });
            report.written.paymentAllocations += 1;
          }
        }
      });
    } catch (error) {
      report.failures.push({ entity: 'Split', id: split.id, message: error.message });
    }
  }
}

async function backfillTransactions(prisma, apply, report) {
  const transactions = await prisma.transaction.findMany({ select: { id: true, amount: true, amountPaisa: true } });
  report.examined.transactions = transactions.length;
  if (!apply) return;
  for (const transaction of transactions) {
    try {
      if (transaction.amountPaisa === null) await prisma.transaction.update({ where: { id: transaction.id }, data: { amountPaisa: money(transaction.amount, `transaction ${transaction.id}`) } });
    } catch (error) {
      report.failures.push({ entity: 'Transaction', id: transaction.id, message: error.message });
    }
  }
}

export async function runBackfill({ apply = false } = {}) {
  const prisma = getPrisma();
  const report = newReport(apply);
  await backfillReceipts(prisma, apply, report);
  await backfillGroups(prisma, apply, report);
  await backfillSessions(prisma, apply, report);
  await backfillSplits(prisma, apply, report);
  await backfillTransactions(prisma, apply, report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes('--apply');
  let connectedPrisma = null;
  try {
    connectedPrisma = getPrisma();
    const report = await runBackfill({ apply });
    console.log(JSON.stringify(report, null, 2));
    if (report.failures.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ success: false, message: error.message }));
    process.exitCode = 1;
  } finally {
    if (connectedPrisma) await connectedPrisma.$disconnect();
  }
}
