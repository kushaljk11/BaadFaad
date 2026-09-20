import { useState } from 'react';
import SideBar from './SideBar';
import TopBar from './TopBar';

export default function DashboardShell({ children, mainClassName = '', disableSidebarInteraction = false }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-zinc-100">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen((open) => !open)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} disableInteraction={disableSidebarInteraction} />
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
