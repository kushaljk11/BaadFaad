/**
 * @fileoverview Create Split Page
 * @description Frictionless wizard for starting a new bill-splitting session.
 *              Key Features:
 *              - Friendly name input
 *              - Split method selector: Equal, Percentage, Custom, Item-based
 *              - Fast participant addition via ParticipantEntry (type + Enter)
 *              - LoadingButton with double-submission protection
 *
 * @module pages/split/CreateSplit
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import {
  FaReceipt,
  FaQrcode,
  FaUserFriends,
  FaBalanceScale,
  FaPercentage,
  FaListUl,
  FaEdit,
  FaArrowRight,
} from "react-icons/fa";
import api from "../../config/config";
import toast, { Toaster } from "react-hot-toast";
import LoadingButton from "../../components/common/LoadingButton";
import ParticipantEntry from "../../components/common/ParticipantEntry";

const SPLIT_METHODS = [
  {
    id: "equal",
    title: "Equal Split",
    desc: "Divide total evenly among everyone",
    icon: FaBalanceScale,
  },
  {
    id: "item_based",
    title: "Item-by-Item",
    desc: "Assign specific receipt dishes or items",
    icon: FaListUl,
  },
  {
    id: "percentage",
    title: "By Percentage",
    desc: "Split according to custom percentages (100%)",
    icon: FaPercentage,
  },
  {
    id: "custom",
    title: "Custom Amounts",
    desc: "Specify exact amounts for each person",
    icon: FaEdit,
  },
];

export default function CreateSplit() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [splitName, setSplitName] = useState("");
  const [splitType, setSplitType] = useState("equal");
  const [participants, setParticipants] = useState([]);
  const [mode, setMode] = useState("session"); // 'session' or 'group'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const trimmed = splitName.trim();
    if (!trimmed) {
      setError("Please give your bill split a name (e.g. Dinner at Dalle)");
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
      const splitRes = await api.post("/splits", {
        splitType,
        totalAmount: 0,
        name: trimmed,
        participants: participants.map((p) => ({ name: p.name })),
      });
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
        toast.success("Session created!");
        navigate(
          `/split/ready?splitId=${split._id}&sessionId=${session._id}&type=session&invite=${encodeURIComponent(
            inviteToken || ""
          )}`
        );
      }
    } catch (err) {
      console.error("Failed to create split:", err);
      const msg = err.response?.data?.message || "Failed to create split. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Toaster position="top-center" />
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="ml-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Header */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Quick Setup
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Create a Bill Split
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Name your split, choose how to divide it, and invite friends.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6 sm:p-8">
            {/* Split Title */}
            <div>
              <label
                htmlFor="splitName"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Split Name <span className="text-red-500">*</span>
              </label>
              <input
                id="splitName"
                type="text"
                value={splitName}
                onChange={(e) => {
                  setSplitName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="e.g. Friday Dinner, Road Trip, Office Lunch"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-100"
              />
              {error && (
                <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>

            {/* Split Type Selector */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Split Method
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SPLIT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSelected = splitType === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSplitType(m.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200 shadow-2xs"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm ${
                          isSelected
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-zinc-100 text-slate-600"
                        }`}
                      >
                        <Icon />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-snug">
                          {m.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">
                          {m.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fast Participant Adding */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Add People (Optional now)
              </label>
              <p className="mb-2 text-xs text-slate-500">
                You can add names now or share a QR code in the next step so friends join directly.
              </p>
              <ParticipantEntry
                participants={participants}
                onChange={setParticipants}
                placeholder="Type friend's name and press Enter..."
              />
            </div>

            {/* Session vs Group Toggle */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Split Type
              </span>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setMode("session")}
                  className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition cursor-pointer ${
                    mode === "session"
                      ? "bg-white text-slate-900 shadow-2xs border border-zinc-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  One-time Split
                </button>
                <button
                  type="button"
                  onClick={() => setMode("group")}
                  className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition cursor-pointer ${
                    mode === "group"
                      ? "bg-white text-slate-900 shadow-2xs border border-zinc-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Keep in a Group
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <LoadingButton
                fullWidth
                size="lg"
                loading={loading}
                loadingText="Creating Split..."
                onClick={handleCreate}
                icon={<FaArrowRight />}
              >
                Share QR and Scan Bills
              </LoadingButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
