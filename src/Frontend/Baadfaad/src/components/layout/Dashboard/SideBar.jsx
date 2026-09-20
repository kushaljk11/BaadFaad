/**
 * @fileoverview Desktop Dashboard Sidebar Navigation
 * @description Fixed left sidebar strictly rendered on desktop viewports (>= 768px).
 *              Mobile viewports use the lightweight BottomNav instead.
 *              Features:
 *              - Main links: Home, Create Split, Groups
 *              - General links: About, Contact
 *              - Clean active states with font-semibold and emerald accents
 *
 * @module components/layout/Dashboard/SideBar
 */

import React from "react";
import {
  FaHome,
  FaPlusCircle,
  FaUsers,
  FaInfoCircle,
  FaEnvelope,
} from "react-icons/fa";
import { NavLink } from "react-router-dom";

const mainNav = [
  { label: "Home", icon: FaHome, to: "/dashboard" },
  { label: "Create Split", icon: FaPlusCircle, to: "/split/create" },
  { label: "Groups", icon: FaUsers, to: "/group" },
];

const secondaryNav = [
  { label: "About", icon: FaInfoCircle, to: "/about" },
  { label: "Contact", icon: FaEnvelope, to: "/contact" },
];

export default function SideBar({ disableInteraction = false }) {
  return (
    <aside
      className={`hidden md:flex fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-58 flex-col border-r border-zinc-200 bg-white transition-opacity ${
        disableInteraction ? "pointer-events-none opacity-60" : ""
      }`}
      style={disableInteraction ? { pointerEvents: "none", opacity: 0.6 } : {}}
      aria-label="Desktop sidebar navigation"
    >
      {/* Navigation Menu */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {/* Main Navigation */}
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Main
            </p>
            <nav className="space-y-1">
              {mainNav.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-50 font-semibold text-emerald-800"
                        : "font-medium text-slate-600 hover:bg-zinc-100 hover:text-slate-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`text-base ${
                          isActive ? "text-emerald-700" : "text-slate-500"
                        }`}
                      />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Secondary Navigation */}
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              General
            </p>
            <nav className="space-y-1">
              {secondaryNav.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-50 font-semibold text-emerald-800"
                        : "font-medium text-slate-600 hover:bg-zinc-100 hover:text-slate-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`text-base ${
                          isActive ? "text-emerald-700" : "text-slate-500"
                        }`}
                      />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Minimal Brand / Security Footer */}
        <div className="border-t border-zinc-100 px-3 pt-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">BaadFaad</span>
            <span className="text-[11px]">v1.2</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Fast & safe bill splitting</p>
        </div>
      </div>
    </aside>
  );
}
