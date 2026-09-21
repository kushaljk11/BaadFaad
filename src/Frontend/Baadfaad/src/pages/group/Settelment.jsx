/**
 * @fileoverview Settlement Page
 * @description Authoritative settlement and reimbursement ledger for a group's splits.
 *              Strictly separates:
 *              1. Expense Share (Obligation)
 *              2. Merchant Contribution (Who originally paid the bill)
 *              3. Directed Reimbursement Settlements (Debts between debtors and creditors)
 *              Allows host/creditor to record manual/cash repayments with zero overpayment.
 *              Provides real-time Socket.IO synchronization and immutable payment history.
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
  FaMoneyBillWave,
  FaHistory,
  FaTimes,
  FaInfoCircle,
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

  // Payment Recording Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = normalizeId(storedUser?._id || storedUser?.id || "");
  const currentUserName = storedUser?.name || "";

  const breakdown = useMemo(() => split?.breakdown || [], [split?.breakdown]);
  const settlements = useMemo(() => split?.settlement || [], [split?.settlement]);
  const paymentHistory = useMemo(() => split?.settlementPayments || [], [split?.settlementPayments]);

  const isGroupHost = useMemo(() => {
    const hostId = normalizeId(group?.createdBy?._id || group?.createdBy || split?.createdBy);
    return Boolean(currentUserId && hostId && String(currentUserId) === String(hostId));
  }, [group?.createdBy, split?.createdBy, currentUserId]);

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
      console.error("Failed to load group settlement data:", err);
      toast.error("Failed to load settlement data");
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
    const handler = () => {
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

  // Settlement-specific financial totals
  const totalExpense = split?.summary?.totalExpense ?? (split?.totalAmount || 0);
  const totalToSettle = split?.summary?.totalToSettle ?? 0;
  const totalReimbursed = split?.summary?.totalReimbursed ?? 0;
  const totalRemaining = split?.summary?.totalRemaining ?? 0;
  const isFullySettled = split?.isFullySettled || (totalToSettle > 0 && totalRemaining === 0);

  const settlementPct = totalToSettle > 0
    ? Math.min(100, Math.round((totalReimbursed / totalToSettle) * 100))
    : 100;

  // Map participant breakdown with explicit separation of layers
  const participants = useMemo(() => {
    return breakdown.map((b, index) => {
      const participantId = normalizeId(b.participantId || b._id || b.id);
      const userId = normalizeId(b.user?._id || b.user?.id || b.user);
      const name = b.name || b.user?.name || b.participant?.name || "Participant";
      const email = b.email || b.user?.email || "";

      // Layer A: Expense Share (Obligation)
      const expenseShare = b.expenseShare ?? b.shareAmount ?? b.amount ?? 0;

      // Layer B: Merchant Contribution (Original payment to restaurant/shop)
      const merchantContribution = b.merchantContribution ?? b.paidAmount ?? 0;

      // Layer C: Net balance (+: Creditor, -: Debtor, 0: Settled)
      const netBalance = b.netBalance !== undefined ? b.netBalance : (merchantContribution - expenseShare);

      // Layer D: Reimbursement Progress
      const reimbursementDue = b.reimbursementDue !== undefined ? b.reimbursementDue : (netBalance < 0 ? Math.abs(netBalance) : 0);
      const reimbursementPaid = b.reimbursementPaid !== undefined ? b.reimbursementPaid : 0;
      const reimbursementRemaining = b.reimbursementRemaining !== undefined ? b.reimbursementRemaining : Math.max(0, reimbursementDue - reimbursementPaid);

      // Status
      let status = "settled";
      if (netBalance > 0) {
        status = "creditor";
      } else if (netBalance < 0) {
        if (reimbursementPaid <= 0) {
          status = "unpaid";
        } else if (reimbursementRemaining <= 0) {
          status = "paid";
        } else {
          status = "partial";
        }
      }

      return {
        index,
        participantId,
        userId,
        name,
        email,
        expenseShare,
        merchantContribution,
        netBalance,
        reimbursementDue,
        reimbursementPaid,
        reimbursementRemaining,
        status,
      };
    });
  }, [breakdown]);

  // Open Record Payment modal
  const handleOpenPaymentModal = (transfer) => {
    setSelectedTransfer(transfer);
    setPaymentAmount(String(transfer.remainingAmount));
    setPaymentMethod("CASH");
    setPaymentNote("");
    setPaymentModalOpen(true);
  };

  // Close modal
  const handleClosePaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedTransfer(null);
    setPaymentAmount("");
    setPaymentNote("");
  };

  // Record manual/cash reimbursement payment
  const handleRecordPayment = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTransfer || !split?._id) return;

    const numAmount = Number(paymentAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (numAmount > selectedTransfer.remainingAmount) {
      toast.error(`Amount cannot exceed remaining balance of ${formatNPR(selectedTransfer.remainingAmount)}`);
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await api.post(`/splits/${split._id}/settlement-payments`, {
        fromParticipantId: selectedTransfer.fromParticipantId,
        toParticipantId: selectedTransfer.toParticipantId,
        amount: numAmount,
        method: paymentMethod,
        note: paymentNote.trim(),
      });

      toast.success(res.data?.message || "Reimbursement payment recorded!");
      if (res.data?.split) {
        setSplit(res.data.split);
      } else {
        await fetchGroupAndSplit();
      }
      handleClosePaymentModal();
    } catch (err) {
      console.error("Failed to record settlement payment:", err);
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Quick action: Mark full amount received immediately
  const handleQuickMarkFull = async (transfer) => {
    if (!transfer || !split?._id) return;
    if (transfer.remainingAmount <= 0) return;

    if (!window.confirm(`Confirm full receipt of ${formatNPR(transfer.remainingAmount)} from ${transfer.fromName}?`)) {
      return;
    }

    try {
      const res = await api.post(`/splits/${split._id}/settlement-payments`, {
        fromParticipantId: transfer.fromParticipantId,
        toParticipantId: transfer.toParticipantId,
        amount: transfer.remainingAmount,
        method: "CASH",
        note: "Marked full amount received",
      });

      toast.success(res.data?.message || `Received ${formatNPR(transfer.remainingAmount)} from ${transfer.fromName}`);
      if (res.data?.split) {
        setSplit(res.data.split);
      } else {
        await fetchGroupAndSplit();
      }
    } catch (err) {
      console.error("Failed to mark full amount:", err);
      toast.error(err.response?.data?.message || "Failed to record payment");
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
              Settlement & Reimbursements
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              {group?.name || "Group"} &bull; Who owes whom and reimbursement ledger
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
              Payment Nudges
              <FaArrowRight className="text-xs" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Fully Settled Celebration Banner */}
        {isFullySettled && (
          <div className="mb-6 rounded-3xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5 text-emerald-900 flex items-center gap-3.5 shadow-xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-200 text-emerald-800 text-lg">
              🎉
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900">All balances are settled!</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Every settlement obligation has been paid in full. No outstanding debts remain for this split.
              </p>
            </div>
          </div>
        )}

        {/* Informational Banner */}
        <div className="mb-5 rounded-2xl bg-zinc-100 border border-zinc-200 p-3 text-xs text-slate-600 flex items-start gap-2.5">
          <FaInfoCircle className="mt-0.5 text-slate-400 shrink-0" />
          <div>
            <strong>Financial Layering:</strong> Merchant payments (who paid the original bill) and settlement reimbursements (who gave money to whom) are recorded independently. The host or creditor can record repayments physically received below.
          </div>
        </div>

        {/* Summary cards: Settlement-specific metrics */}
        <section aria-label="Settlement totals" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Session Expense */}
          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Expense
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatNPR(totalExpense)}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">Total bill at merchant</p>
          </article>

          {/* Total to Settle */}
          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total to Settle
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">
              {formatNPR(totalToSettle)}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">Total debtor obligations</p>
          </article>

          {/* Reimbursed So Far */}
          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reimbursed So Far
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {formatNPR(totalReimbursed)}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${settlementPct}%` }}
              />
            </div>
          </article>

          {/* Remaining Outstanding */}
          <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Remaining Due
            </p>
            <p className="mt-1 text-2xl font-bold text-rose-600">
              {formatNPR(totalRemaining)}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {totalRemaining === 0 ? "All cleared 🎉" : "Pending reimbursement"}
            </p>
          </article>
        </section>

        {/* Directed Transfers ("Who Owes Whom") */}
        <section aria-label="Who pays whom" className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaReceipt className="text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                Settlements: Who Owes Whom
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {settlements.length} transfer{settlements.length === 1 ? "" : "s"}
            </span>
          </div>

          {settlements.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 border border-zinc-100 py-8 text-center text-sm text-slate-500">
              🎉 All balances are settled! No further reimbursement transfers are required.
            </div>
          ) : (
            <div className="space-y-3.5">
              {settlements.map((s, idx) => {
                const isDebtor =
                  currentUserId &&
                  (normalizeId(s.fromParticipantId) === currentUserId ||
                    (currentUserName && s.fromName?.toLowerCase() === currentUserName.toLowerCase()));

                const isCreditor =
                  currentUserId &&
                  (normalizeId(s.toParticipantId) === currentUserId ||
                    (currentUserName && s.toName?.toLowerCase() === currentUserName.toLowerCase()));

                const canRecordPayment = isGroupHost || isCreditor;
                const isPaid = s.status === "PAID" || s.remainingAmount <= 0;
                const isPartial = s.status === "PARTIAL" && s.remainingAmount > 0;
                const paidPct = s.dueAmount > 0 ? Math.min(100, Math.round((s.paidAmount / s.dueAmount) * 100)) : 100;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 transition ${
                      isPaid
                        ? "bg-emerald-50/40 border-emerald-200"
                        : isDebtor
                        ? "bg-rose-50/50 border-rose-200"
                        : isCreditor
                        ? "bg-indigo-50/50 border-indigo-200"
                        : "bg-zinc-50/70 border-zinc-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Obligation title */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {isDebtor ? "You" : s.fromName}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">owes</span>
                        <span className="font-bold text-sm text-slate-900">
                          {isCreditor ? "You" : s.toName}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isPartial
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isPaid && <FaCheckCircle className="text-[9px]" />}
                          {s.status || (isPaid ? "PAID" : "UNPAID")}
                        </span>
                      </div>

                      {/* Amounts Breakdown */}
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Due</span>
                          <span className="font-semibold text-slate-700">{formatNPR(s.dueAmount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Received</span>
                          <span className="font-semibold text-emerald-700">{formatNPR(s.paidAmount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Remaining</span>
                          <span className={`font-bold ${isPaid ? "text-slate-500" : "text-rose-600"}`}>
                            {formatNPR(s.remainingAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPaid ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                      {isPaid ? (
                        <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <FaCheckCircle /> Fully Paid & Settled
                        </span>
                      ) : (
                        <>
                          {/* Debtor can pay online */}
                          {isDebtor && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/payment?amount=${s.remainingAmount}&gateway=esewa&splitId=${split?._id || ""}&groupId=${groupId}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
                            >
                              <FaCreditCard className="text-[10px]" /> Pay Online ({formatNPR(s.remainingAmount)})
                            </button>
                          )}

                          {/* Host or Creditor can record manual/cash payment */}
                          {canRecordPayment && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleQuickMarkFull(s)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                              >
                                <FaCheckCircle className="text-[10px]" /> Mark Full Received
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(s)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                              >
                                <FaMoneyBillWave className="text-[10px]" /> Record Payment
                              </button>
                            </>
                          )}

                          {/* Creditor or Host can send nudge to the debtor */}
                          {(isGroupHost || isCreditor) && !isDebtor && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/group/${groupId}/nudge?recipient=${encodeURIComponent(s.fromName)}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-zinc-200 transition cursor-pointer"
                            >
                              <FaPaperPlane className="text-[10px]" /> Nudge {s.fromName}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Participant Ledger Table */}
        <section aria-label="Participant balances" className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">
              Participant Ledger Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Detailed balance of bill shares, merchant contributions, and reimbursement progress
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden grid-cols-[2fr_1fr_1.2fr_1.2fr_1.4fr] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 md:grid">
            <p>Participant</p>
            <p>Your Share</p>
            <p>Paid to Merchant</p>
            <p>Net Balance</p>
            <p>Reimbursement Status</p>
          </div>

          <div className="divide-y divide-zinc-200">
            {participants.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-600">
                No participants in this split yet.
              </div>
            ) : (
              participants.map((person) => {
                const isDebtor = person.netBalance < 0;
                const isCreditor = person.netBalance > 0;
                const isSettled = person.status === "paid" || (!isDebtor && !isCreditor);

                return (
                  <div key={person.participantId || person.index} className="px-4 py-3.5 sm:px-6">
                    {/* Desktop row */}
                    <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.2fr_1.2fr_1.4fr] md:items-center md:gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-slate-700">
                          {getInitials(person.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {person.name}
                            {String(person.userId) === String(currentUserId) && (
                              <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">You</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">{person.email}</p>
                        </div>
                      </div>

                      {/* Share */}
                      <p className="text-sm font-semibold text-slate-700">{formatNPR(person.expenseShare)}</p>

                      {/* Paid to Merchant */}
                      <p className="text-sm font-semibold text-slate-700">{formatNPR(person.merchantContribution)}</p>

                      {/* Net Balance */}
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            isCreditor
                              ? "text-emerald-700"
                              : isDebtor
                              ? "text-rose-600"
                              : "text-slate-500"
                          }`}
                        >
                          {isCreditor
                            ? `+${formatNPR(person.netBalance)} (Receives)`
                            : isDebtor
                            ? `-${formatNPR(person.reimbursementDue)} (Owes)`
                            : "Settled (Rs. 0)"}
                        </p>
                      </div>

                      {/* Reimbursement Status */}
                      <div className="flex items-center gap-2">
                        {isCreditor ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                            Creditor
                          </span>
                        ) : isSettled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                            <FaCheckCircle className="text-[9px]" /> Paid
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                person.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {person.status === "partial" ? "PARTIAL" : "UNPAID"}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatNPR(person.reimbursementPaid)} of {formatNPR(person.reimbursementDue)} paid
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="flex flex-col gap-2.5 md:hidden">
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

                        {isCreditor ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Creditor
                          </span>
                        ) : isSettled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            <FaCheckCircle className="text-[9px]" /> Paid
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              person.status === "partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {person.status === "partial" ? "PARTIAL" : "UNPAID"}
                          </span>
                        )}
                      </div>

                      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-zinc-50 p-2">
                          <dt className="text-[10px] font-semibold text-slate-500 uppercase">Share</dt>
                          <dd className="mt-0.5 font-bold text-slate-800">{formatNPR(person.expenseShare, { showSymbol: false })}</dd>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-2">
                          <dt className="text-[10px] font-semibold text-slate-500 uppercase">Paid Bill</dt>
                          <dd className="mt-0.5 font-bold text-slate-800">{formatNPR(person.merchantContribution, { showSymbol: false })}</dd>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-2">
                          <dt className="text-[10px] font-semibold text-slate-500 uppercase">Balance</dt>
                          <dd
                            className={`mt-0.5 font-bold ${
                              isCreditor ? "text-emerald-700" : isDebtor ? "text-rose-600" : "text-slate-800"
                            }`}
                          >
                            {isCreditor
                              ? `+${formatNPR(person.netBalance, { showSymbol: false })}`
                              : isDebtor
                              ? `-${formatNPR(person.reimbursementDue, { showSymbol: false })}`
                              : "0"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Payment History Ledger Section */}
        <section aria-label="Payment history" className="mb-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-3.5 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaHistory className="text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">
                Reimbursement Payment History
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {paymentHistory.length} recorded
            </span>
          </div>

          <div className="p-4 sm:p-6">
            {paymentHistory.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                No reimbursement payments have been recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3.5 text-xs"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {entry.fromName}
                        </span>
                        <span className="text-slate-400">paid</span>
                        <span className="font-bold text-sm text-slate-900">
                          {entry.toName}
                        </span>
                        <span className="ml-1 inline-block rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {entry.method}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-slate-500 italic">&ldquo;{entry.note}&rdquo;</p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        &bull; Recorded by {entry.recordedByName}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-700">
                        {formatNPR(entry.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
                {totalRemaining > 0
                  ? `Awaiting ${formatNPR(totalRemaining)} total reimbursements`
                  : "All balances are settled!"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {totalRemaining > 0
                  ? "Once every participant has cleared their remaining balance, the split is fully settled."
                  : "No more transfers are pending. Session is complete."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueToNudge}
            className="self-start inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-semibold text-slate-900 hover:bg-emerald-500 md:self-auto"
          >
            Payment Nudges
            <FaArrowRight className="text-xs" aria-hidden="true" />
          </button>
        </section>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <FaMoneyBillWave className="text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Record Reimbursement</h3>
              </div>
              <button
                type="button"
                onClick={handleClosePaymentModal}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 text-xs text-slate-700">
                <p>
                  <strong>Debtor:</strong> {selectedTransfer.fromName}
                </p>
                <p>
                  <strong>Creditor:</strong> {selectedTransfer.toName}
                </p>
                <p className="mt-1 font-semibold text-rose-600">
                  Remaining Due: {formatNPR(selectedTransfer.remainingAmount)}
                </p>
              </div>

              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="modalAmount" className="text-xs font-semibold text-slate-700">
                    Amount Received (NPR)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(selectedTransfer.remainingAmount))}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline"
                  >
                    Max ({formatNPR(selectedTransfer.remainingAmount)})
                  </button>
                </div>
                <input
                  id="modalAmount"
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedTransfer.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. 100"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label htmlFor="modalMethod" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  id="modalMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="CASH">Cash (In-person)</option>
                  <option value="MANUAL">Manual Bank Transfer</option>
                  <option value="ESEWA">eSewa Direct</option>
                  <option value="KHALTI">Khalti Direct</option>
                </select>
              </div>

              {/* Note (optional) */}
              <div>
                <label htmlFor="modalNote" className="block text-xs font-semibold text-slate-700 mb-1">
                  Note (optional)
                </label>
                <input
                  id="modalNote"
                  type="text"
                  maxLength={500}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Paid cash at cafe"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submittingPayment ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      Saving...
                    </>
                  ) : (
                    "Confirm & Record"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
