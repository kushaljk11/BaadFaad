/**
 * @fileoverview Dashboard Shell Layout
 * @description Mobile-first shell wrapping all authenticated app pages.
 *              - Desktop (>= 768px): Fixed TopBar + Fixed Left SideBar.
 *              - Mobile (< 768px): Compact TopBar + Sticky BottomNav + Native MoreSheet.
 *              - Subflows: Hides BottomNav to give maximum focus and screen real estate
 *                for sticky bottom CTAs and numeric inputs.
 *
 * @module components/layout/Dashboard/DashboardShell
 */

import React, { useState } from "react";
import SideBar from "./SideBar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import MoreSheet from "./MoreSheet";

export default function DashboardShell({
  children,
  title,
  backTo,
  onBack,
  hideBottomNav = false,
  mainClassName = "",
  disableSidebarInteraction = false,
}) {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 overflow-x-hidden w-full text-slate-900 flex flex-col">
      {/* Mobile & Desktop Top Bar */}
      <TopBar
        title={title}
        backTo={backTo}
        onBack={onBack}
        onOpenMore={() => setIsMoreSheetOpen(true)}
      />

      {/* Desktop Left Sidebar (hidden on mobile) */}
      <SideBar disableInteraction={disableSidebarInteraction} />

      {/* Mobile More / Profile Bottom Sheet */}
      <MoreSheet
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
      />

      {/* Main Content Area */}
      <main
        className={`pt-14 md:pl-58 min-h-screen overflow-x-hidden flex-1 ${
          hideBottomNav ? "pb-8" : "pb-20 md:pb-8"
        } ${mainClassName}`}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation (hidden in focused subflows and on desktop) */}
      {!hideBottomNav && (
        <BottomNav onOpenMore={() => setIsMoreSheetOpen(true)} />
      )}
    </div>
  );
}
