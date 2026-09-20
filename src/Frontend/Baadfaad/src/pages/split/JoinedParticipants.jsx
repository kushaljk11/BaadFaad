/**
 * @fileoverview Joined Participants / Session Lobby Page
 * @description Displays all participants who have joined the current session.
 *              Each participant is shown with a color-coded avatar, name, and
 *              join status. The host sees a "Calculate Split" button; non-host
 *              participants wait for the host to navigate. Live updates via
 *              Socket.IO's `participant-joined` and `host-navigate` events.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/split/JoinedParticipants
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaSpinner } from "react-icons/fa";
import api from "../../config/config";
import { useAuth } from "../../context/authState";
import useSessionSocket, { emitHostNavigate } from "../../hooks/useSessionSocket";
import toast from 'react-hot-toast';

const COLORS = [
  { color: "bg-purple-200", textColor: "text-purple-700" },
  { color: "bg-pink-200", textColor: "text-pink-700" },
  { color: "bg-blue-200", textColor: "text-blue-700" },
  { color: "bg-teal-200", textColor: "text-teal-700" },
  { color: "bg-orange-200", textColor: "text-orange-700" },
  { color: "bg-rose-200", textColor: "text-rose-700" },
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

  const roomId = type === 'group' ? groupId : sessionId;

  const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
      if (typeof value.toString === "function") return value.toString();
    }
    return String(value);
  };

  const normalizedCurrentUserId = normalizeId(user?._id || user?.id);
  const normalizedCurrentUserEmail = (user?.email || "").trim().toLowerCase();

  // Start the Table Timer when entering the lobby
  useEffect(() => {
    if (sessionId && !localStorage.getItem(`timer_start_${sessionId}`)) {
      localStorage.setItem(`timer_start_${sessionId}`, Date.now().toString());
    }
  }, [sessionId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (sessionId) {
          const sessionRes = await api.get(`/session/${sessionId}`);
          setSession(sessionRes.data);
        }

        if (type === 'group' && groupId) {
          const groupRes = await api.get(`/groups/${groupId}`);
          // Normalize group data into session-like shape for UI
          const grp = groupRes.data.data || groupRes.data;
          setSession({ name: grp.name || 'Group', participants: grp.members || [] });
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId, type, groupId]);

  const handleParticipantJoined = useCallback((data) => {
    // Socket emits { participants, newParticipant } — update participants list
    if (data?.participants) {
      setSession((prev) => ({ ...(prev || {}), participants: data.participants }));

      // Notify host about a new participant join
      try {
        const hostId = data.participants?.[0]?._id || data.participants?.[0]?._id;
        if (data.newParticipant) {
          const normalizedHostId = String(hostId || "");
          if (normalizedHostId && normalizedHostId === normalizedCurrentUserId) {
            const newName = data.newParticipant?.name || 'Someone';
            toast.success(`${newName} joined the session`);
          }
        }
      } catch {
        // Ignore non-critical toast failures.
      }
      return;
    }

    if (data?.session) {
      setSession(data.session);
      return;
    }
  }, [normalizedCurrentUserId]);

  const handleHostNavigate = useCallback((data) => {
    if (data.path) {
      navigate(data.path);
    }
  }, [navigate]);

  useSessionSocket(roomId, handleParticipantJoined, handleHostNavigate);

  const splitName = session?.name || "Split Session";

  const rawParticipants = session?.participants || [];
  const uniqueParticipants = [];
  const seenParticipantKeys = new Set();
  let hasCurrentUser = false;

  rawParticipants.forEach((p, index) => {
    const participantId = normalizeId(p.user || p.participant || p._id);
    const participantEmail = (
      p.email || p.user?.email || p.participant?.email || ""
    )
      .trim()
      .toLowerCase();
    const participantName =
      p.name ||
      p.user?.name ||
      p.participant?.name ||
      p.email ||
      p.user?.email ||
      p.participant?.email ||
      `User ${index + 1}`;
    const isCurrentUser =
      (!!normalizedCurrentUserId && participantId === normalizedCurrentUserId) ||
      (!!normalizedCurrentUserEmail &&
        !!participantEmail &&
        participantEmail === normalizedCurrentUserEmail);

    const dedupeKey =
      participantId
        ? `id:${participantId}`
        : participantEmail
          ? `email:${participantEmail}`
          : `name:${String(participantName).trim().toLowerCase()}`;

    if (isCurrentUser && hasCurrentUser) {
      return;
    }

    if (!seenParticipantKeys.has(dedupeKey)) {
      seenParticipantKeys.add(dedupeKey);
      if (isCurrentUser) hasCurrentUser = true;
      uniqueParticipants.push(p);
    }
  });

  // Get participants from session and map them to display format
  const participants = uniqueParticipants.map((p, index) => {
    const participantId = normalizeId(p.user || p.participant || p._id);
    const participantEmail = (
      p.email || p.user?.email || p.participant?.email || ""
    )
      .trim()
      .toLowerCase();
    const participantName =
      p.name ||
      p.user?.name ||
      p.participant?.name ||
      p.email ||
      p.user?.email ||
      p.participant?.email ||
      `User ${index + 1}`;

    const isCurrentUser =
      (!!normalizedCurrentUserId && participantId === normalizedCurrentUserId) ||
      (!!normalizedCurrentUserEmail &&
        !!participantEmail &&
        participantEmail === normalizedCurrentUserEmail);

    const displayName = isCurrentUser ? "You" : participantName;
    
    const isHost = index === 0; // First participant is the host (creator)
    
    return {
      id: participantId || index,
      name: displayName,
      initial: participantName.charAt(0).toUpperCase(),
      isCurrentUser,
      isHost,
      ...COLORS[index % COLORS.length],
    };
  });

  const isCurrentUserHost = participants.length > 0 && Boolean(participants[0]?.isCurrentUser);

  const handleContinueToScan = () => {
    const path = `/split/scan?splitId=${splitId}&sessionId=${sessionId}&type=${type}${groupId ? `&groupId=${groupId}` : ''}`;
    emitHostNavigate(roomId, path);
    navigate(path);
  };

  const handleLeave = () => {
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
        <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <main className="ml-0 flex-1 px-10 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-10 flex items-center justify-center">
          <FaSpinner className="animate-spin text-4xl text-emerald-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="ml-0 flex-1 px-10 py-6 pt-24 md:ml-56 md:pt-6  sm:mt-10">
        <div className="mx-auto ">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-6xl font-bold text-slate-900">Everyone In?</h1>
            <p className="mt-2 text-base text-slate-500">
              Wait for everyone to join before you scan the bill QR.
            </p>
            <p className="mt-2 text-base text-slate-500">
              {" "}
              Split: <span className="font-bold text-slate-700">{splitName}</span>
            </p>
          </div>

          {/* Main Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Participants
                </p>
                <p className="text-lg font-bold text-emerald-800">{participants.length} Joined</p>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Status
                </p>
                <p className="text-lg font-bold text-slate-900">waiting</p>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Split
                </p>
                <p className="text-lg font-bold text-slate-900 truncate">{splitName}</p>
              </div>
            </div>

            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${participant.color}`}
                    >
                      <span
                        className={`text-sm font-bold ${participant.textColor}`}
                      >
                        {participant.initial}
                      </span>
                    </span>
                    <p className="font-semibold text-slate-900">
                      {participant.name}
                    </p>
                  </div>

                  {participant.isHost && (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              {isCurrentUserHost ? (
                <button onClick={handleContinueToScan} className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2">
                  Continue to Scan Bill
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-slate-500">
                  <FaSpinner className="animate-spin" />
                  Waiting for host to continue...
                </div>
              )}
              <button onClick={handleLeave} className="w-full rounded-xl bg-red-900 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2">
                Leave
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
