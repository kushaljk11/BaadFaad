// ...existing code...

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaCheckCircle,
  FaRegPaperPlane,
  FaWallet,
  FaSpinner,
  FaTimesCircle,
  FaHourglassHalf,
  FaArrowRight,
} from "react-icons/fa";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import api from "../../config/config";
import toast, { Toaster } from "react-hot-toast";
import useSessionSocket, { emitHostNavigate } from "../../hooks/useSessionSocket";
import socket from "../../config/socket";
// ...existing code...


const AVATAR_COLORS = [
  "bg-emerald-200",
  "bg-zinc-300",
  "bg-amber-200",
  "bg-violet-200",
  "bg-blue-200",
  "bg-rose-200",
];

const STATUS_OPTIONS = ["unpaid", "partial", "paid"];

function statusBadge(status) {
  switch (status) {
    case "paid":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          <FaCheckCircle className="text-[10px]" /> Paid
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
          <FaHourglassHalf className="text-[10px]" /> Partial
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
          <FaTimesCircle className="text-[10px]" /> Unpaid
        </span>
      );
  }
}

export default function SplitBreakdown() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [split, setSplit] = useState(null);
  const [session, setSession] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [notifying, setNotifying] = useState(false);
  const [updatingIdx, setUpdatingIdx] = useState(null);
  const [inlinePayments, setInlinePayments] = useState({});
  const ensureMembersRequestedRef = useRef(new Set());
  const amountUpdateTimersRef = useRef({});
  const dirtyAmountIndexesRef = useRef(new Set());

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const roomId = type === 'group' ? groupId : sessionId;

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserId = storedUser?._id || storedUser?.id;

  const fetchSplit = useCallback(async () => {
    try {
      if (splitId) {
        // Add cache-busting to bypass any stale service-worker cache
        const splitRes = await api.get(`/splits/${splitId}`, { headers: { 'Cache-Control': 'no-cache' } });
        const latestSplit = splitRes.data.split;
        setSplit(latestSplit);
        return latestSplit;
      }
    } catch {
      toast.error("Failed to load split data");
    }
    return null;
  }, [splitId]);

  useEffect(() => {
    const fetchData = async () => {
      // First fetch split data
      const latestSplit = await fetchSplit();

      // For group splits: if we know group members and server breakdown is missing members,
      // call ensure-members to reconcile. Avoid calling ensure-members blindly (it caused server 500s).
      try {
        if (type === 'group' && splitId && groupId) {
          // fetch group members so we can compare
          const groupRes = await api.get(`/groups/${groupId}`);
          const grp = groupRes.data.data || groupRes.data;
          const members = grp.members || [];
          setGroupMembers(members);
          // If server breakdown has fewer entries than group members, ask server to reconcile once.
          const currentBreakdown = (latestSplit && latestSplit.breakdown) || [];
          const ensureKey = `${splitId}:${groupId}`;
          if (members.length > currentBreakdown.length && !ensureMembersRequestedRef.current.has(ensureKey)) {
            try {
              ensureMembersRequestedRef.current.add(ensureKey);
              await api.post(`/splits/${splitId}/ensure-members`);
              // re-fetch split after reconciliation
              await fetchSplit();
            } catch (e) {
              console.warn('ensure-members failed (non-fatal):', e?.response?.data?.message || e?.message);
            }
          }
        }
      } catch (e) {
        // group fetch may fail; continue gracefully
        console.warn('Failed to load group members for breakdown', e);
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

  // Determine if current user is the host (first participant in session)
  const sessionParticipants = session?.session?.participants || session?.participants || [];
  const firstParticipant = sessionParticipants[0];
  const hostUserId =
    typeof firstParticipant === "object"
      ? firstParticipant.user?._id || firstParticipant.user || firstParticipant._id
      : firstParticipant;
  const isHost = currentUserId && String(hostUserId) === String(currentUserId);

  // Socket: listen for host-navigate so non-host users get redirected
  const onHostNavigate = useCallback(
    (data) => {
      if (data?.path) navigate(data.path);
    },
    [navigate]
  );

  const onParticipantJoined = useCallback((data) => {
    // When participants join, refetch split so breakdown updates (group joins)
    if (data?.participants) {
      fetchSplit();
    }
  }, [fetchSplit]);

  useSessionSocket(roomId || sessionId, onParticipantJoined, onHostNavigate, null);

  // Listen for split-updated events (emitted when group join triggers a recalc)
  useEffect(() => {
    if (!roomId) return;
    const handler = (data) => {
      if (data?.splitId && String(data.splitId) === String(splitId)) {
        fetchSplit();
      }
    };

    try {
      socket.on('split-updated', handler);
    } catch (e) {
      console.warn('Failed to subscribe to split-updated', e);
    }

    return () => {
      try { socket.off('split-updated', handler); } catch (e) {}
    };
  }, [roomId, splitId, fetchSplit]);

  const totalAmount = split?.totalAmount || 0;
  const breakdown = useMemo(() => split?.breakdown || [], [split?.breakdown]);

  // If group mode, ensure we display all group members even if split.breakdown has only host
  const mergedParticipants = useMemo(() => {
    if (type === 'group' && groupMembers && groupMembers.length > 0) {
      const equalShare = totalAmount > 0 ? Math.round((totalAmount / groupMembers.length) * 100) / 100 : 0;
      return groupMembers.map((m) => {
        const id = String(m._id || m.id || m);
        const found = breakdown.find((b) => {
          const bid = String(b.user?._id || b.user || b.participant?._id || b.participant || b._id || b.id || '');
          return bid === id;
        });
        if (found) return found;
        // Member is in the group but not yet in server breakdown — show their equal share
        // (This is a display-only fallback; ensure-members will reconcile moments after load)
        return {
          name: m.fullName || m.name || m.email || 'Participant',
          amount: equalShare,
          amountPaid: 0,
          paymentStatus: 'unpaid',
          email: m.email || '',
          _missingFromBreakdown: true,
        };
      });
    }
    return breakdown;
  }, [type, groupMembers, breakdown, totalAmount]);

  const participantCount = mergedParticipants.length;

  // Initialize inline payment form per displayed participant
  const lastInitRef = useRef(null);
  useEffect(() => {
    const init = {};
    mergedParticipants.forEach((m, idx) => {
      init[idx] = {
        amount: Number(m.amountPaid || 0),
      };
    });

    try {
      const asString = JSON.stringify(init);
      if (lastInitRef.current !== asString) {
        lastInitRef.current = asString;
        setInlinePayments(init);
      }
    } catch (e) {
      // Fallback: always set if stringify fails
      setInlinePayments(init);
    }
  }, [mergedParticipants, lastInitRef]);

  // --- Host: update a participant's amountPaid / paymentStatus ---
  const handlePaymentUpdate = async (index, field, value) => {
    if (!splitId) return;

    await commitPaymentUpdate(index, field, value);
  };

  const commitPaymentUpdate = async (index, field, value) => {
    setUpdatingIdx(index);
    try {
      // Map displayed index (which may be merged with group members) to server breakdown index
      const findServerIndex = (displayIndex) => {
        const displayed = type === 'group' && groupMembers && groupMembers.length > 0
          ? groupMembers[displayIndex]
          : breakdown[displayIndex];

        if (!displayed) return -1;

        // Try to match by user/participant id or by name/email
        for (let i = 0; i < (breakdown || []).length; i++) {
          const b = breakdown[i];
          const bid = b?.user?._id || b?.user || b?.participant?._id || b?.participant || b?._id || '';
          const dispId = displayed._id || displayed.id || displayed.user || displayed.participant || '';
          if (String(bid) === String(dispId)) return i;
          const bname = String(b?.name || '').toLowerCase();
          const dname = String(displayed.fullName || displayed.name || displayed.email || displayed).toLowerCase();
          if (bname && dname && bname === dname) return i;
        }
        return -1;
      };

      let serverIndex = findServerIndex(index);

      // If not found, attempt to force server to recalculate split from group/session members
      if (serverIndex === -1 && type === 'group') {
        try {
          await api.put(`/splits/${splitId}`, { totalAmount: split?.totalAmount });
          await fetchSplit();
          serverIndex = findServerIndex(index);
        } catch (e) {
          // ignore and handle below
        }
      }

      if (serverIndex === -1) {
        // Try server-side ensure-members endpoint as a last resort
        try {
          await api.post(`/splits/${splitId}/ensure-members`);
          await fetchSplit();
          serverIndex = findServerIndex(index);
        } catch (e) {
          // ignore and error below
        }

        if (serverIndex === -1) {
          throw new Error('Participant not present on server yet. Try refreshing or ask host to recalculate split.');
        }
      }

      const body = {};
      if (field === "amountPaid") {
        body.amountPaid = Number(value) || 0;
      } else if (field === "paymentStatus") {
        body.paymentStatus = value;
      }
      await api.put(`/splits/${splitId}/participant/${serverIndex}`, body);
      await fetchSplit();
      if (field === "amountPaid") {
        try {
          dirtyAmountIndexesRef.current.delete(index);
        } catch (e) {}
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update payment");
    } finally {
      setUpdatingIdx(null);
    }
  };

  const queueAmountPaidUpdate = (index, amountValue) => {
    try {
      const timers = amountUpdateTimersRef.current;
      if (timers[index]) {
        clearTimeout(timers[index]);
      }
      dirtyAmountIndexesRef.current.add(index);
      timers[index] = setTimeout(() => {
        handlePaymentUpdate(index, "amountPaid", Number(amountValue) || 0);
        delete timers[index];
      }, 350);
    } catch (e) {}
  };

  const flushPendingAmountUpdates = async () => {
    const dirty = Array.from(dirtyAmountIndexesRef.current || []);
    if (!dirty.length) return;

    // Cancel timers first, then force-save all dirty rows before navigation.
    const timers = amountUpdateTimersRef.current || {};
    dirty.forEach((idx) => {
      if (timers[idx]) {
        clearTimeout(timers[idx]);
        delete timers[idx];
      }
    });

    for (const idx of dirty) {
      const amount = Number(inlinePayments[idx]?.amount || 0);
      await handlePaymentUpdate(idx, "amountPaid", amount);
    }
  };

  useEffect(() => {
    const timers = amountUpdateTimersRef.current;
    return () => {
      Object.keys(timers).forEach((k) => {
        try {
          clearTimeout(timers[k]);
        } catch (e) {}
      });
    };
  }, []);

  const updateInline = (idx, field, value) => {
    setInlinePayments((prev) => ({ ...prev, [idx]: { ...(prev[idx] || {}), [field]: value } }));
  };

  // --- Notify all participants via detailed split-summary email ---
  const handleNotifyAll = async () => {
    if (!split?._id || breakdown.length === 0) {
      toast.error("No split data to notify about");
      return;
    }

    setNotifying(true);
    const toastId = toast.loading("Sending split summary emails...");

    try {
      await flushPendingAmountUpdates();

      let finalizeWarning = "";
      if (String(split?.status || "").toLowerCase() !== "finalized") {
        try {
          await api.post(`/splits/${split._id}/finalize`);
        } catch (finalizeErr) {
          const msg =
            finalizeErr?.response?.data?.message ||
            finalizeErr?.message ||
            "";
          // If already finalized, allow summary emails to continue.
          if (!String(msg).toLowerCase().includes("already finalized")) {
            finalizeWarning = msg || "Failed to finalize split";
          }
        }
      }

      const payerCandidates = (breakdown || []).map((b) => ({
        name: b.name || b.user?.name || b.participant?.name || "Participant",
        amountPaid: Number(b.amountPaid || 0),
      }));
      const totalBill = Number(totalAmount || 0);
      let collector = payerCandidates.find((p) => totalBill > 0 && p.amountPaid >= totalBill);
      if (!collector) {
        collector = payerCandidates
          .slice()
          .sort((a, b) => Number(b.amountPaid || 0) - Number(a.amountPaid || 0))[0];
      }
      const payToName = collector && Number(collector.amountPaid || 0) > 0 ? collector.name : "";

      const memberEmailById = new Map(
        (groupMembers || []).map((m) => [String(m?._id || m?.id || ""), String(m?.email || "").trim()])
      );
      const memberEmailByName = new Map(
        (groupMembers || [])
          .map((m) => ({
            key: String(m?.fullName || m?.name || m?.email || "").trim().toLowerCase(),
            email: String(m?.email || "").trim(),
          }))
          .filter((x) => x.key && x.email)
          .map((x) => [x.key, x.email])
      );

      const summaryBreakdown = breakdown.map((b) => {
        const name = b.name || b.user?.name || b.participant?.name || "Participant";
        const entryId = String(b.user?._id || b.user || b.participant?._id || b.participant || b._id || "");
        const email =
          b.email ||
          b.user?.email ||
          b.participant?.email ||
          memberEmailById.get(entryId) ||
          memberEmailByName.get(String(name).trim().toLowerCase()) ||
          "";
        const amountPaid = b.amountPaid || 0;
        const balanceDue = Math.max(0, b.amount - amountPaid);
        return {
          name,
          email,
          share: b.amount,
          amountPaid,
          balanceDue,
          paidByName: balanceDue > 0 ? payToName : "",
        };
      });

      const res = await api.post(
        "/nudge/split-summary",
        {
          splitId: split._id,
          groupName: session?.name || session?.session?.name || "Split",
          totalAmount,
          breakdown: summaryBreakdown,
        },
        {
          timeout: 60000,
        }
      );

      toast.dismiss(toastId);

      const sent = Number(res?.data?.sent ?? res?.data?.data?.sent ?? 0);
      const failed = Number(res?.data?.failed ?? res?.data?.data?.failed ?? 0);
      const failures = res?.data?.failures || res?.data?.data?.failures || [];
      if (sent > 0) {
        toast.success(`Sent summary to ${sent} participant${sent > 1 ? "s" : ""}!`, {
          duration: 4000,
        });
      }
      if (failed > 0) {
        const firstFailure = failures[0]?.error ? ` (${failures[0].error})` : "";
        toast.error(`Failed to send ${failed} email${failed > 1 ? "s" : ""}${firstFailure}`, { duration: 4500 });
      }
      if (sent === 0 && failed === 0) {
        toast.success("Split finalized! No emails to send (no emails on file).", { duration: 3000 });
      }
      if (finalizeWarning) {
        toast.error(`Emails sent, but finalize had an issue: ${finalizeWarning}`, { duration: 4500 });
      }
    } catch (err) {
      toast.dismiss(toastId);
      if (err?.code === "ECONNABORTED") {
        toast.error("Notification request timed out. Emails may still be processing on server.", { duration: 5000 });
      } else {
        toast.error(err.response?.data?.message || "Failed to send notifications", { duration: 4000 });
      }
    } finally {
      setNotifying(false);
    }
  };

  // --- Continue to SplitCalculated page (host navigates everyone) ---
  const handleContinue = async () => {
    if (isHost) {
      await flushPendingAmountUpdates();
    }
    const targetPath = `/split/calculated?splitId=${splitId}&sessionId=${sessionId}&type=${type}${groupId ? `&groupId=${groupId}` : ''}`;
    const roomId = type === 'group' ? groupId : sessionId;
    emitHostNavigate(roomId, targetPath);
    navigate(targetPath);
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster position="top-right" reverseOrder={false} />
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} disableInteraction={true} />

      <main className="ml-0 mx-auto w-full max-w-6xl px-7 py-8 pt-24 md:ml-56 md:pt-8 sm:mt-10">
        <h1 className="text-3xl font-bold text-slate-900">Split Breakdown</h1>
        <p className="mt-2 text-sm text-slate-500">
          Detailed breakdown of shared expenses
          {!isHost && " — the host can update payment status"}
        </p>

        {/* ── Total Bill Card ── */}
        <section className="mt-6 overflow-hidden rounded-4xl border border-emerald-100 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
            <div className="flex items-center justify-center bg-emerald-100 p-8 text-emerald-500">
              <FaWallet className="text-5xl" />
            </div>
            <div className="p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                Total Bill Amount
              </p>
              <p className="mt-1 text-4xl font-bold text-slate-900">Rs {(Math.round(totalAmount / 10) * 10).toLocaleString()}</p>
              <p className="mt-2 text-sm text-slate-500">
                Split equally among {participantCount} participant{participantCount !== 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">Live participants: {participantCount}</p>
            </div>
          </div>
        </section>

        {/* ── Participants ── */}
        <section className="mt-8">
          <h2 className="text-3xl font-bold text-slate-900">Participants Details</h2>

          <div className="mt-4 space-y-3">
            {mergedParticipants.map((b, i) => {
              const name = b.name || b.user?.name || b.participant?.name || `Participant ${i + 1}`;
              const initials = name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const amountPaid = b.amountPaid || 0;
              const due = Math.max(0, b.amount - amountPaid);
              const paymentStatus = b.paymentStatus || "unpaid";
              const avatarBg = AVATAR_COLORS[i % AVATAR_COLORS.length];

              return (
                <article
                  key={i}
                  className="rounded-4xl border border-emerald-100 bg-white px-5 py-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    {/* Left: avatar + name */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-slate-700 ${avatarBg}`}
                      >
                        {initials}
                      </span>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{name}</p>
                        <p className="text-sm text-slate-400">
                          Total Share: Rs {b.amount?.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Right: payment info */}
                    <div className="flex flex-wrap items-center gap-6">
                      {/* Amount Paid (inline) */}
                      <div className="min-w-44">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Amount Paid
                        </p>
                        {isHost ? (
                            <div className="mt-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={inlinePayments[i]?.amount ?? ''}
                                  onChange={(e) => {
                                    const nextAmount = Number(e.target.value || 0);
                                    updateInline(i, 'amount', nextAmount);
                                    queueAmountPaidUpdate(i, nextAmount);
                                  }}
                                  onBlur={() => {
                                    const timers = amountUpdateTimersRef.current || {};
                                    if (timers[i]) {
                                      clearTimeout(timers[i]);
                                      delete timers[i];
                                    }
                                    handlePaymentUpdate(i, 'amountPaid', Number(inlinePayments[i]?.amount || 0));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-28 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                                />
                                <div className="text-xs text-slate-400">Rs {amountPaid.toLocaleString()}</div>
                              </div>
                              </div>
                          ) : (
                            <div className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-bold text-slate-700">
                              Rs {amountPaid.toLocaleString()}
                            </div>
                          )}
                      </div>

                      {/* Status */}
                      <div className="min-w-28">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </p>
                        {isHost ? (
                          <select
                            value={paymentStatus}
                            disabled={updatingIdx === i}
                            onChange={(e) => handlePaymentUpdate(i, 'paymentStatus', e.target.value)}
                            className="mt-1 cursor-pointer rounded-full border border-emerald-200 bg-zinc-50 px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="mt-1">{statusBadge(paymentStatus)}</div>
                        )}
                      </div>

                      {/* Balance Due (read-only for everyone) */}
                      <div className="min-w-24">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Balance Due
                        </p>
                        {b.amount > 0 && due === 0 ? (
                          <p className="mt-1 text-2xl font-bold text-emerald-500">Settled</p>
                        ) : due > 0 ? (
                          <p className="mt-1 text-2xl font-bold text-red-500">
                            +Rs {due.toLocaleString()}
                          </p>
                        ) : (
                          <p className="mt-1 text-2xl font-bold text-slate-400">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Bottom Action ── */}
        <section className="mt-8 rounded-4xl bg-linear-to-r from-slate-950 to-slate-900 px-6 py-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-3xl font-bold">Almost done!</p>
              <p className="mt-1 text-sm text-slate-300">
                {isHost
                  ? "Notify participants about their share, then continue."
                  : "Waiting for the host to continue..."}
              </p>
            </div>

            {isHost ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleNotifyAll}
                  disabled={notifying}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 cursor-pointer py-3 text-base font-bold text-slate-900 shadow-lg shadow-amber-300/40 disabled:opacity-50"
                >
                  {notifying ? <FaSpinner className="animate-spin text-xs" /> : <FaRegPaperPlane className="text-xs" />}
                  Notify All
                </button>

                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 cursor-pointer py-3 text-base font-bold text-white shadow-lg shadow-emerald-300/40"
                >
                  Continue
                  <FaArrowRight className="text-xs" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <FaSpinner className="animate-spin" />
                <span className="text-sm font-medium">Waiting for host...</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
