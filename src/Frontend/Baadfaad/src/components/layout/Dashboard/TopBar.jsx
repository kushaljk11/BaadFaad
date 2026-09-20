/**
 * @fileoverview Dashboard Top Bar / Header
 * @description Fixed top navigation bar for the authenticated dashboard.
 *              Displays the BaadFaad logo, user profile (avatar + name + email),
 *              a logout button (desktop), and a hamburger/close toggle for the
 *              mobile sidebar. Uses the `useAuth` hook for user data and logout.
 *
 * @param {Object} props
 * @param {Function} props.onMenuToggle - Callback to toggle the mobile sidebar
 * @param {boolean}  props.isOpen       - Current sidebar open state (for icon toggle)
 * @returns {JSX.Element} Fixed header with branding, user info, and menu controls
 *
 * @module components/layout/Dashboard/TopBar
 */
import { FaBars, FaTimes, FaSignOutAlt } from "react-icons/fa";
import logo from "@root-assets/Logo-01.png";
import { useAuth } from "../../../context/authState";
import { useNavigate } from "react-router-dom";

export default function TopBar({ onMenuToggle, isOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="BaadFaad logo"
            className="h-10 w-10 object-cover"
          />
          <span className="text-xl font-bold text-slate-900">BaadFaad</span>
        </div>

        {/* Right Side: User Details & Logout */}
        <div className="flex items-center gap-3">
          {/* User Profile (Desktop) */}
          {user && (
            <div className="hidden md:flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 text-left flex flex-col justify-center">
                <div className="text-sm font-semibold text-slate-800 leading-5 truncate">
                  {user.name || 'User'}
                </div>
                <span className="text-xs text-slate-500 leading-4 truncate max-w-37.5">
                  {user.email || 'user@example.com'}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-800 text-white hover:bg-red-600 transition-colors shadow-md"
                aria-label="Logout"
                title="Logout"
              >
                <FaSignOutAlt className="text-sm" />
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuToggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 md:hidden"
            aria-label="Toggle menu"
          >
            {isOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
          </button>
        </div>
      </div>
    </header>
  );
}
