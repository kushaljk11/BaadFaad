/**
 * @fileoverview Dashboard Home Page
 * @description Consumer-facing, action-oriented dashboard for BaadFaad.
 *              Key Features:
 *              - Primary action CTA: "Split a Bill"
 *              - Clear, unambiguous balance cards: "You Owe" vs "You are Owed"
 *              - Recent splits with canonical रु currency and StatusBadge
 *              - Contextual skeletons and polished empty states
 *
 * @module pages/Dashboard/Home
 */

import React, { useState, useEffect } from "react";
import {
  FaReceipt,
  FaQrcode,
  FaUserFriends,
  FaArrowRight,
  FaHandHoldingUsd,
  FaMoneyCheckAlt,
  FaFileExport,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import api from "../../config/config";
import { formatNPR } from "../../utills/formatNPR";
import {
  StatusBadge,
  EmptyState,
  SplitCardSkeleton,
  BalanceCardSkeleton,
} from "../../components/common/primitives";
import { useAuth } from "../../context/authState";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentSplits, setRecentSplits] = useState([]);
  const [youOwe, setYouOwe] = useState(0);
  const [youAreOwed, setYouAreOwed] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const userId = userData._id || userData.id;
        const url = userId ? `/splits?userId=${userId}` : "/splits";
        const res = await api.get(url);
        const splits = res.data.splits || [];

        // Compute balances: You Owe vs You Are Owed
        let totalOwed = 0;
        let totalDueToMe = 0;

        splits.forEach((s) => {
          const breakdown = s.breakdown || [];
          const isCreator = String(s.createdBy?._id || s.createdBy) === String(userId);

          breakdown.forEach((entry) => {
            const entryUserId = String(entry.user?._id || entry.user || entry._id);
            const share = Number(entry.amount || 0);
            const paid = Number(entry.amountPaid || 0);
            const diff = share - paid;

            if (entryUserId === String(userId)) {
              if (diff > 0) totalOwed += diff;
            } else if (isCreator) {
              if (diff > 0) totalDueToMe += diff;
            }
          });
        });

        setYouOwe(totalOwed);
        setYouAreOwed(totalDueToMe);
        setRecentSplits(splits.slice(0, 8));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const userName = user?.name?.split(" ")[0] || "Friend";

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="ml-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Welcome & Primary Action Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm sm:p-8">
            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                  Start New Split
                </h2>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">
                  Namaste, {userName}!
                </h1>
                <p className="mt-1 text-sm text-slate-300 sm:text-base">
                  Ready to split a meal or settlement? It takes under 30 seconds.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/split/create")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-95 shadow-md cursor-pointer"
                >
                  <FaReceipt className="text-base" />
                  <span>Split a Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/join-session")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95 cursor-pointer"
                >
                  <FaQrcode className="text-base" />
                  <span>Join with QR</span>
                </button>
              </div>
            </div>
          </section>

          {/* Unambiguous Financial Balance Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {loading ? (
              <>
                <BalanceCardSkeleton />
                <BalanceCardSkeleton />
              </>
            ) : (
              <>
                {/* You Owe Card */}
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Total You Owe
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                      <FaMoneyCheckAlt className="text-sm" />
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-black text-slate-900 tracking-tight">
                    {formatNPR(youOwe)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {youOwe > 0
                      ? "Pending payments for shared expenses"
                      : "You have no outstanding dues!"}
                  </p>
                </div>

                {/* You Are Owed Card */}
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      You are Owed
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <FaHandHoldingUsd className="text-sm" />
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-black text-emerald-600 tracking-tight">
                    {formatNPR(youAreOwed)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {youAreOwed > 0
                      ? "Friends owe you for bills you covered"
                      : "All group members are settled up!"}
                  </p>
                </div>
              </>
            )}
          </section>

          {/* Quick Actions Bar */}
          <section className="flex flex-wrap items-center gap-3">
            <Link
              to="/group"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-zinc-50"
            >
              <FaUserFriends className="text-emerald-500" />
              <span>Manage Groups</span>
            </Link>
          </section>

          {/* Recent Splits List */}
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent Splits</h2>
                <p className="text-xs text-slate-500">Track and settle ongoing bills</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/split/create")}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-900 cursor-pointer"
              >
                + New Split
              </button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SplitCardSkeleton />
                  <SplitCardSkeleton />
                </div>
              ) : recentSplits.length === 0 ? (
                <EmptyState
                  icon={FaReceipt}
                  heading="No splits yet"
                  description="Split your first meal or bill with friends in just a few taps."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate("/split/create")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                    >
                      <span>Split a Bill</span>
                      <FaArrowRight className="text-xs" />
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recentSplits.map((split) => {
                    const title =
                      split.name ||
                      split.sessionName ||
                      split.notes ||
                      split.receipt?.restaurant ||
                      "Bill Split";
                    const participantCount = split.breakdown?.length || 0;
                    const dateFormatted = new Date(split.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    );

                    return (
                      <article
                        key={split._id || split.id}
                        onClick={() =>
                          navigate(`/split/breakdown?splitId=${split._id || split.id}`)
                        }
                        className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4.5 transition-all hover:border-emerald-300 hover:shadow-sm cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                              <FaReceipt className="text-sm" />
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                                {title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {dateFormatted} • {participantCount} people
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={split.status} />
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-xs">
                          <span className="text-slate-500">Bill Total</span>
                          <span className="font-bold text-slate-900">
                            {formatNPR(split.totalAmount)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
