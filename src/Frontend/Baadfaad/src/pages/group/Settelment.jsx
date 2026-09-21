/**
 * @fileoverview Settlement Page
 * @description Shows the payment settlement status for a group's splits.
 *              Displays each member's outstanding balance, payment history,
 *              and allows the host to mark payments as completed or send
 *              nudge reminders. Supports exporting settlement summaries.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/group/Settlement
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import api from "../../config/config";
import socket from "../../config/socket";
import toast from "react-hot-toast";
import {
  FaSpinner,
  FaFileExport,
  FaArrowRight,
  FaCheckCircle,
  FaPaperPlane,
  FaRegClock,
  FaReceipt,
  FaCreditCard,
} from "react-icons/fa";
import { formatNPR } from "../../utills/formatNPR";

const getInitials = (name) =>
  (name || "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const normalizeId = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return String(v._id || v.id || "");
  return String(v);
};

export default function Settlement() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingDueIdx, setEditingDueIdx] = useState(null);
  const [dueDrafts, setDueDrafts] = useState({});

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = normalizeId(storedUser?._id || storedUser?.id || "");
  const breakdown = useMemo(() => split?.breakdown || [], [split?.breakdown]);
  const settlements = useMemo(() => split?.settlement || [], [split?.settlement]);

  const highestPayerEntry = (breakdown || [])
    .slice()
    .sort((a, b) => Number(b?.amountPaid || b?.paidAmount || 0) - Number(a?.amountPaid || a?.paidAmount || 0))[0] || null;
  const highestPayerId = normalizeId(
    highestPayerEntry?.user?._id ||
    highestPayerEntry?.user ||
    highestPayerEntry?.participant?._id ||
    highestPayerEntry?.participant ||
    highestPayerEntry?.participantId ||
    highestPayerEntry?._id ||
    ""
  );
  const highestPayerPaid = Number(highestPayerEntry?.amountPaid || highestPayerEntry?.paidAmount || 0);
  const canEditDue = highestPayerPaid > 0 && String(currentUserId) === String(highestPayerId);
  const highestPayerName =
    highestPayerEntry?.name ||
    highestPayerEntry?.user?.name ||
    highestPayerEntry?.participant?.name ||
    "Highest payer";

  const fetchGroupAndSplit = useCallback(async () => {
    try {
      const groupRes = await api.get(`/groups/${groupId}`);
      const groupData = groupRes.data?.data || groupRes.data;
      setGroup(groupData);

      const splitId = groupData?.splitId;
      if (splitId) {
        const splitRes = await api.get(`/splits/${splitId}`);
        setSplit(splitRes.data?.split || splitRes.data);
      }
    } catch (err) {
      console.error("Failed to load group data:", err);
      toast.error("Failed to load group data");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) fetchGroupAndSplit();
  }, [groupId, fetchGroupAndSplit]);

  // Real-time synchronization for settlements
  useEffect(() => {
    if (!groupId) return;
    const handler = (data) => {
      fetchGroupAndSplit();
    };
    socket.on("split:updated", handler);
    socket.on("contribution:updated", handler);
    socket.on("settlement:updated", handler);
    socket.on("session:completed", handler);
    return () => {
      socket.off("split:updated", handler);
      socket.off("contribution:updated", handler);
      socket.off("settlement:updated", handler);
      socket.off("session:completed", handler);
    };
  }, [groupId, fetchGroupAndSplit]);

  const totalExpense = split?.totalAmount || 0;
  const totalCollected = breakdown.reduce((sum, b) => sum + (b.amountPaid || b.paidAmount || 0), 0);
  // Remaining reflects the sum of all outstanding debts
  const remaining = breakdown.reduce((sum, b) => {
    const net = b.netBalance !== undefined ? b.netBalance : ((b.amountPaid || b.paidAmount || 0) - (b.amount || 0));
    return sum + (net < 0 ? Math.abs(net) : 0);
  }, 0);
  const collectPct = totalExpense > 0 ? Math.round(((totalExpense - remaining) / totalExpense) * 100) : 0;

  const participants = useMemo(() => breakdown.map((b, index) => {
    const share = b.amount || 0;
    const paid = b.amountPaid || b.paidAmount || 0;
    const netBalance = b.netBalance !== undefined ? b.netBalance : (paid - share);
    const due = netBalance < 0 ? Math.abs(netBalance) : 0;
    return {
      index,
      participantId: normalizeId(b.participantId || b._id || b.id),
      userId: normalizeId(b.user?._id || b.user?.id || b.user),
      name: b.name || b.user?.name || b.participant?.name || "Participant",
      email: b.email || b.user?.email || "",
      share,
      paid,
      netBalance,
      due,
      status: b.paymentStatus || (due === 0 ? "paid" : "unpaid"),
    };
  }), [breakdown]);

  useEffect(() => {
    const drafts = {};
    participants.forEach((person) => {
      drafts[person.index] = Number(person.due || 0);
    });
    setDueDrafts(drafts);
  }, [participants]);

  const updateDueDraft = (idx, value) => {
    setDueDrafts((prev) => ({ ...prev, [idx]: value }));
  };

  const saveDueDraft = async (person) => {
    if (!canEditDue || !split?._id) return;

    const raw = Number(dueDrafts[person.index] ?? person.due ?? 0);
    const clampedDue = Math.max(0, Math.min(Number(person.share || 0), Number.isFinite(raw) ? raw : 0));
    const nextPaid = Math.max(0, Number(person.share || 0) - clampedDue);

    setEditingDueIdx(person.index);
    try {
      const res = await api.put(`/splits/${split._id}/participant/${person.index}`, {
        amountPaid: nextPaid,
        editorId: currentUserId,
        enforceHighestPayer: true,
      });

      const updated = res.data?.split || res.data?.data?.split || null;
      if (updated) {
        setSplit(updated);
      } else {
        const splitRes = await api.get(`/splits/${split._id}`);
        setSplit(splitRes.data?.split || splitRes.data);
      }

      updateDueDraft(person.index, clampedDue);
      toast.success("Due updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update due");
    } finally {
      setEditingDueIdx(null);
    }
  };

  const handleContinueToNudge = () => {
    navigate(`/group/${groupId}/nudge`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-50 items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-emerald-600" aria-label="Loading" />
      </div>
    );
  }

  return (
    <DashboardShell
      hideBottomNav={true}
      title="Settlement Summary"
      backTo="/group"
      mainClassName="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-8"
    >
      <div className="w-full">
          {/* Group header with image */}
          {group?.image && (
            <div className="mb-6 overflow-hidden rounded-3xl">
              <img
                src={group.image}
                alt={group.name}
                className="h-48 w-full object-cover"
              />
            </div>
          )}

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                Settlement Summary
              </h1>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                {group?.name || "Group"} &bull; Final breakdown of balances
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-zinc-100"
              >
                <FaFileExport className="text-xs" aria-hidden="true" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={handleContinueToNudge}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold text-slate-900 hover:bg-emerald-500"
              >
                Continue to Nudge
                <FaArrowRight className="text-xs" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="mb-4 text-xs text-slate-500">
            {highestPayerPaid > 0
              ? `Only ${highestPayerName} (highest payer) can edit balance due.`
              : "No one can edit balance due until someone has paid an amount."}
          </p>

          {/* Summary cards */}
          <section aria-label="Settlement totals" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Total Session Expense
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNPR(totalExpense)}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: "100%" }} />
              </div>
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Total Collected
              </p>
              <p className="mt-1 text-3xl font-semibold text-emerald-800">
                {formatNPR(totalCollected)}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${collectPct}%` }}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Remaining Balance
              </p>
              <p className="mt-1 text-3xl font-semibold text-orange-700">
                {formatNPR(remaining)}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-orange-400"
                  style={{ width: `${totalExpense > 0 ? Math.round((remaining / totalExpense) * 100) : 0}%` }}
                />
              </div>
            </article>
          </section>

          {/* Directed Transfers ("Who Pays Whom") */}
          <section aria-label="Who pays whom" className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaReceipt className="text-slate-400" />
                <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                  Settlements: Who Pays Whom
                </h2>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {settlements.length} transfer{settlements.length === 1 ? "" : "s"}
              </span>
            </div>

            {settlements.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 border border-zinc-100 py-6 text-center text-sm text-slate-500">
                🎉 All balances are settled! No further money transfers needed.
              </div>
            ) : (
              <div className="space-y-3">
                {settlements.map((s, idx) => {
                  const isUserPayer =
                    currentUserId &&
                    (normalizeId(s.fromParticipantId) === currentUserId ||
                      (storedUser?.name && s.fromName?.toLowerCase() === storedUser.name.toLowerCase()));
                  const isUserReceiver =
                    currentUserId &&
                    (normalizeId(s.toParticipantId) === currentUserId ||
                      (storedUser?.name && s.toName?.toLowerCase() === storedUser.name.toLowerCase()));

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                        isUserPayer
                          ? "bg-rose-50/70 border-rose-200"
                          : isUserReceiver
                          ? "bg-emerald-50/70 border-emerald-200"
                          : "bg-zinc-50 border-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm text-slate-900">
                          {isUserPayer ? "You" : s.fromName}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">pays</span>
                        <span className="font-semibold text-sm text-slate-900">
                          {isUserReceiver ? "You" : s.toName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span
                          className={`text-sm font-bold ${
                            isUserPayer
                              ? "text-rose-600"
                              : isUserReceiver
                              ? "text-emerald-700"
                              : "text-slate-900"
                          }`}
                        >
                          {formatNPR(s.amount)}
                        </span>

                        {isUserPayer ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/payment?amount=${s.amount}&gateway=esewa&splitId=${split?._id || ""}&groupId=${groupId}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            <FaCreditCard className="text-[10px]" /> Pay Now
                          </button>
                        ) : isUserReceiver ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/group/${groupId}/nudge?recipient=${encodeURIComponent(s.fromName)}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 transition cursor-pointer"
                          >
                            <FaPaperPlane className="text-[10px]" /> Nudge {s.fromName}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Participant table — desktop grid, mobile card stack */}
          <section aria-label="Participant balances" className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
            {/* Desktop header */}
            <div className="hidden grid-cols-[2fr_1fr_1fr_1.2fr_1.5fr] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 md:grid">
              <p>Participant</p>
              <p>Total Share</p>
              <p>Amount Paid</p>
              <p>Net Balance</p>
              <p>Status / Action</p>
            </div>

            <div className="divide-y divide-zinc-200">
              {participants.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-600">
                  No participants in this split yet.
                </div>
              ) : (
                participants.map((person, idx) => (
                  <div
                    key={person.email || idx}
                    className="px-4 py-3"
                  >
                    {/* Desktop row — hidden on mobile */}
                    <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1.2fr_1.5fr] md:items-center md:gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-slate-700">
                          {getInitials(person.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                          <p className="truncate text-xs text-slate-600">{person.email}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{formatNPR(person.share)}</p>
                      <p className="text-sm font-semibold text-slate-700">{formatNPR(person.paid)}</p>
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            person.netBalance > 0
                              ? "text-emerald-700"
                              : person.netBalance < 0
                              ? "text-rose-600"
                              : "text-slate-500"
                          }`}
                        >
                          {person.netBalance > 0
                            ? `+${formatNPR(person.netBalance)} (Receives)`
                            : person.netBalance < 0
                            ? `-${formatNPR(person.due)} (Owes)`
                            : "Settled (Rs. 0)"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {person.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                            <FaCheckCircle className="text-[9px]" aria-hidden="true" /> Paid
                          </span>
                        ) : (
                          <>
                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-800">
                              {person.status === "partial" ? "Partial" : "Unpaid"}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/group/${groupId}/nudge?recipient=${encodeURIComponent(person.name)}`)}
                              aria-label={`Send nudge to ${person.name}`}
                              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-zinc-100 cursor-pointer"
                            >
                              <FaPaperPlane className="text-[9px]" aria-hidden="true" /> Send Nudge
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mobile card — hidden on desktop */}
                    <div className="flex flex-col gap-3 md:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-slate-700">
                            {getInitials(person.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
                            <p className="truncate text-xs text-slate-500">{person.email}</p>
                          </div>
                        </div>
                        {person.status === "paid" ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                            <FaCheckCircle className="text-[9px]" aria-hidden="true" /> Paid
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-800">
                            {person.status === "partial" ? "Partial" : "Unpaid"}
                          </span>
                        )}
                      </div>
                      <dl className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-zinc-50 px-2 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Share</dt>
                          <dd className="mt-0.5 text-sm font-semibold text-slate-800">{formatNPR(person.share, { showSymbol: false })}</dd>
                        </div>
                        <div className="rounded-xl bg-zinc-50 px-2 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Paid</dt>
                          <dd className="mt-0.5 text-sm font-semibold text-emerald-800">{formatNPR(person.paid, { showSymbol: false })}</dd>
                        </div>
                        <div className="rounded-xl bg-zinc-50 px-2 py-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Balance</dt>
                          <dd className={`mt-0.5 text-sm font-bold ${person.netBalance > 0 ? "text-emerald-700" : person.netBalance < 0 ? "text-rose-600" : "text-slate-800"}`}>
                            {person.netBalance > 0
                              ? `+${formatNPR(person.netBalance, { showSymbol: false })}`
                              : person.netBalance < 0
                              ? `-${formatNPR(person.due, { showSymbol: false })}`
                              : "0"}
                          </dd>
                        </div>
                      </dl>
                      {person.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => navigate(`/group/${groupId}/nudge?recipient=${encodeURIComponent(person.name)}`)}
                          aria-label={`Send nudge to ${person.name}`}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          <FaPaperPlane className="text-[10px]" aria-hidden="true" /> Send Nudge to {person.name}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Bottom bar */}
          <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <FaRegClock className="text-xs" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Awaiting {formatNPR(remaining)} total
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Once all participants have cleared their balance, the group settlement is complete.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinueToNudge}
              className="self-start inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-semibold text-slate-900 hover:bg-emerald-500 md:self-auto"
            >
              Continue to Nudge
              <FaArrowRight className="text-xs" aria-hidden="true" />
            </button>
          </section>
        </div>
    </DashboardShell>
  );
}
