/**
 * @fileoverview Dashboard Top Bar / Header
 * @description Mobile-first compact top header (54px) for the authenticated dashboard.
 *              Displays:
 *              - Left: Back button (if inside a flow) or BaadFaad logo with title
 *              - Center/Left: Contextual flow title when in a subflow
 *              - Right: User avatar initial (opens More bottom sheet on mobile, dropdown on desktop)
 *              Complies with:
 *              - Height: 54px (h-14)
 *              - Minimum 44px touch targets
 *              - iOS safe area insets: pt-[env(safe-area-inset-top)]
 *
 * @module components/layout/Dashboard/TopBar
 */

import React, { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaUser, FaSignOutAlt, FaChevronLeft } from "react-icons/fa";
import logo from "@root-assets/Logo-01.png";
import { useAuth } from "../../../context/authState";
import { useNavigate, Link } from "react-router-dom";

export default function TopBar({
  title,
  backTo,
  onBack,
  onOpenMore,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close desktop dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate("/");
  };

  const handleAvatarClick = () => {
    // If mobile and onOpenMore provided, trigger bottom sheet
    if (window.innerWidth < 768 && onOpenMore) {
      onOpenMore();
    } else {
      setDropdownOpen((prev) => !prev);
    }
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";
  const hasBack = Boolean(backTo || onBack);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-14 border-b border-zinc-200 bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="flex h-full items-center justify-between px-3 sm:px-6">
        {/* Left Side: Back button OR Brand Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          {hasBack ? (
            <button
              type="button"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else if (backTo) {
                  navigate(backTo);
                } else {
                  navigate(-1);
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-zinc-100 hover:text-slate-900 transition-colors cursor-pointer active:scale-95"
              aria-label="Go back"
            >
              <FaChevronLeft className="text-sm" />
            </button>
          ) : null}

          {/* If title is present in a subflow, display title; otherwise brand logo */}
          {title ? (
            <div className="min-w-0">
              <span className="text-base font-semibold tracking-tight text-slate-900 truncate block">
                {title}
              </span>
            </div>
          ) : (
            <Link to="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-90">
              <img
                src={logo}
                alt="BaadFaad logo"
                className="h-7 w-7 object-contain"
              />
              <span className="text-base font-semibold tracking-tight text-slate-900">
                BaadFaad
              </span>
            </Link>
          )}
        </div>

        {/* Right Side: Profile Avatar / Dropdown */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="flex items-center gap-2 rounded-xl p-1 sm:p-1.5 transition-colors hover:bg-zinc-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-11"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-900 shadow-2xs">
                  {initial}
                </div>
                <span className="hidden text-xs font-semibold text-slate-700 sm:inline max-w-32 truncate">
                  {user.name || "User"}
                </span>
                <FaChevronDown
                  className={`hidden text-[9px] text-slate-500 transition-transform sm:inline ${dropdownOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Desktop Profile Dropdown */}
              {dropdownOpen && (
                <div className="hidden md:block absolute right-0 mt-1.5 w-56 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50">
                  <div className="px-3 py-2.5 border-b border-zinc-100">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {user.name || "User"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user.email || ""}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-zinc-100 transition-colors"
                    >
                      <FaUser className="text-slate-400 text-xs" />
                      Dashboard
                    </Link>
                  </div>

                  <div className="border-t border-zinc-100 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <FaSignOutAlt className="text-red-500 text-xs" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
