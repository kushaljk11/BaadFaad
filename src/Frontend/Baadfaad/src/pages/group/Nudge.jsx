/**
 * @fileoverview Nudge (Payment Reminder) Page
 * @description Manages payment reminder nudges for a specific group.
 *              Displays a list of all nudges sent within the group, shows
 *              their delivery status, and allows sending new nudge emails
 *              to members who haven't paid yet. Includes status indicators
 *              (sent, acknowledged, pending) with timestamps.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/group/Nudge
 */
import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import api from "../../config/config";
import toast from "react-hot-toast";
import { FaSpinner, FaCheckCircle, FaPaperPlane, FaUserSecret, FaUserCircle, FaRegClock } from "react-icons/fa";
import { formatNPR } from "../../utills/formatNPR";

export default function Nudge() {
  const { groupId } = useParams();
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [splitData, setSplitData] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = storedUser?._id || storedUser?.id || "";

  const isHost = String(group?.createdBy?._id || group?.createdBy || "") === String(currentUserId);
  const myParticipant = (splitData?.breakdown || []).find(
    (b) => String(b.user?._id || b.user?.id || b.user || b._id || "") === String(currentUserId)
  );
  const isCreditor = Number(myParticipant?.netBalance || 0) > 0;
  const canCurrentUserNudge = isHost || isCreditor;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If we have a groupId, fetch group and its split to get breakdown
        if (groupId) {
          const groupRes = await api.get(`/groups/${groupId}`);
          const groupData = groupRes.data?.data || groupRes.data;
          setGroup(groupData);

          const splitId = groupData?.splitId;
          if (splitId) {
            const splitRes = await api.get(`/splits/${splitId}`);
            const split = splitRes.data?.split || splitRes.data;
            setSplitData(split);
            const breakdown = split?.breakdown || [];
            const memberEmailById = new Map(
              (groupData?.members || []).map((m) => [String(m?._id || m?.id || ""), String(m?.email || "").trim()])
            );

            const mapped = breakdown.map((b) => {
              const participantId = String(
                b.user?._id || b.user || b.participant?._id || b.participant || b._id || ""
              );
              const name = b.name || b.user?.name || b.participant?.name || "Participant";
              const email =
                b.email ||
                b.user?.email ||
                b.participant?.email ||
                memberEmailById.get(participantId) ||
                "";
              const share = b.expenseShare ?? b.shareAmount ?? b.amount ?? 0;
              const merchantPaid = b.merchantContribution ?? b.paidAmount ?? 0;
              const netBalance = b.netBalance !== undefined ? b.netBalance : (merchantPaid - share);
              const isDebtor = netBalance < 0;
              const due = isDebtor
                ? (b.reimbursementRemaining !== undefined ? b.reimbursementRemaining : Math.abs(netBalance))
                : 0;
              const isSettled = !isDebtor || due <= 0 || b.paymentStatus === "paid";
              const canNudge = canCurrentUserNudge && !isSettled && Boolean(String(email).trim());
              return {
                _id: b.participant || b.user?._id || b._id,
                splitParticipantId: b._id,
                name,
                email,
                share,
                paid: merchantPaid,
                reimbursementPaid: b.reimbursementPaid || 0,
                due,
                netBalance,
                paidByName: b.paidByName || '',
                status: isSettled ? (netBalance > 0 ? "Creditor (To Receive)" : "Fully Settled") : "Pending Reimbursement",
                amount: formatNPR(due),
                pending: !isSettled,
                action: isSettled ? "Settled" : canNudge ? "Anonymous Nudge" : "No Email",
                actionStyle: isSettled
                  ? "bg-zinc-100 text-slate-400"
                  : canNudge
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-orange-100 text-orange-700",
              };
            });
            setMembers(mapped);
          }
        } else {
          // Fallback: get participants from API
          const res = await api.get("/participants");
          const participantList = res.data?.participants || res.data || [];
          const mapped = participantList.map((p) => ({
            _id: p._id,
            name: p.name,
            email: p.email || "",
            share: p.share || 0,
            paid: p.paid || 0,
            due: Math.max(0, (p.share || 0) - (p.paid || 0)),
            status: p.isHost ? "Fully Settled" : "Pending Payment",
            amount: formatNPR(Math.max(0, (p.share || 0) - (p.paid || 0))),
            pending: !p.isHost,
            action: p.isHost ? "Settled" : "Anonymous Nudge",
            actionStyle: p.isHost
              ? "bg-zinc-100 text-slate-400"
              : "bg-emerald-100 text-emerald-700",
          }));
          setMembers(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        toast.error("Failed to load nudge data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [groupId]);

  const handleSendNudge = async (member) => {
    if (!member.email) {
      toast.error(`${member.name} has no email address. Add an email to send nudge.`);
      return false;
    }
    if (member.action === "Settled" || member.action === "Nudge Sent") return false;

    if (!canCurrentUserNudge) {
      toast.error(highestPayerPaid > 0 ? "Only the highest payer can send nudges right now." : "Only the group host can send nudges right now.");
      return false;
    }

    const nudgeAmount = member.due || member.share || 0;
    if (nudgeAmount <= 0) {
      toast.error(`${member.name} has no pending balance to nudge about`);
      return;
    }

    setSendingId(member._id);
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const hostName = userData.name || userData.fullName || "Your friend";
      const senderEmail = userData.email || userData.emails?.[0] || '';
      const senderId = userData._id || userData.id || '';

      const response = await api.post(
        "/nudge/send",
        {
          recipientName: member.name,
          recipientEmail: member.email,
          senderName: hostName,
          senderEmail,
          senderId,
          splitId: splitData?._id || null,
          groupId: group?._id || null,
          groupName: group?.name || "Split Group",
          amount: nudgeAmount,
          currency: group?.defaultCurrency || "NPR",
          payLink: `${window.location.origin}/group/${group?._id || groupId}/settlement`,
          paidByName: member.paidByName || '',
          splitParticipantId: member.splitParticipantId,
        },
        {
          timeout: 60000,
        },
      );

      const delivered = response?.data?.delivered !== false;
      if (!delivered) {
        toast.error(response?.data?.message || `Nudge was not delivered to ${member.name}`);
        return false;
      }

      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m._id === member._id
            ? { ...m, action: "Nudge Sent", actionStyle: "bg-zinc-100 text-slate-400" }
            : m
        )
      );
      toast.success(`Nudge sent to ${member.name}!`);
      return true;
    } catch (err) {
      console.error("Failed to send nudge:", err);
      if (err?.code === "ECONNABORTED") {
        toast.error(`Nudge timed out for ${member.name}. Mailjet is slow or unreachable right now.`);
      } else {
        toast.error(err?.response?.data?.message || `Failed to send nudge to ${member.name}`);
      }
      return false;
    } finally {
      setSendingId(null);
    }
  };

  const handleNudgeAll = async () => {
    setSendingAll(true);
    const pending = members.filter((m) => m.pending && m.action === "Anonymous Nudge");
    if (pending.length === 0) {
      toast("No pending members to nudge", { icon: "\u2139\uFE0F" });
      setSendingAll(false);
      return;
    }

    if (!canCurrentUserNudge) {
      toast.error(highestPayerPaid > 0 ? "Only the highest payer can send nudges right now." : "Only the group host can send nudges right now.");
      setSendingAll(false);
      return;
    }

    let deliveredCount = 0;
    let failedCount = 0;
    for (const member of pending) {
      const delivered = await handleSendNudge(member);
      if (delivered) deliveredCount++;
      else failedCount++;
    }
    if (deliveredCount > 0) {
      toast.success(`Nudged ${deliveredCount} pending member${deliveredCount > 1 ? "s" : ""}!`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} nudge${failedCount > 1 ? "s" : ""} could not be delivered`);
    }
    setSendingAll(false);
  };

  const settledCount = members.filter((m) => !m.pending).length;
  const totalCount = members.length;
  const pendingCount = totalCount - settledCount;
  const progressPct = totalCount > 0 ? Math.round((settledCount / totalCount) * 100) : 0;

  // Total Group Balance = total split amount, Settled = total paid so far
  const totalBalance = splitData?.totalAmount || members.reduce((sum, m) => sum + (m.share || 0), 0);
  const settledBalance = members.reduce((sum, m) => sum + (m.paid || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <FaSpinner className="animate-spin text-4xl text-emerald-500" aria-label="Loading" />
      </div>
    );
  }

  return (
    <DashboardShell
      hideBottomNav={true}
      title="Payment Reminders"
      backTo={groupId ? `/group/${groupId}/settlement` : "/group"}
      mainClassName="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-8"
    >
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl wrap-break-word">
              Awkwardness Shield
            </h1>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
              Let us do the heavy lifting. We&apos;ll send neutral reminders
              to your friends so you don&apos;t have to. Reminders are sent by
              BaadFaad, keeping things professional and stress-free.
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold tracking-wider text-slate-600">
              GROUP PROGRESS
            </p>
            <p className="text-3xl font-semibold text-emerald-800 sm:text-5xl">{progressPct}%</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="rounded-[1.8rem] border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Total Group Balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl md:text-4xl wrap-break-word">{formatNPR(totalBalance, { decimals: 0 })}</p>
          </article>

          <article className="rounded-[1.8rem] border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Settled So Far
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800 sm:text-3xl md:text-4xl wrap-break-word">{formatNPR(settledBalance, { decimals: 0 })}</p>
          </article>

          <article className="rounded-[1.8rem] border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <p>{settledCount} of {totalCount} Participants</p>
              <p>{pendingCount} Pending</p>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
            </div>
          </article>
        </div>

        <article className="mt-5 rounded-[1.8rem] bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <FaCheckCircle className="mt-0.5 text-emerald-400" aria-hidden="true" />
            <div>
              <p className="font-semibold">Friendly Reminder Policy</p>
              <p className="mt-1 text-sm text-slate-300">
                Nudges are sent by BaadFaad system accounts. The recipient
                won&apos;t see who triggered the reminder, making it a neutral
                experience for everyone.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Settlement Status</h2>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleNudgeAll}
              disabled={sendingAll}
              aria-label="Send payment reminder to all pending members"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {sendingAll ? <FaSpinner className="animate-spin text-xs" aria-hidden="true" /> : <FaPaperPlane className="text-xs" aria-hidden="true" />}
              Nudge All Pending
            </button>
            <p className="text-xs text-slate-700">Nudges are sent anonymously by the system</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {members.map((member, idx) => (
            <article
              key={`${member._id || "member"}-${member.email || member.name || idx}-${idx}`}
              className="rounded-[1.8rem] border border-emerald-100 bg-white px-4 py-4 sm:px-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-slate-500">
                    <FaUserCircle aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{member.name}</p>
                    <p
                      className={`text-xs ${member.pending ? "text-amber-800 font-semibold" : "text-emerald-800 font-semibold"
                        }`}
                    >
                      {member.pending ? (
                        <>
                          <FaRegClock className="mr-1 inline text-[10px]" aria-hidden="true" />
                          {member.status}
                        </>
                      ) : (
                        <>
                          <FaCheckCircle className="mr-1 inline text-[10px]" aria-hidden="true" />
                          {member.status}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4 sm:gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      Amount
                    </p>
                    <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900">
                      {member.amount}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${member.action === "Settled" ? "Already settled" : `Send nudge to ${member.name}`}`}
                    className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold ${member.actionStyle}`}
                    disabled={member.action === "Settled" || member.action === "Nudge Sent" || sendingId === member._id}
                    onClick={() => handleSendNudge(member)}
                  >
                    {sendingId === member._id ? (
                      <FaSpinner className="animate-spin text-[10px]" aria-hidden="true" />
                    ) : member.action !== "Settled" ? (
                      <FaUserSecret className="text-[10px]" aria-hidden="true" />
                    ) : null}
                    {member.action}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-slate-600">
        BaadFaad protects your social relationships by acting as the mediator.
        Reminders are formatted to be helpful system alerts, not demands.
      </p>
    </DashboardShell>
  );
}
