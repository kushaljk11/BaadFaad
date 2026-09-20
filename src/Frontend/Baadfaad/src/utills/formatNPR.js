/**
 * @fileoverview Currency Formatting Utility
 * @description Provides a single canonical NPR formatting function used
 *              across all pages so that money display is consistent.
 *              All amounts are assumed to be in NPR (Nepalese Rupees).
 *
 * @module utills/formatNPR
 */

/**
 * Format a numeric value as a localized NPR amount.
 *
 * @param {number|null|undefined} value - Amount in NPR (not paisa).
 * @param {object} [opts]
 * @param {boolean} [opts.showSymbol=true] - Prefix result with "NPR ".
 * @param {number} [opts.decimals=2] - Number of fractional digits.
 * @returns {string}
 */
export function formatNPR(value, { showSymbol = true, decimals = 2 } = {}) {
  const num = Number.isFinite(value) ? value : 0;
  const formatted = num.toLocaleString('en-NP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showSymbol ? `NPR\u00a0${formatted}` : formatted;
}

/**
 * Compact variant: "NPR 1,200" without decimals for summary headings.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatNPRCompact(value) {
  return formatNPR(value, { decimals: 0 });
}
