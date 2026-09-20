/**
 * @fileoverview Create Split Page
 * @description Wizard page for starting a new bill-splitting session.
 *              The user enters a split title, picks a split method (equal,
 *              item-based, or custom), then the component:
 *              1. Creates a split record via the API
 *              2. Creates a real-time session linked to the split
 *              3. Joins the session as the first participant (host)
 *              4. Navigates to the ScanBill or ReadyToSplit page
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/split/CreateSplit
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaReceipt, FaQrcode, FaUserFriends } from "react-icons/fa";
import api from "../../config/config";
import toast, { Toaster } from "react-hot-toast";

export default function CreateSplit() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [splitName, setSplitName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateSession = async () => {
    if (!splitName.trim()) {
      setError("Please enter a split name");
      toast.error("Please enter a split name");
      return;
    }
    
    setError("");
    setLoading(true);
    const toastId = toast.loading("Creating split session...");
    
    try {
      // Create a split with minimal data
      const splitRes = await api.post("/splits", {
        splitType: "equal",
        totalAmount: 0,
        name: splitName.trim(),
      });
      
      const split = splitRes.data.split;
      
      // Create a session for this split, passing userId so host is auto-added
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const sessionRes = await api.post("/session", {
        name: splitName.trim(),
        splitId: split._id,
        userId: userData._id || userData.id,
      });
      
      const session = sessionRes.data.session;
      const inviteToken = new URL(sessionRes.data.inviteUrl).searchParams.get('invite');
      
      toast.dismiss(toastId);
      toast.success("Session created successfully!");
      
      // Navigate with IDs in URL - data is in database
      navigate(`/split/ready?splitId=${split._id}&sessionId=${session._id}&type=session&invite=${encodeURIComponent(inviteToken)}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      toast.dismiss(toastId);
      toast.error(
        err.response?.data?.message || "Failed to create session. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!splitName.trim()) {
      setError("Please enter a group name");
      toast.error("Please enter a group name");
      return;
    }
    
    setError("");
    setLoading(true);
    const toastId = toast.loading("Creating group split...");
    
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = userData._id || userData.id;
      const userEmail = String(userData.email || '').toLowerCase();
      const isOAuthUser = Boolean(userEmail) && !userEmail.endsWith('@local');

      if (!isOAuthUser) {
        toast.dismiss(toastId);
        toast.error('Create Group requires Google login');
        navigate('/login', {
          state: {
            from: {
              pathname: '/split/create',
              search: '?type=group',
            },
          },
        });
        return;
      }

      // 1. Create a split
      const splitRes = await api.post("/splits", {
        splitType: "equal",
        totalAmount: 0,
        name: splitName.trim(),
      });
      const split = splitRes.data.split;

      // 2. Create a session for QR sharing
      const sessionRes = await api.post("/session", {
        name: splitName.trim(),
        splitId: split._id,
        userId,
      });
      const session = sessionRes.data.session;

      // 3. Create the group immediately so it appears in the Group nav
      const groupRes = await api.post("/groups", {
        name: splitName.trim(),
        description: `Group created on ${new Date().toLocaleDateString()}`,
        createdBy: userId,
        members: [userId],
        splitId: split._id,
        sessionId: session._id,
      });
      const groupId = groupRes.data?.data?.id || groupRes.data?.data?._id || groupRes.data?.id;
      const inviteToken = new URL(groupRes.data.inviteUrl).searchParams.get('invite');

      toast.dismiss(toastId);
      toast.success("Group created & session ready!");
      
      navigate(`/split/ready?splitId=${split._id}&sessionId=${session._id}&type=group&groupId=${groupId}&invite=${encodeURIComponent(inviteToken)}`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err.response?.data?.message || "Failed to create group split. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Toaster position="top-right" reverseOrder={false} />
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <main className="ml-0 flex-1 px-8 py-8 pt-24 md:ml-56 md:pt-8 sm:mt-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">New Split</h1>
            <p className="mt-2 text-base text-slate-500">
              Organize your group expenses in seconds.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                <FaReceipt className="text-lg" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Start a New Split
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="splitName"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Split Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <FaReceipt className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    id="splitName"
                    value={splitName}
                    onChange={(e) => setSplitName(e.target.value)}
                    placeholder="e.g., Dinner at Thamel"
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 pl-11 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleCreateSession}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-base font-bold text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaQrcode className="text-lg" />
                  {loading ? "Creating..." : "Share QR and Scan Bills"}
                </button>

                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-emerald-400 bg-white px-8 py-4 text-base font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaUserFriends className="text-lg" />
                  {loading ? "Creating..." : "Share QR and Create Group"}
                </button>
                <p className="text-center text-xs font-semibold text-slate-500">
                  Group flow requires Google OAuth login.
                </p>
              </div>

              <p className="text-center text-sm text-slate-400">
                Create a session for one-time splits or a group for recurring expenses.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
