/**
 * @fileoverview Centralized Financial Calculation Engine for BaadFaad
 * @description Provides deterministic, paisa-accurate financial calculations for all split types.
 *
 * Guaranteed Invariants:
 * 1. Sum of participant obligations strictly equals final total (allocated remainders handled predictably).
 * 2. All currency math operates in paisa (1 rupee = 100 paisa) using integer BigInt arithmetic.
 * 3. Consistent with backend splitEngine rules.
 *
 * Supported Split Types:
 * - Equal Split: Remainder allocated to first N participants.
 * - Percentage Split: Verifies 100% total, calculates exact shares, allocates remainder paisa.
 * - Custom Split: Tracks exact allocated vs remaining amount.
 * - Item-based Split: Divides shared items equally among assignees; proportions tax/service charge/discount.
 *
 * @module utills/calculationEngine
 */

const PAISA_PER_RUPEE = 100n;
const BASIS_POINTS_TOTAL = 10_000; // 100.00%

/**
 * Converts a rupee number or string to integer paisa BigInt.
 * @param {number|string|bigint} value
 * @returns {bigint}
 */
export function toPaisa(value) {
  if (typeof value === 'bigint') return value;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || normalized === null || normalized === undefined || !Number.isFinite(Number(normalized))) {
    return 0n;
  }
  const paisa = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(paisa)) throw new RangeError('Amount exceeds safe financial range');
  return BigInt(Math.max(0, paisa));
}

/**
 * Converts paisa BigInt back to a float number in Rupees for display.
 * @param {bigint|number} paisa
 * @returns {number}
 */
export function fromPaisa(paisa) {
  const p = typeof paisa === 'bigint' ? paisa : BigInt(paisa || 0);
  return Number(p) / 100;
}

/**
 * Formats paisa directly into decimal rupees string: "1250.00"
 * @param {bigint|number} paisa
 * @returns {string}
 */
export function formatPaisaString(paisa) {
  const p = typeof paisa === 'bigint' ? paisa : BigInt(paisa || 0);
  const sign = p < 0n ? '-' : '';
  const abs = p < 0n ? -p : p;
  const rupees = abs / 100n;
  const fraction = String(abs % 100n).padStart(2, '0');
  return `${sign}${rupees}.${fraction}`;
}

/**
 * Allocates total paisa evenly across N participants, distributing remainder 1 paisa each.
 * @param {bigint} totalPaisa
 * @param {number} count
 * @returns {bigint[]}
 */
export function allocateEvenly(totalPaisa, count) {
  if (count <= 0) return [];
  const c = BigInt(count);
  const base = totalPaisa / c;
  let remainder = totalPaisa % c;

  const result = [];
  for (let i = 0; i < count; i++) {
    const extra = remainder > 0n ? 1n : 0n;
    if (remainder > 0n) remainder -= 1n;
    result.push(base + extra);
  }
  return result;
}

/**
 * Calculate Equal Split
 * @param {number} totalAmount - Total bill in rupees
 * @param {Array<object>|number} participants - List of participants or participant count
 * @returns {Array<{ participant: any, amount: number, amountPaisa: bigint }>}
 */
export function calculateEqualSplit(totalAmount, participants) {
  const list = Array.isArray(participants) ? participants : Array.from({ length: Math.max(1, Number(participants) || 1) }, (_, i) => ({ id: `p-${i}`, name: `Person ${i + 1}` }));
  const count = list.length;
  if (count === 0) return [];

  const totalPaisa = toPaisa(totalAmount);
  const allocations = allocateEvenly(totalPaisa, count);

  return list.map((participant, index) => ({
    participant,
    amount: fromPaisa(allocations[index]),
    amountPaisa: allocations[index],
  }));
}

/**
 * Calculate Percentage Split
 * @param {number} totalAmount - Total bill in rupees
 * @param {Array<{ participant: any, percentage: number }>} entries
 * @returns {{
 *   rows: Array<{ participant: any, percentage: number, amount: number, amountPaisa: bigint }>,
 *   totalPercentage: number,
 *   remainingPercentage: number,
 *   isValid: boolean,
 *   errorMessage: string|null
 * }}
 */
export function calculatePercentageSplit(totalAmount, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { rows: [], totalPercentage: 0, remainingPercentage: 100, isValid: false, errorMessage: 'At least one participant required' };
  }

  const totalPaisa = toPaisa(totalAmount);
  let sumBasisPoints = 0;
  const parsed = entries.map((entry) => {
    const pct = Math.max(0, Number(entry.percentage) || 0);
    const bps = Math.round(pct * 100);
    sumBasisPoints += bps;
    return { ...entry, bps, pct };
  });

  const totalPercentage = sumBasisPoints / 100;
  const remainingPercentage = Math.round((100 - totalPercentage) * 100) / 100;
  const isValid = sumBasisPoints === BASIS_POINTS_TOTAL;

  let errorMessage = null;
  if (sumBasisPoints < BASIS_POINTS_TOTAL) {
    errorMessage = `${remainingPercentage}% remaining`;
  } else if (sumBasisPoints > BASIS_POINTS_TOTAL) {
    errorMessage = `${Math.abs(remainingPercentage)}% over 100%`;
  }

  if (sumBasisPoints === 0) {
    return {
      rows: entries.map((e) => ({ participant: e.participant, percentage: 0, amount: 0, amountPaisa: 0n })),
      totalPercentage: 0,
      remainingPercentage: 100,
      isValid: false,
      errorMessage,
    };
  }

  // Calculate provisional paisa shares
  let allocatedPaisa = 0n;
  const provisional = parsed.map((item) => {
    const sharePaisa = (totalPaisa * BigInt(item.bps)) / BigInt(BASIS_POINTS_TOTAL);
    allocatedPaisa += sharePaisa;
    return { ...item, amountPaisa: sharePaisa };
  });

  // Reconcile remaining rounding paisa to participants with highest fractional remainder
  let remainderPaisa = totalPaisa - allocatedPaisa;
  if (isValid && remainderPaisa > 0n) {
    const sortedIndices = parsed
      .map((item, idx) => ({ idx, frac: (Number(totalPaisa) * item.bps) % BASIS_POINTS_TOTAL }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < sortedIndices.length && remainderPaisa > 0n; i++) {
      provisional[sortedIndices[i].idx].amountPaisa += 1n;
      remainderPaisa -= 1n;
    }
  }

  return {
    rows: provisional.map((p) => ({
      participant: p.participant,
      percentage: p.pct,
      amount: fromPaisa(p.amountPaisa),
      amountPaisa: p.amountPaisa,
    })),
    totalPercentage,
    remainingPercentage,
    isValid,
    errorMessage,
  };
}

/**
 * Calculate Custom Split
 * @param {number} totalAmount - Total bill in rupees
 * @param {Array<{ participant: any, amount: number|string }>} entries
 * @returns {{
 *   rows: Array<{ participant: any, amount: number, amountPaisa: bigint }>,
 *   totalAllocated: number,
 *   remainingAmount: number,
 *   isExact: boolean,
 *   errorMessage: string|null
 * }}
 */
export function calculateCustomSplit(totalAmount, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { rows: [], totalAllocated: 0, remainingAmount: totalAmount, isExact: false, errorMessage: 'At least one participant required' };
  }

  const totalPaisa = toPaisa(totalAmount);
  let allocatedPaisa = 0n;

  const rows = entries.map((entry) => {
    const p = toPaisa(entry.amount);
    allocatedPaisa += p;
    return {
      participant: entry.participant,
      amount: fromPaisa(p),
      amountPaisa: p,
    };
  });

  const remainingPaisa = totalPaisa - allocatedPaisa;
  const totalAllocated = fromPaisa(allocatedPaisa);
  const remainingAmount = fromPaisa(remainingPaisa);
  const isExact = remainingPaisa === 0n;

  let errorMessage = null;
  if (remainingPaisa > 0n) {
    errorMessage = `रु ${remainingAmount.toFixed(2)} remaining to allocate`;
  } else if (remainingPaisa < 0n) {
    errorMessage = `Overallocated by रु ${Math.abs(remainingAmount).toFixed(2)}`;
  }

  return {
    rows,
    totalAllocated,
    remainingAmount,
    isExact,
    errorMessage,
  };
}

/**
 * Calculate Item-based Split
 * @param {Array<{ name: string, price: number, quantity?: number, assigned: Array<string|object> }>} items
 * @param {Array<object>} participants
 * @param {object} [charges]
 * @param {number} [charges.tax=0]
 * @param {number} [charges.serviceCharge=0]
 * @param {number} [charges.discount=0]
 * @returns {{
 *   rows: Array<{ participant: any, subtotal: number, share: number, amountPaisa: bigint, assignedItems: Array<any> }>,
 *   subtotal: number,
 *   finalTotal: number,
 *   unassignedItems: Array<any>
 * }}
 */
export function calculateItemSplit(items = [], participants = [], charges = {}) {
  const taxPaisa = toPaisa(charges.tax || 0);
  const serviceChargePaisa = toPaisa(charges.serviceCharge || 0);
  const discountPaisa = toPaisa(charges.discount || 0);

  // Initialize participant buckets
  const participantMap = new Map();
  participants.forEach((p) => {
    const id = String(p._id || p.id || p);
    participantMap.set(id, {
      participant: p,
      subtotalPaisa: 0n,
      assignedItems: [],
    });
  });

  const unassignedItems = [];
  let calculatedSubtotalPaisa = 0n;

  // Distribute each item
  items.forEach((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemTotalPaisa = toPaisa(item.price);
    calculatedSubtotalPaisa += itemTotalPaisa;

    const assigned = Array.isArray(item.assigned) ? item.assigned : [];
    if (assigned.length === 0) {
      unassignedItems.push(item);
      return;
    }

    // Allocate item equally among assigned participants
    const portions = allocateEvenly(itemTotalPaisa, assigned.length);
    assigned.forEach((assignedPerson, idx) => {
      const pid = String(assignedPerson._id || assignedPerson.id || assignedPerson);
      const bucket = participantMap.get(pid);
      if (bucket) {
        bucket.subtotalPaisa += portions[idx];
        bucket.assignedItems.push({
          name: item.name,
          shareAmount: fromPaisa(portions[idx]),
          quantity: qty,
        });
      }
    });
  });

  // Extra charges net adjustment: (tax + serviceCharge - discount)
  const netAdjustmentPaisa = taxPaisa + serviceChargePaisa - discountPaisa;
  const finalTotalPaisa = calculatedSubtotalPaisa + netAdjustmentPaisa;

  // Allocate net adjustments proportionally to participant subtotals
  let allocatedFinalPaisa = 0n;
  const rows = Array.from(participantMap.values()).map((bucket) => {
    let finalSharePaisa = bucket.subtotalPaisa;
    if (calculatedSubtotalPaisa > 0n && netAdjustmentPaisa !== 0n) {
      const adjustment = (netAdjustmentPaisa * bucket.subtotalPaisa) / calculatedSubtotalPaisa;
      finalSharePaisa = bucket.subtotalPaisa + adjustment;
    }
    allocatedFinalPaisa += finalSharePaisa;
    return {
      participant: bucket.participant,
      subtotal: fromPaisa(bucket.subtotalPaisa),
      share: fromPaisa(finalSharePaisa),
      amountPaisa: finalSharePaisa,
      assignedItems: bucket.assignedItems,
    };
  });

  // Reconcile any rounding difference in final total
  let remainderPaisa = finalTotalPaisa - allocatedFinalPaisa;
  if (remainderPaisa !== 0n && rows.length > 0) {
    const step = remainderPaisa > 0n ? 1n : -1n;
    for (let i = 0; i < rows.length && remainderPaisa !== 0n; i++) {
      rows[i].amountPaisa += step;
      rows[i].share = fromPaisa(rows[i].amountPaisa);
      remainderPaisa -= step;
    }
  }

  return {
    rows,
    subtotal: fromPaisa(calculatedSubtotalPaisa),
    finalTotal: fromPaisa(finalTotalPaisa),
    unassignedItems,
  };
}

/**
 * Asserts financial invariant: sum of participant obligations must equal bill total.
 * @param {number|bigint} totalAmount
 * @param {Array<{ amount?: number, amountPaisa?: bigint }>} rows
 * @returns {boolean}
 */
export function assertReconciled(totalAmount, rows) {
  const expectedPaisa = toPaisa(totalAmount);
  const sumPaisa = rows.reduce((sum, r) => sum + (r.amountPaisa !== undefined ? r.amountPaisa : toPaisa(r.amount)), 0n);
  return expectedPaisa === sumPaisa;
}
