/**
 * @fileoverview Fast Participant Entry Component
 * @description Frictionless participant adding UI:
 *              - Fast typing + [Add] button or Enter key
 *              - Clears the field and keeps input focus for the next name
 *              - Prevents duplicate participant names with visual feedback
 *              - Renders clean participant chips below
 *
 * @module components/common/ParticipantEntry
 */

import React, { useState, useRef } from 'react';
import { FaUserPlus, FaTimes } from 'react-icons/fa';
import { getInitials, generateUniqueId } from '../../utills/helper';

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-teal-100 text-teal-800 border-teal-300',
];

/**
 * @param {object} props
 * @param {Array<{ id: string, name: string }>} props.participants
 * @param {(participants: Array<{ id: string, name: string }>) => void} props.onChange
 * @param {string} [props.placeholder='Type friend’s name and press Enter...']
 * @param {boolean} [props.disabled=false]
 */
export default function ParticipantEntry({
  participants = [],
  onChange,
  placeholder = 'Type friend’s name and press Enter...',
  disabled = false,
}) {
  const [nameInput, setNameInput] = useState('');
  const [warning, setWarning] = useState('');
  const inputRef = useRef(null);

  const handleAdd = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    // Check for duplicate names
    const isDuplicate = participants.some(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setWarning(`"${trimmed}" is already added.`);
      setTimeout(() => setWarning(''), 3000);
      return;
    }

    const newParticipant = {
      id: generateUniqueId(),
      name: trimmed,
    };

    onChange([...participants, newParticipant]);
    setNameInput('');
    setWarning('');

    // Keep input focused for rapid multi-entry
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (idToRemove) => {
    onChange(participants.filter((p) => p.id !== idToRemove));
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="w-full">
      {/* Input bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              if (warning) setWarning('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-100 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          disabled={disabled || !nameInput.trim()}
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FaUserPlus className="text-xs" />
          <span>Add</span>
        </button>
      </div>

      {warning && (
        <p className="mt-1.5 text-xs font-semibold text-amber-600" role="alert">
          {warning}
        </p>
      )}

      {/* Participant chips */}
      {participants.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.map((p, idx) => {
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <div
                key={p.id}
                className="group flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-2.5 shadow-2xs transition hover:border-zinc-300"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${colorClass}`}
                >
                  {getInitials(p.name)}
                </span>
                <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="rounded-full p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <FaTimes className="text-[10px]" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
