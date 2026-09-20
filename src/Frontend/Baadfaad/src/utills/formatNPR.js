/**
 * @fileoverview Currency Formatting Utility
 * @description Provides a single canonical NPR formatting function used
 *              across all pages so that money display is consistent.
 *              Canonical display format: "रु 1,250.00"
 *
 * @module utills/formatNPR
 */

/**
 * Format a numeric value as a localized Nepali Rupee amount.
 *
 * @param {number|null|undefined} value - Amount in NPR (rupees, not paisa).
 * @param {object} [opts]
 * @param {boolean} [opts.showSymbol=true] - Prefix result with currency symbol ("रु ").
 * @param {string} [opts.symbol='रु'] - Currency symbol to display.
 * @param {number} [opts.decimals=2] - Number of fractional digits.
 * @returns {string}
 */
export function formatNPR(value, { showSymbol = true, symbol = 'रु', decimals = 2 } = {}) {
  const num = Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatted = num.toLocaleString('en-NP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showSymbol ? `${symbol}\u00a0${formatted}` : formatted;
}

/**
 * Compact variant: "रु 1,200" without decimals for summary cards / headings.
 *
 * @param {number|null|undefined} value
 * @param {object} [opts]
 * @param {string} [opts.symbol='रु']
 * @returns {string}
 */
export function formatNPRCompact(value, { symbol = 'रु' } = {}) {
  return formatNPR(value, { decimals: 0, symbol });
}

export default formatNPR;
