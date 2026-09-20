/**
 * @fileoverview Shared UI Primitives
 * @description Lightweight reusable primitives used across Dashboard, Split,
 *              Group, and Payment screens. Import individually to keep chunks small.
 *
 * @module components/common/primitives
 */

import { FaExclamationTriangle, FaInbox } from 'react-icons/fa';

/** ------------------------------------------------------------------ *
 * EmptyState — shown when a paginated list has no items.               *
 * ------------------------------------------------------------------ */
/**
 * @param {object} props
 * @param {string} [props.heading]
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.action]
 */
export function EmptyState({ heading = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <FaInbox className="text-2xl" />
      </span>
      <div>
        <p className="text-base font-semibold text-slate-700">{heading}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/** ------------------------------------------------------------------ *
 * ErrorBanner — inline non-fatal error message.                       *
 * ------------------------------------------------------------------ */
/**
 * @param {object} props
 * @param {string} props.message
 * @param {() => void} [props.onRetry]
 */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <FaExclamationTriangle className="shrink-0 text-red-500" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-end rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 sm:self-auto"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** ------------------------------------------------------------------ *
 * SkeletonCard — loading placeholder for list cards.                  *
 * ------------------------------------------------------------------ */
/**
 * @param {object} props
 * @param {number} [props.lines=3] - Number of skeleton line elements.
 * @param {string} [props.className]
 */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 ${className}`}
    >
      <div className="h-4 w-1/3 rounded bg-zinc-200" />
      {Array.from({ length: Math.max(1, lines - 1) }).map((_, i) => (
        <div key={i} className="mt-2 h-3 w-full rounded bg-zinc-100" />
      ))}
    </div>
  );
}

/** ------------------------------------------------------------------ *
 * ErrorBoundary — class component; wraps lazy routes.                 *
 * ------------------------------------------------------------------ */
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || 'An unexpected error occurred') };
  }

  componentDidCatch(error, info) {
    // Log non-critical — never expose stack in production UI
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
            <FaExclamationTriangle className="text-2xl" />
          </span>
          <div>
            <p className="text-lg font-bold text-slate-800">Something went wrong</p>
            <p className="mt-1 text-sm text-slate-500">{this.state.message}</p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-900"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
