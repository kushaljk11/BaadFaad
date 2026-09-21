/**
 * @file utils/contributionEngine.js
 * @description Validates and formats participant payments towards the original merchant bill.
 *
 * Invariants:
 * 1. All contribution amounts must be non-negative (>= 0).
 * 2. Sum of all participant contributions must exactly equal the total bill amount (in paisa).
 * 3. Does not allow saving when totals do not reconcile.
 */

import { assertReconciled, fromPaisa, toPaisa } from './money.js';

/**
 * Validates and allocates contribution amounts across participants.
 *
 * @param {bigint|number|string} totalPaisaOrRupees - Grand total of the bill
 * @param {Array<{
 *   participantId?: string,
 *   id?: string,
 *   userId?: string,
 *   amount?: number|string|bigint,
 *   amountPaisa?: bigint,
 *   paidAmount?: number|string|bigint,
 *   paidAmountPaisa?: bigint
 * }>} contributions - Contribution entries
 * @param {object} [options]
 * @param {string} [options.defaultPayerId] - If contributions is empty, assign 100% to this ID
 * @returns {Array<{
 *   participantId: string,
 *   amountPaisa: bigint,
 *   amount: number
 * }>}
 */
export function validateAndAllocateContributions(totalPaisaOrRupees, contributions = [], options = {}) {
  const totalPaisa = typeof totalPaisaOrRupees === 'bigint'
    ? totalPaisaOrRupees
    : toPaisa(totalPaisaOrRupees);

  if (totalPaisa < 0n) {
    throw new RangeError('Total bill amount must be non-negative');
  }

  // If no contributions are provided and a default payer ID is supplied, assign 100% to that payer
  if ((!Array.isArray(contributions) || contributions.length === 0) && options.defaultPayerId) {
    return [{
      participantId: String(options.defaultPayerId),
      amountPaisa: totalPaisa,
      amount: Number(fromPaisa(totalPaisa)),
    }];
  }

  if (!Array.isArray(contributions) || contributions.length === 0) {
    if (totalPaisa === 0n) return [];
    throw new TypeError('At least one contribution entry is required');
  }

  let allocatedSum = 0n;
  const result = contributions.map((c, index) => {
    const rawId = c.participantId || c.id || c.userId || c._id;
    if (!rawId) {
      throw new TypeError(`Participant ID missing at contribution entry ${index}`);
    }
    const participantId = String(rawId);

    const val = c.paidAmountPaisa !== undefined
      ? BigInt(c.paidAmountPaisa)
      : c.amountPaisa !== undefined
        ? BigInt(c.amountPaisa)
        : toPaisa(c.paidAmount ?? c.amount ?? 0);

    if (val < 0n) {
      throw new RangeError(`Contribution for participant ${participantId} cannot be negative`);
    }

    allocatedSum += val;
    return {
      participantId,
      amountPaisa: val,
      amount: Number(fromPaisa(val)),
    };
  });

  if (allocatedSum !== totalPaisa) {
    throw new RangeError(
      `Contributions do not reconcile with bill total: assigned ${fromPaisa(allocatedSum)} (Rs), total is ${fromPaisa(totalPaisa)} (Rs). Difference: ${fromPaisa(totalPaisa - allocatedSum)} (Rs)`
    );
  }

  return result;
}

/**
 * Convenience helper to compute remaining unassigned amount for UI display.
 * @param {bigint|number|string} totalAmount
 * @param {Array<{ amount?: any, paidAmount?: any, amountPaisa?: any, paidAmountPaisa?: any }>} contributions
 * @returns {{
 *   totalPaisa: bigint,
 *   assignedPaisa: bigint,
 *   remainingPaisa: bigint,
 *   total: number,
 *   assigned: number,
 *   remaining: number,
 *   isExact: boolean
 * }}
 */
export function getContributionSummary(totalAmount, contributions = []) {
  const totalPaisa = typeof totalAmount === 'bigint' ? totalAmount : toPaisa(totalAmount);
  let assignedPaisa = 0n;

  if (Array.isArray(contributions)) {
    for (const c of contributions) {
      const val = c.paidAmountPaisa !== undefined
        ? BigInt(c.paidAmountPaisa)
        : c.amountPaisa !== undefined
          ? BigInt(c.amountPaisa)
          : toPaisa(c.paidAmount ?? c.amount ?? 0);
      if (val > 0n) assignedPaisa += val;
    }
  }

  const remainingPaisa = totalPaisa - assignedPaisa;
  return {
    totalPaisa,
    assignedPaisa,
    remainingPaisa,
    total: Number(fromPaisa(totalPaisa)),
    assigned: Number(fromPaisa(assignedPaisa)),
    remaining: Number(fromPaisa(remainingPaisa)),
    isExact: remainingPaisa === 0n,
  };
}
