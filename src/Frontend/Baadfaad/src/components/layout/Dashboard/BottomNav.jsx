/**
 * @fileoverview Mobile Bottom Navigation Bar
 * @description Native-feeling bottom tab bar for mobile viewports (< 768px).
 *              Provides one-handed thumb-friendly access to core product destinations:
 *              - Home (/dashboard)
 *              - Split (/split/create) with prominent center action
 *              - Groups (/group)
 *              - More (opens mobile bottom sheet with Profile, About, Contact, Logout)
 *              Complies with:
 *              - 48px minimum touch targets
 *              - iOS safe area insets: pb-[max(0.5rem,env(safe-area-inset-bottom))]
 *              - Active route detection and accessible aria-labels
 *
 * @module components/layout/Dashboard/BottomNav
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { FaHome, FaPlus, FaUsers, FaEllipsisH } from "react-icons/fa";

export default function BottomNav({ onOpenMore }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      aria-label="Mobile navigation"
    >
      <div className="flex h-15 items-center justify-around px-2">
        {/* Tab 1: Home */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 min-h-12 touch-manipulation transition-colors ${isActive
              ? "text-emerald-900 font-semibold"
              : "text-slate-700 hover:text-slate-900 font-semibold"
            }`
          }
          aria-label="Home Dashboard"
        >
          {({ isActive }) => (
            <>
              <FaHome className={`text-xl transition-transform ${isActive ? "scale-110 text-emerald-900" : "text-slate-700"}`} />
              <span className="text-[11px] mt-1 tracking-tight font-semibold">Home</span>
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-emerald-800 mt-0.5" aria-hidden="true" />
              )}
            </>
          )}
        </NavLink>

        {/* Tab 2: Split (Center Action) */}
        <NavLink
          to="/split/create"
          className="flex flex-1 flex-col items-center justify-center py-1 min-h-12 touch-manipulation group"
          aria-label="Create New Split"
        >
          {({ isActive }) => (
            <>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 shadow-sm ${isActive
                    ? "bg-emerald-900 text-white ring-2 ring-emerald-600/30"
                    : "bg-emerald-800 text-white group-hover:bg-emerald-900"
                  }`}
              >
                <FaPlus className="text-sm" />
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight font-semibold ${isActive
                    ? "text-emerald-900"
                    : "text-slate-700"
                  }`}
              >
                Split
              </span>
            </>
          )}
        </NavLink>

        {/* Tab 3: Groups */}
        <NavLink
          to="/group"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center py-1 min-h-12 touch-manipulation transition-colors ${isActive
              ? "text-emerald-900 font-semibold"
              : "text-slate-700 hover:text-slate-900 font-semibold"
            }`
          }
          aria-label="Groups"
        >
          {({ isActive }) => (
            <>
              <FaUsers className={`text-xl transition-transform ${isActive ? "scale-110 text-emerald-900" : "text-slate-700"}`} />
              <span className="text-[11px] mt-1 tracking-tight font-semibold">Groups</span>
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-emerald-800 mt-0.5" aria-hidden="true" />
              )}
            </>
          )}
        </NavLink>

        {/* Tab 4: More / Profile Sheet Trigger */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-1 flex-col items-center justify-center py-1 min-h-12 touch-manipulation text-slate-700 hover:text-slate-900 font-semibold transition-colors"
          aria-label="Open more menu and account settings"
        >
          <FaEllipsisH className="text-xl text-slate-700" />
          <span className="text-[11px] mt-1 tracking-tight font-semibold">More</span>
        </button>
      </div>
    </nav>
  );
}
