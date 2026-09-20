/**
 * @fileoverview Mobile-First Create Split Page
 * @description Streamlined mobile journey for setting up a bill split:
 *              - Back navigation in header
 *              - Clean un-boxed sections with clear typography
 *              - Compact thumb-friendly split method selectors
 *              - Rapid inline participant entry with Enter key
 *              - Sticky bottom action bar respecting iOS safe areas
 *
 * @module pages/split/CreateSplit
 */

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import {
  FaBalanceScale,
  FaPercentage,
  FaListUl,
  FaCoins,
  FaArrowRight,
  FaCheck,
  FaExclamationCircle,
  FaChevronLeft,
} from "react-icons/fa";
import api from "../../config/config";
import toast, { Toaster } from "react-hot-toast";
import LoadingButton from "../../components/common/LoadingButton";
import ParticipantEntry from "../../components/common/ParticipantEntry";

const SPLIT_METHODS = [
  {
    id: "equal",
    title: "Equal",
    desc: "Split evenly among all",
    icon: FaBalanceScale,
  },
  {
    id: "item_based",
    title: "By item",
    desc: "Choose who had each item",
    icon: FaListUl,
  },
  {
    id: "percentage",
    title: "Percentage",
    desc: "Set percentage shares",
    icon: FaPercentage,
  },
  {
    id: "custom",
    title: "Custom",
    desc: "Enter exact amounts",
    icon: FaCoins,
  },
];

export default function CreateSplit() {
  const navigate = useNavigate();
  const [splitName, setSplitName] = useState("");
  const [splitType, setSplitType] = useState("equal");
  const [participants, setParticipants] = useState([]);
  const [mode, setMode] = useState("session"); // 'session' or 'group'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const trimmed = splitName.trim();
    if (!trimmed) {
      setError("Please enter a name for your split (e.g. Dinner at Bota)");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = userData._id || userData.id;

      if (mode === "group") {
        const userEmail = String(userData.email || "").toLowerCase();
        const isOAuthUser = Boolean(userEmail) && !userEmail.endsWith("@local");

        if (!isOAuthUser) {
          toast.error("Groups require Google login");
          navigate("/login", {
            state: { from: { pathname: "/split/create", search: "?type=group" } },
          });
          return;
        }
      }

      // 1. Create Split Record
      const splitPayload = {
        splitType,
        totalAmount: 0,
        name: trimmed,
      };

      const validParticipants = (participants || [])
        .filter((p) => p && p.name && p.name.trim())
        .map((p) => ({ name: p.name.trim() }));

      if (validParticipants.length > 0) {
        splitPayload.participants = validParticipants;
      }

      const splitRes = await api.post("/splits", splitPayload);
      const split = splitRes.data.split;

      // 2. Create Live Session
      const sessionRes = await api.post("/session", {
        name: trimmed,
        splitId: split._id,
        userId,
      });
      const session = sessionRes.data.session;
      const inviteToken = new URL(sessionRes.data.inviteUrl).searchParams.get("invite");

      if (mode === "group") {
        const groupRes = await api.post("/groups", {
          name: trimmed,
          description: `Group created on ${new Date().toLocaleDateString()}`,
          createdBy: userId,
          members: [userId],
          splitId: split._id,
          sessionId: session._id,
        });
        const groupId = groupRes.data?.data?.id || groupRes.data?.data?._id || groupRes.data?.id;

        toast.success("Group split created!");
        navigate(
          `/split/ready?splitId=${split._id}&sessionId=${session._id}&type=group&groupId=${groupId}&invite=${encodeURIComponent(
            inviteToken || ""
          )}`
        );
      } else {
        toast.success("Bill split session created!");
        navigate(
          `/split/ready?splitId=${split._id}&sessionId=${session._id}&type=session&invite=${encodeURIComponent(
            inviteToken || ""
          )}`
        );
      }
    } catch (err) {
      console.error("Failed to create split:", err);
      const fieldErrors = Array.isArray(err.response?.data?.errors)
        ? err.response.data.errors.map((e) => e.message || `${e.field}: invalid`).join(", ")
        : "";
      const msg =
        fieldErrors ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to create split. Please check the details and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell hideBottomNav={true} backTo="/dashboard">
      <Toaster position="top-center" />

      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10 space-y-6">
        {/* Navigation Back Link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors py-1"
        >
          <FaChevronLeft className="text-[10px]" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
            Create split
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Set up the bill and add your friends.
          </p>
        </div>

        {/* Section 1: Split Name */}
        <section className="space-y-2">
          <label
            htmlFor="splitName"
            className="block text-sm font-semibold text-slate-900"
          >
            Split Name <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500">
            e.g. Dinner at Bota, Friday Coffee, Pokhara Trip
          </p>
          <div className="mt-1.5">
            <input
              id="splitName"
              type="text"
              value={splitName}
              onChange={(e) => {
                setSplitName(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && splitName.trim() && !loading) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Enter split name..."
              className={`w-full min-h-11 rounded-xl border px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-colors ${error
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100 bg-red-50/20"
                  : "border-zinc-300 focus:border-emerald-500 focus:ring-emerald-100 bg-white"
                }`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "splitName-error" : undefined}
            />
            {error && (
              <div
                id="splitName-error"
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600"
                role="alert"
              >
                <FaExclamationCircle className="text-xs shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Split Method */}
        <section className="space-y-2 pt-2 border-t border-zinc-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              How do you want to split it?
            </h2>
            <p className="text-xs text-slate-500">
              Choose how the bill will be divided.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
            {SPLIT_METHODS.map((m) => {
              const Icon = m.icon;
              const isSelected = splitType === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSplitType(m.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer min-h-13 touch-manipulation ${isSelected
                      ? "border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-2xs"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
                    }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${isSelected
                        ? "bg-emerald-800 text-white"
                        : "bg-zinc-100 text-slate-600"
                      }`}
                  >
                    <Icon />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {m.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.desc}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-white text-[9px]">
                      <FaCheck />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Add People */}
        <section className="space-y-2 pt-2 border-t border-zinc-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Add people
            </h2>
            <p className="text-xs text-slate-500">
              Add friends now, or share a QR code in the next step.
            </p>
          </div>

          <div className="mt-1.5">
            <ParticipantEntry
              participants={participants}
              onChange={setParticipants}
              placeholder="Friend's name and press Enter..."
            />
          </div>
        </section>

        {/* Section 4: Destination */}
        <section className="space-y-2 pt-2 border-t border-zinc-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Save destination
            </h2>
            <p className="text-xs text-slate-500">
              Choose whether this is a one-time bill or saved into a group.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 mt-1.5">
            <button
              type="button"
              onClick={() => setMode("session")}
              className={`rounded-lg py-2.5 px-3 text-xs font-semibold transition-all cursor-pointer min-h-10 ${mode === "session"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              One-time Split
            </button>
            <button
              type="button"
              onClick={() => setMode("group")}
              className={`rounded-lg py-2.5 px-3 text-xs font-semibold transition-all cursor-pointer min-h-10 ${mode === "group"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Save to Group
            </button>
          </div>
        </section>

        {/* Mobile Sticky / Desktop Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pt-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-slate-600 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </Link>
            <div className="w-full sm:flex-1">
              <LoadingButton
                fullWidth
                size="lg"
                loading={loading}
                loadingText="Creating..."
                onClick={handleCreate}
                icon={<FaArrowRight />}
              >
                Share QR and Scan Bills
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
