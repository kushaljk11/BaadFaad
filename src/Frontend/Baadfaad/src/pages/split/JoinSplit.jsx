/**
 * @fileoverview Join Split Page
 * @description Handles the flow when a user joins an existing session via
 *              a shared link or QR code. Reads the sessionId from URL params,
 *              calls the join API with the current user's info, stores session
 *              data in sessionStorage, and navigates to the appropriate step
 *              in the split flow.
 *
 * @module pages/split/JoinSplit
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaSpinner, FaUsers, FaCheckCircle } from "react-icons/fa";
import api from "../../config/config";
import toast from "react-hot-toast";
import { useAuth } from "../../context/authContext";

export default function JoinSplit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [detectedType, setDetectedType] = useState(null);
  const joinAttemptKeyRef = useRef("");

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const groupId = searchParams.get("groupId");
  const type = searchParams.get("type");
  const pathname = location.pathname || '';

  

  // If link doesn't include explicit type, detect whether the splitId belongs to a group
  useEffect(() => {
    const detect = async () => {
      if (type || !splitId) return;
      try {
        const res = await api.get(`/groups/by-split/${splitId}`);
        if (res?.data?.success) {
          setDetectedType('group');
        } else {
          setDetectedType('session');
        }
      } catch (err) {
        console.warn('groups/by-split failed', err);
        // 404 -> not a group, treat as session. Other errors -> default to session.
        setDetectedType('session');
      }
    };
    detect();
  }, [type, splitId]);

  // Guest fields for unauthenticated session joins
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const handleJoin = useCallback(async () => {
    const effectiveTypeLocal = (pathname.includes('/group') ? 'group' : (pathname.includes('/session') ? 'session' : (type || detectedType || 'session')));
    const joinKey = `${effectiveTypeLocal}:${splitId || ""}:${sessionId || ""}:${groupId || ""}:${currentUserId || ""}`;
    if (joinAttemptKeyRef.current === joinKey) return;

    // Validate depending on link type
    if (effectiveTypeLocal === 'group') {
      if (!groupId) {
        toast.error('Invalid group link');
        return;
      }
    } else {
      if (!sessionId) {
        toast.error('Invalid session link');
        return;
      }
    }

    if (!currentUserId) {
      toast.error("You must be logged in to join a session");
      try {
        localStorage.setItem('postAuthRedirect', JSON.stringify({ pathname: location.pathname, search: location.search }));
      } catch (e) { console.warn('postAuthRedirect save failed', e); }
      navigate("/login", { state: { from: location } });
      return;
    }

    setJoining(true);
    joinAttemptKeyRef.current = joinKey;
    const toastId = toast.loading("Joining session...");

    try {
      const payload = { userId: currentUserId };

      if (effectiveTypeLocal === 'group') {
        if (!groupId) {
          throw new Error('Invalid group link');
        }
        await api.post(`/groups/${groupId}/join`, payload);
        toast.dismiss(toastId);
        toast.success('Joined group successfully!');
        navigate(`/split/joined?splitId=${splitId}&groupId=${groupId}&type=group`);
      } else {
        await api.post(`/session/join/${sessionId}`, payload);
        toast.dismiss(toastId);
        toast.success("Joined successfully!");
        // Navigate to the lobby
        navigate(`/split/joined?splitId=${splitId}&sessionId=${sessionId}&type=${type || 'session'}`);
      }
      } catch (err) {
      console.error("Failed to join session:", err);
      joinAttemptKeyRef.current = "";
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || "Failed to join session");
    } finally {
      setJoining(false);
    }
  }, [currentUserId, sessionId, groupId, type, detectedType, pathname, navigate, location, splitId]);

  // Auto-join when user becomes available
  useEffect(() => {
    if (currentUserId && sessionId) {
      handleJoin();
    }
  }, [currentUserId, sessionId, handleJoin]);

  if (joining) {
    return (
      <div className="flex min-h-screen bg-zinc-50">
        <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
            <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} disableInteraction={true} />
        <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12 flex items-center justify-center">
          <div className="text-center">
            <FaSpinner className="animate-spin text-5xl text-emerald-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-slate-700">Joining session...</p>
          </div>
        </main>
      </div>
    );
  }

  // Prefer explicit pathname segments (/group or /session), then query `type`, then detection
  const effectiveType = (pathname.includes('/group') ? 'group' : (pathname.includes('/session') ? 'session' : (type || detectedType || 'session')));

  if (!user) {
    // If this is a public session link, allow guest join via name
    if (effectiveType === 'session') {
      return (
        <div className="flex min-h-screen bg-zinc-50">
          <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
          <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12">
              <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold text-slate-900">Join Split Session</h1>
                <p className="mt-2 text-base text-slate-500">Enter your name to join as a guest</p>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Your name</label>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full rounded-md border px-3 py-2" placeholder="e.g. Alex" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Email (optional)</label>
                  <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full rounded-md border px-3 py-2" placeholder="name@example.com" />
                </div>
                <div className="flex gap-3">
                  <button onClick={async () => {
                    if (!guestName.trim()) return toast.error('Please enter your name');
                    setJoining(true);
                    const tId = toast.loading('Joining as guest...');
                    try {
                      await api.post(`/session/join/${sessionId}`, { name: guestName.trim(), email: guestEmail.trim() });
                      toast.dismiss(tId); toast.success('Joined successfully');
                      navigate(`/split/joined?splitId=${splitId}&sessionId=${sessionId}&type=${type || 'session'}`);
                    } catch (err) {
                      toast.dismiss(tId); toast.error(err.response?.data?.message || 'Failed to join');
                    } finally { setJoining(false); }
                  }} className="rounded-full bg-emerald-400 px-6 py-3 font-bold text-white">Join as guest</button>
                  <button onClick={() => { try { localStorage.setItem('postAuthRedirect', JSON.stringify({ pathname: location.pathname, search: location.search })); } catch (e) { console.warn(e); } navigate('/login', { state: { from: location } }) }} className="rounded-full border px-6 py-3">Login</button>
                </div>
              </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen bg-zinc-50">
        <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
        <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-700 mb-4">You must be logged in to join a session</p>
            <button
              onClick={() => navigate('/login', { state: { from: location } })}
              className="rounded-full bg-emerald-400 px-6 py-3 font-bold text-white hover:bg-emerald-500"
            >
              Go to Login
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <FaUsers className="text-3xl text-emerald-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Join Split Session</h1>
            <p className="mt-2 text-base text-slate-500">
              Enter your details to join this split
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 rounded-xl bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800 mb-3">Joining as:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Name:</span>
                  <span className="text-sm text-slate-900">{user?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Email:</span>
                  <span className="text-sm text-slate-900">{user?.email || "Not provided"}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-base font-bold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <>
                  <FaSpinner className="animate-spin" />
                  {"Joining..."}
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  {effectiveType === 'group' ? 'Join Group' : 'Join Session'}
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              You'll be added to the split session immediately
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
