/**
 * @fileoverview Landing Page Top Navigation Bar
 * @description Floating pill-shaped navigation bar for landing/marketing pages.
 *              Renders the BaadFaad logo, nav links (Features, How It Works, About,
 *              Contact) that resolve to hash anchors or page routes depending
 *              on the current pathname, and a "Start Splitting" CTA button.
 *              Features and How It Works links use hash-based scroll on the
 *              homepage and full navigation from other pages.
 *
 * @returns {JSX.Element} Responsive header with rounded pill container
 *
 * @module components/layout/landing/Topbar
 */
import logo from "@root-assets/Logo-01.png";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";

export default function Topbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isAuthenticated = Boolean(localStorage.getItem("token"));

  const featuresHref = isHome ? "#features" : "/#features";
  const howItWorksHref = isHome ? "#how-it-works" : "/#how-it-works";
  const startSplittingTo = isAuthenticated ? "/dashboard" : "/login";

  return (
    <header className="w-full bg-white px-4 py-4 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-emerald-100 bg-zinc-100 px-4 py-3 sm:px-6 md:rounded-full">
        <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="BaadFaad logo"
            className="h-8 w-8  object-cover"
          />
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          <a
            href={featuresHref}
            className="text-sm font-semibold text-black hover:text-slate-900"
          >
            Features
          </a>
          <a
            href={howItWorksHref}
            className="text-sm font-semibold text-black hover:text-slate-900"
          >
            How It Works
          </a>
          <Link
            to="/about"
            className="text-sm font-semibold text-black hover:text-slate-900"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="text-sm font-semibold text-black hover:text-slate-900"
          >
            Contact
          </Link>
        </nav>

        <Link
          to={startSplittingTo}
          className="hidden cursor-pointer rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 md:inline-flex"
        >
          Start Splitting
        </Link>

        <button
          type="button"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-slate-700 md:hidden"
        >
          {isMenuOpen ? <FaTimes className="text-base" /> : <FaBars className="text-base" />}
        </button>
        </div>

        {isMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close menu overlay"
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/40"
            />

            <aside className="relative ml-auto h-full w-72 max-w-[85vw] bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
                  <img src={logo} alt="BaadFaad logo" className="h-8 w-8 object-cover" />
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white p-2 text-slate-700"
                >
                  <FaTimes className="text-base" />
                </button>
              </div>

              <nav className="space-y-1">
                <a
                  href={featuresHref}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
                >
                  Features
                </a>
                <a
                  href={howItWorksHref}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
                >
                  How It Works
                </a>
                <Link
                  to="/about"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
                >
                  About
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-100"
                >
                  Contact
                </Link>
              </nav>

              <Link
                to={startSplittingTo}
                onClick={() => setIsMenuOpen(false)}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Start Splitting
              </Link>
            </aside>
          </div>
        )}
      </div>
    </header>
  );
}
