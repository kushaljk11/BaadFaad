/**
 * @fileoverview Shared UI Primitives
 * @description Lightweight reusable primitives used across Dashboard, Split,
 *              Group, and Payment screens.
 *
 * @module components/common/primitives
 */

import React, { Component } from 'react';
import {
  FaExclamationTriangle,
  FaInbox,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaWifi,
} from 'react-icons/fa';

/**
 * EmptyState — shown when a list or container has no data.
 */
export function EmptyState({
  heading = 'Nothing here yet',
  description,
  action,
  icon: Icon = FaInbox,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400 shadow-2xs">
        <Icon className="text-2xl" />
      </span>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-800">{heading}</p>
        {description && <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * ErrorBanner — inline alert message.
 */
export function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2 font-medium">
        <FaExclamationTriangle className="shrink-0 text-red-500" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-end rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 sm:self-auto cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * StatusBadge — Canonical financial status indicators
 */
export function StatusBadge({ status = 'pending', className = '' }) {
  const s = String(status).toLowerCase();
  switch (s) {
    case 'paid':
    case 'settled':
    case 'finalized':
    case 'completed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 ${className}`}
        >
          <FaCheckCircle className="text-[10px]" /> Paid
        </span>
      );
    case 'partial':
    case 'partially_paid':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 ${className}`}
        >
          <FaHourglassHalf className="text-[10px]" /> Partial
        </span>
      );
    case 'failed':
    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200 ${className}`}
        >
          <FaTimesCircle className="text-[10px]" /> Failed
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-zinc-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Pending
        </span>
      );
  }
}

/**
 * ConnectionPill — Subtle real-time synchronization indicator
 */
export function ConnectionPill({ status = 'connected' }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }
  if (status === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
        Syncing...
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200">
      <span className="h-2 w-2 rounded-full bg-zinc-500" />
      Offline
    </span>
  );
}

/**
 * OfflineBanner — Notification shown when user loses internet connectivity
 */
export function OfflineBanner({ onRetry }) {
  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
      <span className="flex items-center gap-2">
        <FaWifi className="text-sm" />
        You are offline. Live splitting, bill scanning, and payments require internet.
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-900 shadow-2xs hover:bg-zinc-50 cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Contextual Skeletons
 */
export function SplitCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-zinc-200" />
          <div>
            <div className="h-4 w-28 rounded bg-zinc-200" />
            <div className="mt-1.5 h-3 w-16 rounded bg-zinc-100" />
          </div>
        </div>
        <div className="h-6 w-16 rounded-full bg-zinc-100" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
        <div className="h-3 w-20 rounded bg-zinc-100" />
        <div className="h-5 w-24 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`animate-pulse rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3 ${className}`}>
      <div className="h-5 w-1/3 rounded bg-zinc-200" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-zinc-100"
          style={{ width: `${Math.max(40, 90 - i * 15)}%` }}
        />
      ))}
    </div>
  );
}

export function BalanceCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
      <div className="h-3 w-24 rounded bg-zinc-200" />
      <div className="mt-3 h-8 w-36 rounded bg-zinc-200" />
      <div className="mt-2 h-3 w-20 rounded bg-zinc-100" />
    </div>
  );
}

export function ParticipantListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-zinc-200" />
            <div className="h-4 w-28 rounded bg-zinc-200" />
          </div>
          <div className="h-4 w-16 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

/**
 * ErrorBoundary
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || 'An unexpected error occurred') };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100 text-red-500">
            <FaExclamationTriangle className="text-2xl" />
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-800">Something went wrong</p>
            <p className="mt-1 text-sm text-slate-500">{this.state.message}</p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
