/**
 * @file utils/settlementEngine.js
 * @description Deterministic, zero-leak settlement engine for BaadFaad.
 *
 * Given participant obligations (shareAmount) and merchant payments (paidAmount),
 * this calculates the net balance for each participant and produces an optimal,
 * minimal set of debtor-to-creditor transfers using integer paisa arithmetic.
 *
 * Invariants:
 * 1. netBalance = paidAmount - shareAmount
 * 2. netBalance > 0 => Creditor (receives money)
 * 3. netBalance < 0 => Debtor (owes money)
 * 4. netBalance === 0 => Settled
 * 5. sum(all debts) === sum(all credits)
 * 6. sum(all transfers) === sum(all credits)
 * 7. Sum of net balances across session === 0
 */

import { fromPaisa, toPaisa } from './money.js';

/**
 * Calculates directed settlement transfers between debtors and creditors.
 *
 * @param {Array<{
 *   id?: string,
 *   participantId?: string,
 *   userId?: string,
 *   name?: string,
 *   displayName?: string,
 *   shareAmount?: number|string|bigint,
 *   shareAmountPaisa?: bigint,
 *   paidAmount?: number|string|bigint,
 *   paidAmountPaisa?: bigint,
 *   amountPaisa?: bigint
 * }>} participants
 * @returns {{
 *   participants: Array<{
 *     id: string,
 *     name: string,
 *     shareAmount: number,
 *     paidAmount: number,
 *     netBalance: number,
 *     shareAmountPaisa: bigint,
 *     paidAmountPaisa: bigint,
 *     netBalancePaisa: bigint,
 *     status: 'creditor' | 'debtor' | 'settled'
 *   }>,
 *   transfers: Array<{
 *     fromParticipantId: string,
 *     fromName: string,
 *     toParticipantId: string,
 *     toName: string,
 *     amount: number,
 *     amountPaisa: bigint
 *   }>,
 *   totalDebtPaisa: bigint,
 *   totalCreditPaisa: bigint
 * }}
 */
export function calculateSettlement(participants = []) {
  if (!Array.isArray(participants) || participants.length === 0) {
    return {
      participants: [],
      transfers: [],
      totalDebtPaisa: 0n,
      totalCreditPaisa: 0n,
    };
  }

  // 1. Normalize each participant into exact BigInt paisa
  const normalizedParticipants = participants.map((p, index) => {
    const id = String(p.id || p.participantId || p.userId || p._id || `p-${index}`);
    const name = String(p.displayName || p.name || p.fullName || `Participant ${index + 1}`);

    // shareAmount: obligation from bill split
    const sharePaisa = p.shareAmountPaisa !== undefined
      ? BigInt(p.shareAmountPaisa)
      : p.amountPaisa !== undefined
        ? BigInt(p.amountPaisa)
        : toPaisa(p.shareAmount ?? p.amount ?? 0);

    // paidAmount: contribution made towards the original bill
    const paidPaisa = p.paidAmountPaisa !== undefined
      ? BigInt(p.paidAmountPaisa)
      : toPaisa(p.paidAmount ?? 0);

    // netBalance = paidAmount - shareAmount
    const netPaisa = paidPaisa - sharePaisa;

    let status = 'settled';
    if (netPaisa > 0n) status = 'creditor';
    else if (netPaisa < 0n) status = 'debtor';

    return {
      id,
      name,
      shareAmount: Number(fromPaisa(sharePaisa)),
      paidAmount: Number(fromPaisa(paidPaisa)),
      netBalance: Number(fromPaisa(netPaisa)),
      shareAmountPaisa: sharePaisa,
      paidAmountPaisa: paidPaisa,
      netBalancePaisa: netPaisa,
      status,
    };
  });

  // 2. Partition into debtors and creditors
  // Debtor: netBalance < 0 => owes -netBalance
  // Creditor: netBalance > 0 => is owed netBalance
  const debtors = [];
  const creditors = [];
  let totalDebtPaisa = 0n;
  let totalCreditPaisa = 0n;

  for (const p of normalizedParticipants) {
    if (p.netBalancePaisa < 0n) {
      const debt = -p.netBalancePaisa;
      debtors.push({ id: p.id, name: p.name, remainingPaisa: debt });
      totalDebtPaisa += debt;
    } else if (p.netBalancePaisa > 0n) {
      const credit = p.netBalancePaisa;
      creditors.push({ id: p.id, name: p.name, remainingPaisa: credit });
      totalCreditPaisa += credit;
    }
  }

  // Exact balance check: total debt must match total credit
  if (totalDebtPaisa !== totalCreditPaisa) {
    throw new RangeError(
      `Financial imbalance in settlement: total debt (${totalDebtPaisa} paisa) !== total credit (${totalCreditPaisa} paisa)`
    );
  }

  // 3. Deterministic greedy debtor-creditor matching algorithm
  // Sort debtors descending by remaining debt, and creditors descending by remaining credit.
  // Stable secondary sort by id prevents non-deterministic outputs.
  debtors.sort((a, b) => {
    if (a.remainingPaisa === b.remainingPaisa) return a.id.localeCompare(b.id);
    return a.remainingPaisa > b.remainingPaisa ? -1 : 1;
  });

  creditors.sort((a, b) => {
    if (a.remainingPaisa === b.remainingPaisa) return a.id.localeCompare(b.id);
    return a.remainingPaisa > b.remainingPaisa ? -1 : 1;
  });

  const transfers = [];
  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    if (debtor.remainingPaisa === 0n) {
      dIndex++;
      continue;
    }
    if (creditor.remainingPaisa === 0n) {
      cIndex++;
      continue;
    }

    // Transfer the minimum of remaining debt and remaining credit
    const transferPaisa = debtor.remainingPaisa < creditor.remainingPaisa
      ? debtor.remainingPaisa
      : creditor.remainingPaisa;

    if (transferPaisa > 0n) {
      transfers.push({
        fromParticipantId: debtor.id,
        fromName: debtor.name,
        toParticipantId: creditor.id,
        toName: creditor.name,
        amount: Number(fromPaisa(transferPaisa)),
        amountPaisa: transferPaisa,
      });

      debtor.remainingPaisa -= transferPaisa;
      creditor.remainingPaisa -= transferPaisa;
    }

    if (debtor.remainingPaisa === 0n) dIndex++;
    if (creditor.remainingPaisa === 0n) cIndex++;
  }

  // 4. Assert reconciliation
  const transferredTotal = transfers.reduce((sum, t) => sum + t.amountPaisa, 0n);
  if (transferredTotal !== totalCreditPaisa) {
    throw new RangeError(
      `Settlement transfer mismatch: transferred (${transferredTotal} paisa) !== total credit (${totalCreditPaisa} paisa)`
    );
  }

  return {
    participants: normalizedParticipants,
    transfers,
    totalDebtPaisa,
    totalCreditPaisa,
  };
}

/**
 * Enriches directed settlement obligations with actual repayment ledger records.
 *
 * @param {Array<{
 *   fromParticipantId: string,
 *   fromName: string,
 *   toParticipantId: string,
 *   toName: string,
 *   amount: number,
 *   amountPaisa: bigint|string
 * }>} transfers
 * @param {Array<{
 *   id?: string,
 *   fromParticipantId: string,
 *   toParticipantId: string,
 *   amountPaisa: bigint|string,
 *   method?: string,
 *   note?: string,
 *   recordedByUser?: { name: string },
 *   recordedByName?: string,
 *   createdAt?: Date|string
 * }>} payments
 * @returns {{
 *   transfers: Array<{
 *     id: string,
 *     fromParticipantId: string,
 *     fromName: string,
 *     toParticipantId: string,
 *     toName: string,
 *     dueAmount: number,
 *     dueAmountPaisa: string,
 *     paidAmount: number,
 *     paidAmountPaisa: string,
 *     remainingAmount: number,
 *     remainingAmountPaisa: string,
 *     status: 'UNPAID' | 'PARTIAL' | 'PAID',
 *     payments: Array<any>
 *   }>,
 *   isFullySettled: boolean,
 *   totalDue: number,
 *   totalDuePaisa: string,
 *   totalPaid: number,
 *   totalPaidPaisa: string,
 *   totalRemaining: number,
 *   totalRemainingPaisa: string
 * }}
 */
export function enrichSettlementWithPayments(transfers = [], payments = []) {
  let totalDuePaisa = 0n;
  let totalPaidPaisa = 0n;

  const enrichedTransfers = transfers.map((t) => {
    const duePaisa = BigInt(t.amountPaisa);
    totalDuePaisa += duePaisa;

    const matchingPayments = (payments || []).filter(
      (p) =>
        String(p.fromParticipantId) === String(t.fromParticipantId) &&
        String(p.toParticipantId) === String(t.toParticipantId)
    );

    const paidPaisa = matchingPayments.reduce((sum, p) => sum + BigInt(p.amountPaisa), 0n);
    totalPaidPaisa += (paidPaisa > duePaisa ? duePaisa : paidPaisa);

    const remainingPaisa = duePaisa > paidPaisa ? duePaisa - paidPaisa : 0n;
    const status = paidPaisa <= 0n ? 'UNPAID' : remainingPaisa <= 0n ? 'PAID' : 'PARTIAL';

    return {
      id: `${t.fromParticipantId}_${t.toParticipantId}`,
      fromParticipantId: t.fromParticipantId,
      fromName: t.fromName,
      toParticipantId: t.toParticipantId,
      toName: t.toName,
      amount: Number(fromPaisa(duePaisa)),
      amountPaisa: duePaisa.toString(),
      dueAmount: Number(fromPaisa(duePaisa)),
      dueAmountPaisa: duePaisa.toString(),
      paidAmount: Number(fromPaisa(paidPaisa)),
      paidAmountPaisa: paidPaisa.toString(),
      remainingAmount: Number(fromPaisa(remainingPaisa)),
      remainingAmountPaisa: remainingPaisa.toString(),
      status,
      payments: matchingPayments.map((p) => ({
        id: p.id,
        amount: Number(fromPaisa(BigInt(p.amountPaisa))),
        amountPaisa: p.amountPaisa.toString(),
        method: p.method || 'CASH',
        note: p.note || '',
        recordedByName: p.recordedByUser?.name || p.recordedByName || 'Host',
        createdAt: p.createdAt || new Date(),
      })),
    };
  });

  const totalRemainingPaisa = totalDuePaisa > totalPaidPaisa ? totalDuePaisa - totalPaidPaisa : 0n;
  const isFullySettled =
    enrichedTransfers.length === 0 ||
    enrichedTransfers.every((t) => t.status === 'PAID');

  return {
    transfers: enrichedTransfers,
    isFullySettled,
    totalDue: Number(fromPaisa(totalDuePaisa)),
    totalDuePaisa: totalDuePaisa.toString(),
    totalPaid: Number(fromPaisa(totalPaidPaisa)),
    totalPaidPaisa: totalPaidPaisa.toString(),
    totalRemaining: Number(fromPaisa(totalRemainingPaisa)),
    totalRemainingPaisa: totalRemainingPaisa.toString(),
  };
}
