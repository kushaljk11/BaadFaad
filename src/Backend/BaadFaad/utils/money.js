const PAISA_PER_RUPEE = 100;
const BASIS_POINTS_TOTAL = 10_000;

export function toPaisa(value) {
  if (typeof value === 'bigint') return value;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || !Number.isFinite(Number(normalized))) {
    throw new TypeError('Money value must be a finite number');
  }
  const paisa = Math.round(Number(normalized) * PAISA_PER_RUPEE);
  if (!Number.isSafeInteger(paisa)) throw new RangeError('Money value exceeds the supported range');
  return BigInt(paisa);
}

export function fromPaisa(value) {
  const paisa = typeof value === 'bigint' ? value : BigInt(value);
  const absolute = paisa < 0n ? -paisa : paisa;
  const rupees = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${paisa < 0n ? '-' : ''}${rupees}.${fraction}`;
}

function assertAllocationInput(totalPaisa, keys) {
  if (typeof totalPaisa !== 'bigint' || totalPaisa < 0n) {
    throw new TypeError('totalPaisa must be a non-negative bigint');
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError('At least one allocation key is required');
  }
  if (new Set(keys.map(String)).size !== keys.length) {
    throw new TypeError('Allocation keys must be unique');
  }
}

export function allocateEvenly(totalPaisa, keys) {
  assertAllocationInput(totalPaisa, keys);
  const count = BigInt(keys.length);
  const base = totalPaisa / count;
  let remainder = totalPaisa % count;

  return keys.map((key) => {
    const amountPaisa = base + (remainder > 0n ? 1n : 0n);
    if (remainder > 0n) remainder -= 1n;
    return { key, amountPaisa };
  });
}

export function allocateByBasisPoints(totalPaisa, entries) {
  const keys = entries?.map((entry) => entry.key);
  assertAllocationInput(totalPaisa, keys);

  const totalBasisPoints = entries.reduce((sum, entry) => {
    if (!Number.isInteger(entry.basisPoints) || entry.basisPoints < 0) {
      throw new TypeError('basisPoints must be non-negative integers');
    }
    return sum + entry.basisPoints;
  }, 0);
  if (totalBasisPoints !== BASIS_POINTS_TOTAL) {
    throw new RangeError(`Percentage allocations must total ${BASIS_POINTS_TOTAL} basis points`);
  }

  const provisional = entries.map((entry, index) => {
    const numerator = totalPaisa * BigInt(entry.basisPoints);
    return {
      key: entry.key,
      index,
      amountPaisa: numerator / BigInt(BASIS_POINTS_TOTAL),
      remainder: numerator % BigInt(BASIS_POINTS_TOTAL),
    };
  });

  let unallocated = totalPaisa - provisional.reduce((sum, entry) => sum + entry.amountPaisa, 0n);
  const remainderOrder = [...provisional].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index;
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (const entry of remainderOrder) {
    if (unallocated === 0n) break;
    entry.amountPaisa += 1n;
    unallocated -= 1n;
  }

  return provisional
    .sort((a, b) => a.index - b.index)
    .map(({ key, amountPaisa }) => ({ key, amountPaisa }));
}

export function assertReconciled(totalPaisa, allocations) {
  const allocated = allocations.reduce((sum, entry) => sum + BigInt(entry.amountPaisa), 0n);
  if (allocated !== totalPaisa) {
    throw new RangeError(`Allocations do not reconcile: expected ${totalPaisa}, received ${allocated}`);
  }
  return true;
}

export const MONEY_CONSTANTS = Object.freeze({ PAISA_PER_RUPEE, BASIS_POINTS_TOTAL });
