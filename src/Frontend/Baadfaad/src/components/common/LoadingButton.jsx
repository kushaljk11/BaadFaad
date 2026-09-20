/**
 * @fileoverview Standardized Button System & Double-Submission Prevention
 * @description Provides a consistent button component across all BaadFaad screens.
 *              Guarantees:
 *              - Prevents double-clicking during pending asynchronous actions
 *              - Accessible focus, hover, active, and disabled states
 *              - Shows inline spinner and loading text during submission
 *
 * @module components/common/LoadingButton
 */

import React from 'react';
import { FaSpinner } from 'react-icons/fa';

const VARIANTS = {
  primary:
    'bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 active:bg-emerald-600 focus-visible:ring-emerald-400 shadow-sm',
  secondary:
    'bg-slate-900 text-white font-semibold hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-700 shadow-sm',
  outline:
    'border border-zinc-300 bg-white text-slate-700 font-semibold hover:bg-zinc-50 active:bg-zinc-100 focus-visible:ring-zinc-400',
  ghost:
    'bg-transparent text-slate-600 font-medium hover:bg-zinc-100 active:bg-zinc-200 focus-visible:ring-zinc-400',
  danger:
    'bg-red-600 text-white font-semibold hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-400 shadow-sm',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-xl min-h-[36px]',
  md: 'px-5 py-2.5 text-sm rounded-2xl min-h-[44px]',
  lg: 'px-6 py-3.5 text-base rounded-2xl min-h-[52px]',
};

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {string} [props.loadingText]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} [props.icon]
 * @param {boolean} [props.fullWidth=false]
 * @param {string} [props.className]
 * @param {() => void} [props.onClick]
 * @param {'button'|'submit'|'reset'} [props.type='button']
 * @param {React.ReactNode} props.children
 */
export default function LoadingButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  disabled = false,
  icon,
  fullWidth = false,
  className = '',
  onClick,
  type = 'button',
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  const handleClick = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2.5 transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        VARIANTS[variant] || VARIANTS.primary
      } ${SIZES[size] || SIZES.md} ${fullWidth ? 'w-full' : ''} ${
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-[0.98]'
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <FaSpinner className="animate-spin text-current" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
