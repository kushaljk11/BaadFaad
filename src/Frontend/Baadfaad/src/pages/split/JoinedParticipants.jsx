/**
 * @fileoverview Joined Participants / Session Lobby Page
 * @description Displays all participants who have joined the current session.
 *              Key Features:
 *              - Live real-time participant cards with ConnectionPill
 *              - Host can add local participants directly via fast entry
 *              - Host-controlled progression with sticky mobile CTA
 *              - Accessible leave session action
 *
 * @module pages/split/JoinedParticipants
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaUsers, FaArrowRight, FaQrcode } from "react-icons/fa";
import api from "../../config/config";
import { useAuth } from "../../context/authState";
import useSessionSocket, { emitHostNavigate } from "../../hooks/useSessionSocket";
import toast from "react-hot-toast";
import { ConnectionPill, ParticipantListSkeleton } from "../../components/common/primitives";
import LoadingButton from "../../components/common/LoadingButton";
import ParticipantEntry from "../../components/common/ParticipantEntry";
import { getInitials } from "../../utills/helper";

const AVATAR_PALETTE = [
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-purple-100 text-purple-800 border-purple-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-teal-100 text-teal-800 border-teal-300",
];

export default function SessionLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const roomId = type === "group" ? groupId : sessionId;

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return String(value._id || value.id || "");
    }
    return String(value);
  };

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const normalizedCurrentUserId = normalizeId(user?._id || user?.id || storedUser?._id || storedUser?.id);
  const currentUserName = user?.name || storedUser?.name || "";

  const fetchLobbyData = useCallback(async () => {
    try {
      if (sessionId) {
        const sessionRes = await api.get(`/session/${sessionId}`);
        setSession(sessionRes.data);
      }
      if (type === "group" && groupId) {
        const groupRes = await api.get(`/groups/${groupId}`);
        const grp = groupRes.data.data || groupRes.data;
        setSession({ name: grp.name || "Group", participants: grp.members || [] });
      }
    } catch (err) {
      console.error("Failed to fetch lobby data:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, type, groupId]);

  useEffect(() => {
    fetchLobbyData();
  }, [fetchLobbyData]);

  const handleParticipantJoined = useCallback(
    (data) => {
      if (data?.participants) {
        setSession((prev) => ({ ...(prev || {}), participants: data.participants }));
        if (data.newParticipant?.name) {
          toast.success(`${data.newParticipant.name} joined`);
        }
        return;
      }
      if (data?.session) {
        setSession(data.session);
      }
    },
    []
  );

  const handleHostNavigate = useCallback(
    (data) => {
      if (data.path) {
        navigate(data.path);
      }
    },
    [navigate]
  );

  const { connectionStatus } = useSessionSocket(
    roomId,
    handleParticipantJoined,
    handleHostNavigate,
    null,
    fetchLobbyData
  );

  const rawParticipants = session?.participants || [];
  const uniqueParticipants = [];
  const seenParticipantKeys = new Set();

  rawParticipants.forEach((p, index) => {
    const participantId = normalizeId(p.user || p.participant || p._id || p.id);
    const participantName =
      p.name ||
      p.user?.name ||
      p.participant?.name ||
      p.email ||
      p.user?.email ||
      `Friend ${index + 1}`;

    const key = participantId || `name:${participantName.toLowerCase()}`;
    if (!seenParticipantKeys.has(key)) {
      seenParticipantKeys.add(key);
      const isYou =
        (Boolean(normalizedCurrentUserId) && participantId === normalizedCurrentUserId) ||
        (Boolean(currentUserName) && participantName.toLowerCase() === currentUserName.toLowerCase());

      uniqueParticipants.push({
        id: key,
        name: participantName,
        isHost: index === 0,
        isYou,
      });
    }
  });

  const isCurrentUserHost =
    uniqueParticipants.length > 0 && uniqueParticipants[0].isYou;

  const handleAddParticipant = async (updatedList) => {
    // When host manually adds names from lobby
    const newlyAdded = updatedList[updatedList.length - 1];
    if (newlyAdded && sessionId) {
      try {
        await api.post(`/session/${sessionId}/join`, {
          name: newlyAdded.name,
        });
        fetchLobbyData();
      } catch (e) {
        console.warn("Failed to join participant via API", e);
      }
    }
  };

  const handleContinue = () => {
    const path = `/split/scan?splitId=${splitId}&sessionId=${sessionId}&type=${type}${
      groupId ? `&groupId=${groupId}` : ""
    }`;
    if (roomId) emitHostNavigate(roomId, path);
    navigate(path);
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 pb-24 md:pb-8 overflow-x-hidden w-full">
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6 overflow-x-hidden w-full max-w-full">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Lobby
                </span>
                <ConnectionPill status={connectionStatus} />
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Everyone In?
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {session?.name ? `${session.name} — participants will appear below as they join.` : "Everyone who joins this table will appear below."}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/split/ready?splitId=${splitId}&sessionId=${sessionId}&type=${type}${
                    groupId ? `&groupId=${groupId}` : ""
                  }`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-zinc-50 transition cursor-pointer"
            >
              <FaQrcode />
              <span>Show QR</span>
            </button>
          </div>

          {/* Quick Add Form (For Host) */}
          {isCurrentUserHost && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Quick Add Friend (Without QR)
              </label>
              <ParticipantEntry
                participants={[]}
                onChange={handleAddParticipant}
                placeholder="Type friend's name and press Enter..."
              />
            </div>
          )}

          {/* Participants Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <FaUsers className="text-emerald-500" />
                <span>Participants ({uniqueParticipants.length})</span>
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <ParticipantListSkeleton />
              ) : uniqueParticipants.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <p className="text-sm font-medium">Waiting for participants to join...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {uniqueParticipants.map((p, idx) => {
                    const colorClass =
                      AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3.5 transition hover:border-zinc-200"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${colorClass}`}
                          >
                            {getInitials(p.name)}
                          </span>
                          <div>
                            <span className="text-sm font-semibold text-slate-900">
                              {p.name}
                            </span>
                            {p.isYou && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                You
                              </span>
                            )}
                          </div>
                        </div>

                        {p.isHost ? (
                          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            Host
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            Joined
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3.5 backdrop-blur-md shadow-lg md:left-56">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              {uniqueParticipants.length} people joined
            </p>
            <p className="text-[11px] text-slate-500">
              {isCurrentUserHost ? "Ready to add bill items" : "Waiting for host to begin"}
            </p>
          </div>

          {isCurrentUserHost ? (
            <LoadingButton
              size="lg"
              onClick={handleContinue}
              icon={<FaArrowRight />}
            >
              Scan & Add Items
            </LoadingButton>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              Waiting for host...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
