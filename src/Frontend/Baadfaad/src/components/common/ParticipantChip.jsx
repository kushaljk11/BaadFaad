/**
 * @fileoverview Participant Chip Component
 * @description Accessible chip for participant selection in item-based and custom splits.
 *              - Large touch target (>=44px min-height) for mobile ease
 *              - Shows initials avatar, name, and optional amount owed
 *              - Clear active / selected state with high contrast
 *
 * @module components/common/ParticipantChip
 */

import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { getInitials } from '../../utills/helper';
import { formatNPR } from '../../utills/formatNPR';

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800',
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
];

/**
 * @param {object} props
 * @param {string} props.name
 * @param {number} [props.amount] - Amount owed in NPR
 * @param {boolean} [props.selected=false]
 * @param {number} [props.index=0] - For color selection
 * @param {() => void} [props.onClick]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className]
 */
export default function ParticipantChip({
  name,
  amount,
  selected = false,
  index = 0,
  onClick,
  disabled = false,
  className = '',
}) {
  const colorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all select-none min-h-11 ${selected
          ? 'border-emerald-500 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-200'
          : 'border-zinc-200 bg-white hover:border-zinc-300 active:bg-zinc-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${selected ? 'bg-emerald-500 text-white' : colorClass
          }`}
      >
        {selected ? <FaCheck className="text-[10px]" /> : getInitials(name)}
      </span>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-800 leading-tight">{name}</span>
        {amount !== undefined && (
          <span className="text-[11px] font-semibold text-emerald-700">
            {formatNPR(amount)}
          </span>
        )}
      </div>
    </button>
  );
}
