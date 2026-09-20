/**
 * @fileoverview Split Breakdown Page
 * @description Master split breakdown and settlement management screen.
 *              Key Features:
 *              - Real-time split method switcher (Equal, Percentage, Custom)
 *              - Live calculation feedback powered by calculationEngine.js
 *              - Exact paisa remainder reconciliation
 *              - Clear financial metrics: Total Bill, Collected, Remaining Due
 *              - Inline payment tracking for hosts with StatusBadge
 *              - Canonical रु currency formatting via formatNPR
 *              - Double-submission protected notification and navigation
 *
 * @module pages/split/SplitBreakdown
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaWallet,
  FaArrowRight,
  FaBalanceScale,
  FaPercentage,
  FaEdit,
  FaRegPaperPlane,
} from "react-icons/fa";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import api from "../../config/config";
import toast, { Toaster } from "react-hot-toast";
import useSessionSocket, { emitHostNavigate } from "../../hooks/useSessionSocket";
import socket from "../../config/socket";
import { formatNPR } from "../../utills/formatNPR";
import {
  StatusBadge,
  ConnectionPill,
} from "../../components/common/primitives";
import LoadingButton from "../../components/common/LoadingButton";
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateCustomSplit,
} from "../../utills/calculationEngine";

const AVATAR_PALETTE = [
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-teal-100 text-teal-800 border-teal-300",
];

const STATUS_OPTIONS = ["unpaid", "partial", "paid"];

export default function SplitBreakdown() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [split, setSplit] = useState(null);
  const [session, setSession] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [notifying, setNotifying] = useState(false);
  const [inlinePayments, setInlinePayments] = useState({});
  const [updatingIdx, setUpdatingIdx] = useState(null);

  // Dynamic split method controls
  const [activeMethod, setActiveMethod] = useState("equal");
  const [percentageDrafts, setPercentageDrafts] = useState({});
  const [customDrafts, setCustomDrafts] = useState({});
  const [methodDirty, setMethodDirty] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);

  const ensureMembersRequestedRef = useRef(new Set());

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const roomId = type === "group" ? groupId : sessionId;

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = storedUser?._id || storedUser?.id;

  const fetchSplit = useCallback(async () => {
    try {
      if (splitId) {
        const splitRes = await api.get(`/splits/${splitId}`, {
          headers: { "Cache-Control": "no-cache" },
        });
        const latestSplit = splitRes.data.split;
        setSplit(latestSplit);
        if (latestSplit.splitType && !methodDirty) {
          setActiveMethod(latestSplit.splitType);
        }
        return latestSplit;
      }
    } catch {
      toast.error("Failed to load split data");
    }
    return null;
  }, [splitId, methodDirty]);

  useEffect(() => {
    const fetchData = async () => {
      const latestSplit = await fetchSplit();

      try {
        if (type === "group" && splitId && groupId) {
          const groupRes = await api.get(`/groups/${groupId}`);
          const grp = groupRes.data.data || groupRes.data;
          const members = grp.members || [];
          setGroupMembers(members);

          const currentBreakdown = (latestSplit && latestSplit.breakdown) || [];
          const ensureKey = `${splitId}:${groupId}`;
          if (
            members.length > currentBreakdown.length &&
            !ensureMembersRequestedRef.current.has(ensureKey)
          ) {
            try {
              ensureMembersRequestedRef.current.add(ensureKey);
              await api.post(`/splits/${splitId}/ensure-members`);
              await fetchSplit();
            } catch (e) {
              console.warn("ensure-members non-fatal:", e);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load group members", e);
      }

      try {
        if (sessionId) {
          const sessionRes = await api.get(`/session/${sessionId}`);
          setSession(sessionRes.data);
        }
      } catch {
        toast.error("Failed to load session data");
      }
    };
    fetchData();
  }, [splitId, sessionId, type, groupId, fetchSplit]);

  const sessionParticipants =
    session?.session?.participants || session?.participants || [];
  const firstParticipant = sessionParticipants[0];
  const hostUserId =
    typeof firstParticipant === "object"
      ? firstParticipant.user?._id || firstParticipant.user || firstParticipant._id
      : firstParticipant;
  const isHost = currentUserId && String(hostUserId) === String(currentUserId);

  const onHostNavigate = useCallback(
    (data) => {
      if (data?.path) navigate(data.path);
    },
    [navigate]
  );

  const onParticipantJoined = useCallback(
    (data) => {
      if (data?.participants) fetchSplit();
    },
    [fetchSplit]
  );

  const { connectionStatus } = useSessionSocket(
    roomId || sessionId,
    onParticipantJoined,
    onHostNavigate,
    null,
    fetchSplit
  );

  useEffect(() => {
    if (!roomId) return;
    const handler = (data) => {
      if (data?.splitId && String(data.splitId) === String(splitId)) {
        fetchSplit();
      }
    };

    try {
      socket.on("split-updated", handler);
    } catch (e) { }

    return () => {
      try {
        socket.off("split-updated", handler);
      } catch (e) { }
    };
  }, [roomId, splitId, fetchSplit]);

  const totalAmount = Number(split?.totalAmount || 0);
  const breakdown = useMemo(() => split?.breakdown || [], [split?.breakdown]);

  // Merge group members if needed
  const mergedParticipants = useMemo(() => {
    if (type === "group" && groupMembers && groupMembers.length > 0) {
      const equalShare =
        totalAmount > 0
          ? Math.round((totalAmount / groupMembers.length) * 100) / 100
          : 0;
      return groupMembers.map((m) => {
        const id = String(m._id || m.id || m);
        const found = breakdown.find((b) => {
          const bid = String(
            b.user?._id || b.user || b.participant?._id || b.participant || b._id || b.id || ""
          );
          return bid === id;
        });
        if (found) return found;
        return {
          name: m.fullName || m.name || m.email || "Participant",
          amount: equalShare,
          amountPaid: 0,
          paymentStatus: "unpaid",
          email: m.email || "",
          _missingFromBreakdown: true,
        };
      });
    }
    return breakdown;
  }, [type, groupMembers, breakdown, totalAmount]);

  const participantCount = mergedParticipants.length;
  const hasInitializedDraftsRef = useRef(false);

  // Initialize drafts when participants change
  useEffect(() => {
    if (participantCount > 0 && !hasInitializedDraftsRef.current) {
      hasInitializedDraftsRef.current = true;
      const evenPct = Math.round((100 / participantCount) * 100) / 100;
      const initialPcts = {};
      const initialCustoms = {};
      mergedParticipants.forEach((p, idx) => {
        initialPcts[idx] = p.percentage || evenPct;
        initialCustoms[idx] = p.amount || 0;
      });
      setPercentageDrafts(initialPcts);
      setCustomDrafts(initialCustoms);
    }
  }, [participantCount, mergedParticipants]);

  // Derived calculation based on chosen method
  const calculationResult = useMemo(() => {
    if (participantCount === 0 || totalAmount <= 0) return null;

    if (activeMethod === "equal") {
      const rows = calculateEqualSplit(totalAmount, mergedParticipants);
      return { type: "equal", rows, isValid: true, error: null };
    }

    if (activeMethod === "percentage") {
      const entries = mergedParticipants.map((p, idx) => ({
        participant: p,
        percentage: Number(percentageDrafts[idx] ?? 0),
      }));
      const res = calculatePercentageSplit(totalAmount, entries);
      return {
        type: "percentage",
        rows: res.rows,
        isValid: res.isValid,
        error: res.errorMessage,
        totalPct: res.totalPercentage,
        remainingPct: res.remainingPercentage,
      };
    }

    if (activeMethod === "custom") {
      const entries = mergedParticipants.map((p, idx) => ({
        participant: p,
        amount: Number(customDrafts[idx] ?? 0),
      }));
      const res = calculateCustomSplit(totalAmount, entries);
      return {
        type: "custom",
        rows: res.rows,
        isValid: res.isExact,
        error: res.errorMessage,
        totalAllocated: res.totalAllocated,
        remainingAmount: res.remainingAmount,
      };
    }

    return null;
  }, [activeMethod, totalAmount, mergedParticipants, participantCount, percentageDrafts, customDrafts]);

  // Financial statistics
  const totalCollected = useMemo(() => {
    return mergedParticipants.reduce((sum, b) => sum + Number(b.amountPaid || 0), 0);
  }, [mergedParticipants]);

  const remainingBalance = Math.max(0, totalAmount - totalCollected);

  // Initialize inline payments
  useEffect(() => {
    const init = {};
    mergedParticipants.forEach((m, idx) => {
      init[idx] = { amount: Number(m.amountPaid || 0) };
    });
    setInlinePayments(init);
  }, [mergedParticipants]);

  const handlePaymentUpdate = async (index, field, value) => {
    if (!splitId) return;
    setUpdatingIdx(index);
    try {
      const serverIndex = index;
      const body = {};
      if (field === "amountPaid") {
        body.amountPaid = Number(value) || 0;
      } else if (field === "paymentStatus") {
        body.paymentStatus = value;
      }
      await api.put(`/splits/${splitId}/participant/${serverIndex}`, body);
      await fetchSplit();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update payment");
    } finally {
      setUpdatingIdx(null);
    }
  };

  const handleSaveMethod = async () => {
    if (!calculationResult?.isValid) {
      toast.error(calculationResult?.error || "Please resolve calculation issues first");
      return;
    }
    setSavingMethod(true);
    try {
      const newBreakdown = mergedParticipants.map((p, idx) => {
        const computedShare = calculationResult.rows[idx]?.amount ?? p.amount;
        return {
          ...p,
          amount: computedShare,
        };
      });

      await api.put(`/splits/${splitId}`, {
        splitType: activeMethod,
        totalAmount,
        breakdown: newBreakdown,
      });

      setMethodDirty(false);
      await fetchSplit();
      toast.success("Split method updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update split method");
    } finally {
      setSavingMethod(false);
    }
  };

  const handleNotifyAll = async () => {
    if (!split?._id || breakdown.length === 0) {
      toast.error("No split data to notify about");
      return;
    }

    setNotifying(true);
    const toastId = toast.loading("Sending split summary emails...");

    try {
      const payerCandidates = (breakdown || []).map((b) => ({
        name: b.name || b.user?.name || b.participant?.name || "Participant",
        amountPaid: Number(b.amountPaid || 0),
      }));
      let collector = payerCandidates.find((p) => totalAmount > 0 && p.amountPaid >= totalAmount);
      if (!collector) {
        collector = payerCandidates.slice().sort((a, b) => Number(b.amountPaid || 0) - Number(a.amountPaid || 0))[0];
      }
      const payToName = collector && Number(collector.amountPaid || 0) > 0 ? collector.name : "";

      const summaryBreakdown = breakdown.map((b) => {
        const name = b.name || b.user?.name || b.participant?.name || "Participant";
        const amountPaid = b.amountPaid || 0;
        const balanceDue = Math.max(0, b.amount - amountPaid);
        return {
          name,
          email: b.email || b.user?.email || "",
          share: b.amount,
          amountPaid,
          balanceDue,
          paidByName: balanceDue > 0 ? payToName : "",
        };
      });

      await api.post("/nudge/split-summary", {
        splitId: split._id,
        groupName: session?.name || "Split",
        totalAmount,
        breakdown: summaryBreakdown,
      });

      toast.dismiss(toastId);
      toast.success("Sent summary to participants!");
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || "Failed to send notifications");
    } finally {
      setNotifying(false);
    }
  };

  const handleContinue = () => {
    const targetPath = `/split/calculated?splitId=${splitId}&sessionId=${sessionId}&type=${type}${groupId ? `&groupId=${groupId}` : ""
      }`;
    if (roomId) emitHostNavigate(roomId, targetPath);
    navigate(targetPath);
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 pb-28 md:pb-8">
      <Toaster position="top-right" />
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        disableInteraction={true}
      />

      <main className="ml-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Review & Settle
                </span>
                <ConnectionPill status={connectionStatus} />
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Split Breakdown
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Transparent view of each person's exact share and payment status.
              </p>
            </div>

            {isHost && (
              <div className="flex items-center gap-2">
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={notifying}
                  loadingText="Sending..."
                  onClick={handleNotifyAll}
                  icon={<FaRegPaperPlane />}
                >
                  Notify All
                </LoadingButton>
              </div>
            )}
          </div>

          {/* Financial Summary Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Bill
              </span>
              <p className="mt-1.5 text-xl font-semibold text-slate-900 tracking-tight">
                {formatNPR(totalAmount)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {participantCount} people sharing
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Collected
              </span>
              <p className="mt-1.5 text-xl font-semibold text-emerald-600 tracking-tight">
                {formatNPR(totalCollected)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Payments recorded</p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Remaining
              </span>
              <p className="mt-1.5 text-xl font-semibold text-red-500 tracking-tight">
                {formatNPR(remainingBalance)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Outstanding balance</p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Method
              </span>
              <p className="mt-1.5 text-base font-semibold text-slate-900 capitalize">
                {activeMethod.replace("_", " ")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Paisa-reconciled</p>
            </div>
          </section>

          {/* Split Method Tabs (For Host) */}
          {isHost && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Switch Split Method
                </span>
                {methodDirty && (
                  <button
                    type="button"
                    onClick={handleSaveMethod}
                    disabled={savingMethod || !calculationResult?.isValid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                  >
                    <span>{savingMethod ? "Saving..." : "Apply Method"}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod("equal");
                    setMethodDirty(true);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${activeMethod === "equal"
                      ? "bg-emerald-500 text-slate-950 shadow-2xs"
                      : "border border-zinc-200 text-slate-600 hover:bg-zinc-50"
                    }`}
                >
                  <FaBalanceScale />
                  <span>Equal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod("percentage");
                    setMethodDirty(true);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${activeMethod === "percentage"
                      ? "bg-emerald-500 text-slate-950 shadow-2xs"
                      : "border border-zinc-200 text-slate-600 hover:bg-zinc-50"
                    }`}
                >
                  <FaPercentage />
                  <span>Percentage</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod("custom");
                    setMethodDirty(true);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${activeMethod === "custom"
                      ? "bg-emerald-500 text-slate-950 shadow-2xs"
                      : "border border-zinc-200 text-slate-600 hover:bg-zinc-50"
                    }`}
                >
                  <FaEdit />
                  <span>Custom</span>
                </button>
              </div>

              {/* Calculation Live Feedback */}
              {calculationResult && !calculationResult.isValid && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs font-semibold text-amber-800 flex items-center justify-between">
                  <span>{calculationResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Participant Breakdown Cards */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Each Person's Share
            </h2>

            <div className="space-y-3">
              {mergedParticipants.map((b, i) => {
                const name =
                  b.name || b.user?.name || b.participant?.name || `Participant ${i + 1}`;
                const amountPaid = Number(b.amountPaid || 0);
                const assignedShare =
                  calculationResult?.rows[i]?.amount !== undefined
                    ? calculationResult.rows[i].amount
                    : Number(b.amount || 0);
                const due = Math.max(0, assignedShare - amountPaid);
                const paymentStatus =
                  amountPaid >= assignedShare && assignedShare > 0
                    ? "paid"
                    : amountPaid > 0
                      ? "partial"
                      : "unpaid";
                const avatarColor = AVATAR_PALETTE[i % AVATAR_PALETTE.length];

                return (
                  <article
                    key={i}
                    className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: Avatar + Name + Share */}
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${avatarColor}`}
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{name}</p>
                          <p className="text-xs font-semibold text-emerald-700">
                            Share: {formatNPR(assignedShare)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Method Controls (If changing percentages or custom) */}
                      {isHost && activeMethod === "percentage" && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-500">%</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={percentageDrafts[i] ?? ""}
                            onChange={(e) => {
                              setPercentageDrafts({
                                ...percentageDrafts,
                                [i]: e.target.value,
                              });
                              setMethodDirty(true);
                            }}
                            className="w-20 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {isHost && activeMethod === "custom" && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-500">रु</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={customDrafts[i] ?? ""}
                            onChange={(e) => {
                              setCustomDrafts({
                                ...customDrafts,
                                [i]: e.target.value,
                              });
                              setMethodDirty(true);
                            }}
                            className="w-28 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Right: Payment Status & Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-zinc-100 sm:border-0 pt-3 sm:pt-0">
                        {/* Inline Paid Editor for Host */}
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Paid So Far
                          </p>
                          {isHost ? (
                            <input
                              type="number"
                              min="0"
                              disabled={updatingIdx === i}
                              value={inlinePayments[i]?.amount ?? ""}
                              onChange={(e) =>
                                setInlinePayments({
                                  ...inlinePayments,
                                  [i]: { amount: e.target.value },
                                })
                              }
                              onBlur={(e) =>
                                handlePaymentUpdate(i, "amountPaid", e.target.value)
                              }
                              className={`w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-slate-800 text-right focus:border-emerald-500 focus:outline-none ${updatingIdx === i ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                            />
                          ) : (
                            <p className="text-xs font-semibold text-slate-800">
                              {formatNPR(amountPaid)}
                            </p>
                          )}
                        </div>

                        {/* Balance Due */}
                        <div className="text-right min-w-17.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Due
                          </p>
                          <p
                            className={`text-xs font-semibold ${due > 0 ? "text-red-500" : "text-emerald-600"
                              }`}
                          >
                            {due > 0 ? formatNPR(due) : "Settled"}
                          </p>
                        </div>

                        <StatusBadge status={paymentStatus} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3.5 backdrop-blur-md shadow-lg md:left-56">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Dues
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {formatNPR(remainingBalance)}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <LoadingButton
              size="lg"
              onClick={handleContinue}
              icon={<FaArrowRight />}
            >
              Continue to Item Split
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}
