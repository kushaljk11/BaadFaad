/**
 * @fileoverview Mobile-First Dashboard Home Page
 * @description Compact, thumb-friendly dashboard:
 *              - Proportional typography (no oversized headings or shouting text)
 *              - Side-by-side compact balance cards
 *              - Recent splits in stacked list format with canonical रु currency
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
  FaBolt,
  FaCalendarAlt,
  FaUsers,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
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

        // Compute balances: You Owe vs You Are Owed using authoritative netBalance
        let totalOwed = 0;
        let totalDueToMe = 0;

        const normalizeId = (v) => {
          if (!v) return "";
          if (typeof v === "string") return v;
          if (typeof v === "object") return String(v._id || v.id || "");
          return String(v);
        };
        const myUid = normalizeId(userId);

        splits.forEach((s) => {
          const breakdown = s.breakdown || [];
          const myEntry = breakdown.find((entry) => {
            const entryUid = normalizeId(entry.user?._id || entry.user || entry.participantId || entry._id);
            return myUid && entryUid === myUid;
          });

          if (myEntry) {
            const share = Number(myEntry.amount || 0);
            const paid = Number(myEntry.amountPaid || myEntry.paidAmount || 0);
            const net = myEntry.netBalance !== undefined ? Number(myEntry.netBalance) : (paid - share);

            if (net < 0) {
              totalOwed += Math.abs(net);
            } else if (net > 0) {
              totalDueToMe += net;
            }
          }
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

  const rawName = user?.name ? user.name.split(" ")[0] : "Friend";
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  return (
    <DashboardShell>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5 space-y-3.5">
        {/* Welcome & Primary Action Card */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 mb-1">
                <FaBolt className="text-emerald-700 text-[9px]" />
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-900">
                  Start New Split
                </h2>
              </div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
                Welcome, {userName}!
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Split a restaurant bill, grocery receipt, or group expense in seconds.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-0.5 sm:pt-0">
              <button
                type="button"
                onClick={() => navigate("/split/create")}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-900 active:scale-95 shadow-2xs cursor-pointer min-h-10"
              >
                <FaReceipt className="text-xs" />
                <span>Split a Bill</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/join-session")}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-zinc-50 hover:text-slate-900 active:scale-95 shadow-2xs cursor-pointer min-h-10"
              >
                <FaQrcode className="text-xs text-slate-500" />
                <span>Join with QR</span>
              </button>
            </div>
          </div>
        </section>

        {/* Side-by-Side Financial Balance Cards */}
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {loading ? (
            <>
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
            </>
          ) : (
            <>
              {/* You Owe Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                      Total You Owe
                    </span>
                    <p className="mt-1 text-base sm:text-xl font-semibold text-slate-900 tracking-tight truncate">
                      {formatNPR(youOwe)}
                    </p>
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-150">
                    <FaMoneyCheckAlt className="text-xs" />
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-zinc-100">
                  <p className="text-[10px] font-medium text-slate-500 truncate">
                    {youOwe > 0
                      ? "Pending payments"
                      : "No outstanding dues"}
                  </p>
                </div>
              </div>

              {/* You Are Owed Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                      You are Owed
                    </span>
                    <p className="mt-1 text-base sm:text-xl font-semibold text-emerald-800 tracking-tight truncate">
                      {formatNPR(youAreOwed)}
                    </p>
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-150">
                    <FaHandHoldingUsd className="text-xs" />
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-zinc-100">
                  <p className="text-[10px] font-medium text-slate-500 truncate">
                    {youAreOwed > 0
                      ? "Pending from friends"
                      : "All members settled"}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Quick Groups Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/group"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-zinc-50 hover:text-slate-900 transition-colors shadow-2xs"
          >
            <FaUserFriends className="text-emerald-800 text-xs" />
            <span>Manage Expense Groups</span>
          </Link>
        </div>

        {/* Recent Splits List */}
        <section className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">Recent Splits</h2>
              <p className="text-[11px] text-slate-500">Track and settle ongoing bills</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/split/create")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 cursor-pointer"
            >
              <span>+ New Split</span>
            </button>
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-900 shadow-2xs"
                  >
                    <span>Split a Bill</span>
                    <FaArrowRight className="text-xs" />
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {recentSplits.map((split) => {
                  const title =
                    split.name ||
                    split.sessionName ||
                    split.notes ||
                    split.receipt?.restaurant ||
                    "Bill Split";
                  const total = Number(split.totalAmount || 0);
                  const participants = split.participants || split.breakdown || [];
                  const participantCount = participants.length;
                  const dateStr = split.createdAt
                    ? new Date(split.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                    : "Recent";

                  const allPaid =
                    split.breakdown?.length > 0 &&
                    split.breakdown.every(
                      (b) =>
                        b.paymentStatus === "paid" ||
                        Number(b.amountPaid || 0) >= Number(b.amount || 0)
                    );
                  const status = allPaid ? "Paid" : "Unpaid";

                  return (
                    <article
                      key={split._id || split.id}
                      className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer touch-manipulation active:scale-[0.99]"
                      onClick={() => {
                        const sId = split.sessionId || split.session?._id;
                        if (sId) {
                          navigate(`/split/breakdown?splitId=${split._id}&sessionId=${sId}`);
                        } else {
                          navigate(`/split/breakdown?splitId=${split._id}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                            {title}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <FaCalendarAlt className="text-[8px]" />
                              {dateStr}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <FaUsers className="text-[8px]" />
                              {participantCount} {participantCount === 1 ? "person" : "people"}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-100 pt-2 text-xs">
                        <span className="text-[10px] text-slate-500">Total</span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {formatNPR(total)}
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
    </DashboardShell>
  );
}
