/**
 * @fileoverview Dashboard Home Page
 * @description Main authenticated dashboard showing the user's recent splits.
 *              Features:
 *              - Animated hero welcome banner with user's name
 *              - "New Split" and "Join Session" quick-action buttons
 *              - Cards for each split displaying title, status, date, and total
 *              - Settlement and Nudge action buttons per split
 *              - Empty state prompt when no splits exist
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/Dashboard/Home
 */
import { useState, useEffect } from "react";
import {
  FaBolt,
  FaCalendarAlt,
  FaEllipsisV,
  FaFileExport,
  FaPlusCircle,
  FaShoppingCart,
  FaUtensils,
  FaUsers,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import api from "../../config/config";

const ICONS = [FaUtensils, FaCalendarAlt, FaBolt, FaShoppingCart];
const ICON_BGS = ["bg-emerald-100", "bg-blue-100", "bg-emerald-100", "bg-amber-100"];

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [recentSplits, setRecentSplits] = useState([]);
  const [lastPaid, setLastPaid] = useState(null);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [prevMonthSpending, setPrevMonthSpending] = useState(0);

  useEffect(() => {
    const fetchSplits = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const userId = userData._id || userData.id;
        const url = userId ? `/splits?userId=${userId}` : "/splits";
        const res = await api.get(url);
        const splits = res.data.splits || [];

        // --- Recent Splits (top 5) ---
        const mapped = splits.slice(0, 5).map((s, i) => ({
          id: s._id || s.id || `split-${i}-${(s.name||s.sessionName||s.notes||'').replace(/\s+/g,'-')}`,
          title: s.name || s.sessionName || s.notes || s.receipt?.restaurant || `Split #${i + 1}`,
          date: new Date(s.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          members: `${s.breakdown?.length || 0} participants`,
          amount: `Rs. ${(s.totalAmount || 0).toLocaleString()}`,
          status: s.status === "finalized" ? "SETTLED" : "PENDING",
          statusStyle:
            s.status === "finalized"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700",
          icon: ICONS[i % ICONS.length],
          iconBg: ICON_BGS[i % ICON_BGS.length],
        }));
        setRecentSplits(mapped);

        // --- Last Time You Paid (most recent finalized split) ---
        const finalized = splits.filter((s) => s.status === "finalized");
        if (finalized.length > 0) {
          const last = finalized[0];
          setLastPaid({
            amount: last.totalAmount || 0,
            label: last.name || last.sessionName || last.notes || last.receipt?.restaurant || "a split",
            date: new Date(last.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          });
        }
        // If no finalized splits, lastPaid stays null → shows N/A

        // --- Monthly Spending (current month vs previous month) ---
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        let thisMonth = 0;
        let prevMonth = 0;
        for (const s of splits) {
          const d = new Date(s.createdAt);
          const amt = s.totalAmount || 0;
          if (d >= thisMonthStart) {
            thisMonth += amt;
          } else if (d >= prevMonthStart && d < thisMonthStart) {
            prevMonth += amt;
          }
        }
        setMonthlySpending(thisMonth);
        setPrevMonthSpending(prevMonth);
      } catch (err) {
        // If API fails, show empty state
      }
    };
    fetchSplits();
  }, []);

  // Calculate percentage change
  const spendingChange = prevMonthSpending > 0
    ? Math.round(((monthlySpending - prevMonthSpending) / prevMonthSpending) * 100)
    : monthlySpending > 0
      ? 100
      : 0;

  const currentMonthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 flex-1 p-6 pt-24 md:ml-56 md:p-8 md:pt-8 sm:mt-14">
        <div className="rounded-4xl bg-linear-to-r from-emerald-900 via-teal-900 to-slate-900 px-8 py-10 text-white shadow-xl">
          <h1 className="text-4xl font-bold">Start New Split</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">
            Split bills with friends in seconds. No more awkward "who owes who"
            conversations.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/split/create"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-lg font-bold text-slate-950 hover:bg-emerald-300 transition"
            >
              <FaPlusCircle />
              Create Split
            </Link>
            <Link
              to="/join-session"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-lg font-semibold text-white backdrop-blur hover:bg-white/20 transition"
            >
              <FaUsers />
              Join Split
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-4xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                    <FaShoppingCart />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Last Time You Paid
                    </p>
                    {lastPaid ? (
                      <>
                        <p className="text-2xl font-bold text-slate-900">
                          Rs. {lastPaid.amount.toLocaleString()} for {lastPaid.label}
                        </p>
                        <p className="text-sm text-slate-600">on {lastPaid.date}</p>
                      </>
                    ) : (
                      <p className="text-lg font-semibold text-slate-600">N/A</p>
                    )}
                  </div>
                </div>
                <button type="button" className="text-slate-600" aria-label="More payment details">
                  <FaEllipsisV />
                </button>
              </div>
            </section>

            <section className="rounded-4xl border border-zinc-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600">
                    Monthly Spending
                  </p>
                  <div className="mt-1 flex items-end gap-3">
                    <p className="text-3xl font-bold text-slate-900">
                      Rs. {monthlySpending.toLocaleString()}
                    </p>
                    {spendingChange !== 0 && (
                      <span
                        className={`text-sm font-bold ${
                          spendingChange > 0 ? "text-red-500" : "text-emerald-500"
                        }`}
                      >
                        {spendingChange > 0 ? "+" : ""}
                        {spendingChange}%
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  {currentMonthLabel}
                </span>
              </div>

              <div className="mt-24">
                <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </section>
          </div>

          <aside className="rounded-4xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Recent Splits</h2>
              <button type="button" className="text-sm font-bold text-emerald-800">
                View All
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {recentSplits.map((split) => {
                const Icon = split.icon;

                return (
                    <article
                      key={split.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full text-slate-700 ${split.iconBg}`}
                      >
                        <Icon className="text-sm" />
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{split.title}</p>
                        <p className="text-xs text-slate-600">{split.date}</p>
                        <p className="text-xs text-slate-600">{split.members}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{split.amount}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${split.statusStyle}`}
                      >
                        {split.status}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-100 px-5 py-3 font-bold text-slate-700"
              >
                <FaFileExport />
                Export History
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
