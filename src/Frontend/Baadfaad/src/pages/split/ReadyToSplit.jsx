/**
 * @fileoverview Ready To Split / Waiting Room Page
 * @description Displays the session QR code and share link so participants
 *              can join. Shows the live participant count via Socket.IO.
 *              The host can proceed when enough people have joined.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/split/ReadyToSplit
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from '../../context/authState';
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaArrowRight, FaCopy, FaQrcode, FaSpinner } from "react-icons/fa";
import api from "../../config/config";
import useSessionSocket from "../../hooks/useSessionSocket";

export default function ReadyToSplit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const inviteToken = searchParams.get("invite");
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await api.get(`/session/${sessionId}`);
        setSession(response.data);

        if ((groupId || type === 'group') && groupId) {
          try {
            const groupRes = await api.get(`/groups/${groupId}`);
            const groupData = groupRes.data?.data || groupRes.data;
            setGroup(groupData);
          } catch (groupErr) {
            // Non-fatal: fallback to session QR if group fetch fails.
            console.warn("Failed to fetch group QR:", groupErr);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, groupId, type]);

  const handleParticipantJoined = useCallback((data) => {
    // Socket payload contains `participants` (flattened) and `newParticipant`.
    // Prefer updating participants in-place to avoid a full refetch.
    if (data?.participants) {
      setSession((prev) => ({ ...(prev || {}), participants: data.participants }));
      return;
    }

    // Fallback: if server sent a whole session object, replace it.
    if (data?.session) {
      setSession(data.session);
      return;
    }
  }, [setSession]);

  useSessionSocket(sessionId, handleParticipantJoined);

  const splitName = session?.name || "Split Session";

  const handleCopyLink = () => {
    const link = (groupId || type === 'group')
      ? `${window.location.origin}/group/join?groupId=${groupId || ''}&splitId=${splitId}&type=group&invite=${encodeURIComponent(inviteToken || '')}`
      : `${window.location.origin}/session/join?splitId=${splitId}&sessionId=${sessionId}&type=session&invite=${encodeURIComponent(inviteToken || '')}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToLobby = () => {
    // If the visitor is not authenticated and this is a public session link,
    // send them to the public join page where they can join as guest by name.
    if (!isAuthenticated && (type === 'session' || !type && !groupId)) {
      // go to public session join
      navigate(`/session/join?splitId=${splitId}&sessionId=${sessionId}&invite=${encodeURIComponent(inviteToken || '')}`);
      return;
    }

    // Authenticated host/participant: navigate to lobby
    navigate(`/split/joined?splitId=${splitId}&sessionId=${sessionId}&type=${type || (groupId ? 'group' : 'session')}${groupId ? `&groupId=${groupId}` : ''}`);
  };

  const qrCodeImage =
    (groupId || type === 'group')
      ? group?.qrCode || session?.qrCode
      : session?.qrCode;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-50">
        <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
        <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} disableInteraction={true} />
        <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12 flex items-center justify-center">
          <FaSpinner className="animate-spin text-4xl text-emerald-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} disableInteraction={true} />
      <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Ready to Split!</h1>
            <p className="mt-2 text-base text-slate-500">
              Ask your friends to scan this code to join the split instantly.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-center">
              <span className="inline-block rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold tracking-wider text-emerald-600">
                ACTIVE SESSION
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">
                {splitName}
              </h2>
            </div>

            <div className="relative mx-auto w-fit">
              <div className="absolute -left-3 -top-3 h-8 w-8 border-l-4 border-t-4 border-emerald-400 rounded-tl-xl"></div>
              <div className="absolute -right-3 -top-3 h-8 w-8 border-r-4 border-t-4 border-emerald-400 rounded-tr-xl"></div>
              <div className="absolute -bottom-3 -left-3 h-8 w-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
              <div className="absolute -bottom-3 -right-3 h-8 w-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
              
              <div className="rounded-2xl bg-linear-to-br from-emerald-50 to-teal-50 p-6">
                <div className="rounded-xl bg-white p-4 shadow-md">
                  {qrCodeImage ? (
                    <img 
                      src={qrCodeImage} 
                      alt="Session QR Code" 
                      className="mx-auto h-36 w-36 rounded-lg"
                    />
                  ) : (
                    <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-lg bg-zinc-100">
                      <FaQrcode className="text-5xl text-slate-400" />
                    </div>
                  )}
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Scan to join this split session
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                <span className="font-semibold text-slate-600">Live Update</span>
              </div>
              <span className="font-bold text-emerald-600">
                {session?.participants?.length || 0} Joined
              </span>
            </div>

            <div className="mt-5 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <span className="h-10 w-10 rounded-full bg-orange-200"></span>
                <span className="h-10 w-10 rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50"></span>
              </div>
              <p className="text-sm text-slate-400">
                Waiting for your friends to scan...
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleGoToLobby}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500"
            >
              Go to Live Split Room
              <FaArrowRight className="text-sm" />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-8 py-3 text-sm font-semibold text-slate-600 transition hover:bg-zinc-50"
            >
              <FaCopy className="text-xs" />
              {copied ? 'Copied!' : 'Copy Split Link'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
