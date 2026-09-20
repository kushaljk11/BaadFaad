import { allocateByBasisPoints, allocateEvenly, assertReconciled, toPaisa } from './money.js';

const TYPES = new Set(['equal', 'percentage', 'custom', 'item_based']);

export function calculateSplitRows(type, totalPaisa, entries) {
  const normalizedType = String(type || 'equal').toLowerCase();
  if (!TYPES.has(normalizedType)) throw new TypeError('Unsupported split type');
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError('At least one participant is required');
  const keys = entries.map((_entry, index) => String(index));

  if (normalizedType === 'equal') {
    const amounts = allocateEvenly(totalPaisa, keys);
    const percentageBase = Math.floor(10000 / entries.length);
    const percentageRemainder = 10000 % entries.length;
    return entries.map((entry, index) => ({
      entry,
      amountPaisa: amounts[index].amountPaisa,
      percentageBps: percentageBase + (index < percentageRemainder ? 1 : 0),
    }));
  }

  if (normalizedType === 'percentage') {
    const percentages = entries.map((entry, index) => {
      const percentageBps = Math.round(Number(entry.percentage) * 100);
      if (!Number.isInteger(percentageBps) || percentageBps < 0) throw new TypeError(`Invalid percentage at participant ${index}`);
      return { key: keys[index], basisPoints: percentageBps };
    });
    const amounts = allocateByBasisPoints(totalPaisa, percentages);
    return entries.map((entry, index) => ({ entry, amountPaisa: amounts[index].amountPaisa, percentageBps: percentages[index].basisPoints }));
  }

  const amounts = entries.map((entry, index) => {
    if (normalizedType === 'custom') return toPaisa(entry.amount);
    if (!Array.isArray(entry.items) || entry.items.length === 0) throw new TypeError(`Items are required at participant ${index}`);
    return entry.items.reduce((sum, item, itemIndex) => {
      const quantity = Number(item?.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new TypeError(`Invalid item quantity at participant ${index}, item ${itemIndex}`);
      const amount = item?.amount ?? item?.totalPrice ?? Number(item?.itemPrice ?? item?.price) * quantity;
      return sum + toPaisa(amount);
    }, 0n);
  });
  assertReconciled(totalPaisa, amounts.map((amountPaisa, index) => ({ key: keys[index], amountPaisa })));
  return entries.map((entry, index) => ({
    entry,
    amountPaisa: amounts[index],
    percentageBps: totalPaisa === 0n ? 0 : Number((amounts[index] * 10000n + totalPaisa / 2n) / totalPaisa),
  }));
}
