/**
 * @fileoverview Mobile More / Profile Bottom Sheet
 * @description Native-feeling bottom sheet modal triggered from the mobile bottom nav
 *              or mobile top bar avatar. Houses secondary destinations (About, Contact)
 *              and account options (User info, Sign out) without cluttering primary nav.
 *
 * @module components/layout/Dashboard/MoreSheet
 */

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaTimes,
  FaSignOutAlt,
  FaInfoCircle,
  FaEnvelope,
  FaShieldAlt,
} from "react-icons/fa";
import { useAuth } from "../../../context/authState";

export default function MoreSheet({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/");
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        aria-hidden="true"
      />

      {/* Sheet Modal */}
      <div
        className="relative z-10 w-full rounded-t-3xl border-t border-zinc-200 bg-white p-5 shadow-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-transform animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Account and more options"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-300" aria-hidden="true" />

        {/* Header with User Info & Close */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-900 shadow-xs">
              {initial}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || "BaadFaad User"}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {user?.email || "Guest Session"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-slate-500 hover:bg-zinc-200 hover:text-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="py-3 space-y-1">
          <Link
            to="/about"
            onClick={onClose}
            className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-700 hover:bg-zinc-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-slate-600">
              <FaInfoCircle className="text-sm" />
            </div>
            <span>About BaadFaad</span>
          </Link>

          <Link
            to="/contact"
            onClick={onClose}
            className="flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-700 hover:bg-zinc-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-slate-600">
              <FaEnvelope className="text-sm" />
            </div>
            <span>Contact & Support</span>
          </Link>
        </div>

        {/* Security & Sign Out Footer */}
        <div className="border-t border-zinc-100 pt-3 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/50 py-3 text-xs font-semibold text-red-600 hover:bg-red-100/70 transition-colors cursor-pointer"
          >
            <FaSignOutAlt className="text-xs" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-400">
            <FaShieldAlt className="text-[10px] text-emerald-600" />
            <span>Safe & deterministic financial calculation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
