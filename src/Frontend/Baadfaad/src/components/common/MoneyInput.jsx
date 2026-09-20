/**
 * @fileoverview Mobile-Optimized Money Input Component
 * @description Standardized input field for financial values in BaadFaad.
 *              - Opens the mobile decimal keyboard via inputMode="decimal"
 *              - Sanitizes invalid keystrokes (no negative values, no multiple dots)
 *              - Validates on blur and displays progressive error feedback
 *              - Displays canonical "रु" currency prefix
 *
 * @module components/common/MoneyInput
 */

import React, { useState, useId } from 'react';

/**
 * @param {object} props
 * @param {string} [props.id]
 * @param {string} [props.label]
 * @param {number|string} props.value
 * @param {(val: string) => void} props.onChange
 * @param {string} [props.placeholder='0.00']
 * @param {string} [props.error]
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.required=false]
 * @param {string} [props.helperText]
 * @param {string} [props.className]
 * @param {(val: number) => string|null} [props.validate] - Custom validator on blur
 */
export default function MoneyInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0.00',
  error: externalError,
  disabled = false,
  required = false,
  helperText,
  className = '',
  validate,
}) {
  const [internalError, setInternalError] = useState('');
  const [touched, setTouched] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const displayError = externalError || (touched ? internalError : '');

  const handleRawChange = (e) => {
    let raw = e.target.value;
    // Allow digits and a single decimal dot only
    raw = raw.replace(/[^\d.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      raw = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    if (internalError) setInternalError('');
    onChange(raw);
  };

  const handleBlur = () => {
    setTouched(true);
    const num = Number(value);
    if (required && (!value || num <= 0)) {
      setInternalError('Enter an amount greater than रु 0');
      return;
    }
    if (validate) {
      const err = validate(num);
      setInternalError(err || '');
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className={`relative flex items-center rounded-2xl border transition-all ${
          displayError
            ? 'border-red-400 bg-red-50/30 ring-2 ring-red-100'
            : disabled
            ? 'border-zinc-200 bg-zinc-100 opacity-70'
            : 'border-zinc-300 bg-white focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-100 hover:border-zinc-400'
        }`}
      >
        <span className="pointer-events-none select-none pl-3.5 pr-2 text-sm font-bold text-slate-500">
          रु
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.]?[0-9]*"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={handleRawChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full rounded-2xl bg-transparent py-3 pr-3.5 text-base font-semibold text-slate-900 placeholder:text-zinc-400 focus:outline-none"
        />
      </div>
      {displayError ? (
        <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {displayError}
        </p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
