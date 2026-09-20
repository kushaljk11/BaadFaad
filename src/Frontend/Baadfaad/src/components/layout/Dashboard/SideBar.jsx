/**
 * @fileoverview Dashboard Sidebar Navigation
 * @description Responsive sidebar component for the authenticated dashboard.
 *              Features:
 *              - Nav links (Home, Create Split, Group, About, Contact) with active-state highlighting
 *              - Mobile: slides in from right with backdrop overlay
 *              - Desktop: fixed left sidebar always visible
 *              - Premium upgrade CTA card at the bottom
 *              Uses react-router-dom NavLink for active route detection.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen  - Controls mobile sidebar visibility
 * @param {Function} props.onClose - Callback to close the sidebar (mobile)
 * @returns {JSX.Element} Sidebar navigation with menu items and premium card
 *
 * @module components/layout/Dashboard/SideBar
 */
import {
  FaCog,
  FaHistory,
  FaThLarge,
  FaUserFriends,
  FaUsers,
  FaCrown,
  FaChevronRight,
} from "react-icons/fa";
import { NavLink } from "react-router-dom";

const menuItems = [
  { label: "Home", icon: FaThLarge, to: "/dashboard" },
  { label: "Create Split", icon: FaHistory, to: "/split/create" },
  { label: "Group", icon: FaUserFriends, to: "/group" },
  { label: "About", icon: FaUsers, to: "/about" },
  { label: "Contact", icon: FaCog, to: "/contact" },
];

export default function SideBar({ isOpen, onClose, disableInteraction = false }) {
  return (
    <>
      {/* Backdrop/Overlay (Mobile) */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 top-16 z-30 bg-slate-900/60 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 z-40 flex h-[calc(100vh-4rem)] w-56 flex-col border-zinc-200 bg-linear-to-b from-white to-zinc-50 shadow-2xl transition-transform duration-300 md:left-0 md:border-r md:translate-x-0 ${
          isOpen
            ? "right-0 translate-x-0 border-l"
            : "right-0 translate-x-full md:translate-x-0"
        } ${disableInteraction ? "pointer-events-none opacity-60" : ""}`}
        style={disableInteraction ? { pointerEvents: 'none', opacity: 0.6 } : {}}
      >
        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {menuItems.map(({ label, icon: Icon, to }, index) => (
            <div key={label}>
              {index > 0 && (
                <hr className="my-1 border-zinc-200" />
              )}
              <NavLink
              key={label}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-linear-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]"
                    : "text-slate-600 hover:bg-white hover:text-emerald-600 hover:shadow-md hover:scale-[1.01]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`text-lg transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`}
                    />
                    <span>{label}</span>
                  </div>
                  <FaChevronRight
                    className={`text-xs transition-all duration-200 ${
                      isActive
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2 group-hover:opacity-60 group-hover:translate-x-0"
                    }`}
                  />
                </>
              )}
            </NavLink>
            </div>
          ))}
        </nav>

        {/* Premium Upgrade Card */}
        <div className="px-4 pb-6">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 via-emerald-600 to-teal-600 p-5 shadow-xl">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <FaCrown className="text-yellow-300 text-lg" />
                <p className="text-xs font-bold tracking-wide text-emerald-50">
                  PREMIUM ACCOUNT
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/95 font-medium">
                Upgrade for unlimited split groups and premium features.
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                UPGRADE NOW
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
