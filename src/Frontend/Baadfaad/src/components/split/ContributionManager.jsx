/**
 * @fileoverview Contribution Manager Component
 * @description Allows the split host to define who actually paid the merchant bill.
 *              Supports Single Payer (100%) and Multiple Payers (exact custom amounts),
 *              with real-time remaining unassigned balance indicators and exact reconciliation.
 *
 * @module components/split/ContributionManager
 */

import React, { useState, useEffect, useMemo } from "react";
import { FaUser, FaUsers, FaCheckCircle, FaExclamationTriangle, FaSave } from "react-icons/fa";
import api from "../../config/config";
import toast from "react-hot-toast";
import { formatNPR } from "../../utills/formatNPR";
import { getContributionSummary } from "../../utills/calculationEngine";
import LoadingButton from "../common/LoadingButton";

export default function ContributionManager({
  split,
  participants = [],
  totalAmount = 0,
  isHost = false,
  onUpdated,
}) {
  const [payerMode, setPayerMode] = useState("single"); // 'single' | 'multiple'
  const [singlePayerId, setSinglePayerId] = useState("");
  const [multiDrafts, setMultiDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  // Initialize from split.contributions or existing participant.paidAmount
  useEffect(() => {
    if (!participants || participants.length === 0) return;

    const existingContribs = split?.contributions || [];
    const nonZeroContribs = participants.filter((p) => Number(p.paidAmount || 0) > 0);

    if (existingContribs.length > 1 || nonZeroContribs.length > 1) {
      setPayerMode("multiple");
      const drafts = {};
      participants.forEach((p) => {
        const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
        drafts[id] = Number(p.paidAmount || 0);
      });
      setMultiDrafts(drafts);
    } else {
      setPayerMode("single");
      const firstPayer = nonZeroContribs[0] || participants[0];
      const initialPayerId = String(
        firstPayer?._id || firstPayer?.id || firstPayer?.user?._id || firstPayer?.user?.id || ""
      );
      setSinglePayerId(initialPayerId);
      const drafts = {};
      participants.forEach((p) => {
        const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
        drafts[id] = id === initialPayerId ? totalAmount : 0;
      });
      setMultiDrafts(drafts);
    }
  }, [split?.contributions, participants, totalAmount]);

  const currentContributions = useMemo(() => {
    if (payerMode === "single") {
      return participants.map((p) => {
        const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
        return {
          participantId: id,
          amount: id === singlePayerId ? totalAmount : 0,
        };
      });
    }

    return participants.map((p) => {
      const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
      return {
        participantId: id,
        amount: Number(multiDrafts[id] ?? 0),
      };
    });
  }, [payerMode, singlePayerId, multiDrafts, participants, totalAmount]);

  const summary = useMemo(() => {
    return getContributionSummary(totalAmount, currentContributions);
  }, [totalAmount, currentContributions]);

  const handleSinglePayerChange = (newPayerId) => {
    setSinglePayerId(newPayerId);
    const drafts = {};
    participants.forEach((p) => {
      const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
      drafts[id] = id === newPayerId ? totalAmount : 0;
    });
    setMultiDrafts(drafts);
  };

  const handleMultiAmountChange = (participantId, val) => {
    const num = Math.max(0, Number(val) || 0);
    setMultiDrafts((prev) => ({
      ...prev,
      [participantId]: num,
    }));
  };

  const handleSave = async () => {
    if (!summary.isExact) {
      toast.error(
        summary.remaining > 0
          ? `Please assign the remaining ${formatNPR(summary.remaining)}`
          : `Contributions exceed total by ${formatNPR(Math.abs(summary.remaining))}`
      );
      return;
    }

    if (!split?._id && !split?.id) return;
    const splitId = split._id || split.id;

    setSaving(true);
    try {
      const payload = {
        contributions: currentContributions.map((c) => ({
          participantId: c.participantId,
          amount: c.amount,
        })),
      };

      const res = await api.put(`/splits/${splitId}/contributions`, payload);
      toast.success("Payer contributions saved successfully!");
      if (onUpdated) onUpdated(res.data?.split);
    } catch (err) {
      console.error("Failed to save contributions:", err);
      toast.error(err.response?.data?.message || "Failed to save contributions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <span>💳</span> Who Paid This Bill?
          </h3>
          <p className="text-xs text-slate-500">
            Define who actually paid the merchant. Net balances will settle between payers and consumers.
          </p>
        </div>

        {isHost && (
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setPayerMode("single");
                handleSinglePayerChange(singlePayerId || participants[0]?._id || "");
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                payerMode === "single" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FaUser className="text-[10px]" />
              <span>One Person</span>
            </button>
            <button
              type="button"
              onClick={() => setPayerMode("multiple")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                payerMode === "multiple" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FaUsers className="text-[10px]" />
              <span>Multiple People</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode-specific content */}
      <div className="mt-4 space-y-3">
        {payerMode === "single" ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Paid full amount ({formatNPR(totalAmount)}) by:
            </label>
            {isHost ? (
              <select
                value={singlePayerId}
                onChange={(e) => handleSinglePayerChange(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-none"
              >
                {participants.map((p) => {
                  const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
                  return (
                    <option key={id} value={id}>
                      {p.name || p.displayName || "Participant"} ({formatNPR(totalAmount)})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-slate-800">
                {participants.find((p) => {
                  const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
                  return id === singlePayerId;
                })?.name || "Host"} paid {formatNPR(totalAmount)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-500">Enter how much each person contributed towards the merchant bill:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {participants.map((p) => {
                const id = String(p._id || p.id || p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || "");
                const val = multiDrafts[id] ?? 0;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {p.name || p.displayName || "Participant"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Share: {formatNPR(p.shareAmount ?? p.amount ?? 0)}
                      </p>
                    </div>
                    {isHost ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-500">रु</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={val === 0 ? "" : val}
                          placeholder="0"
                          onChange={(e) => handleMultiAmountChange(id, e.target.value)}
                          className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-800">
                        {formatNPR(val)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Reconciliation Bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-500">Total Bill: </span>
              <span className="font-semibold text-slate-900">{formatNPR(summary.total)}</span>
            </div>
            <div>
              <span className="text-slate-500">Assigned: </span>
              <span className="font-semibold text-emerald-700">{formatNPR(summary.assigned)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {summary.isExact ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <FaCheckCircle className="text-[10px]" /> Reconciled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                <FaExclamationTriangle className="text-[10px]" />
                {summary.remaining > 0 ? `Remaining: ${formatNPR(summary.remaining)}` : `Over: ${formatNPR(Math.abs(summary.remaining))}`}
              </span>
            )}

            {isHost && (
              <LoadingButton
                size="sm"
                loading={saving}
                disabled={!summary.isExact || saving}
                onClick={handleSave}
                icon={<FaSave className="text-[10px]" />}
              >
                Save Contribution
              </LoadingButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
