/**
 * @fileoverview Split Calculated / Item Selection Page
 * @description Interactive page where each participant selects the items they
 *              consumed from the bill. Features a "Smart Guilt Calculator" that
 *              shows a humorous fairness score based on selection honesty.
 *              The host triggers the final split calculation; non-host users
 *              wait. Supports real-time sync via Socket.IO.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/split/SplitCalculated
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import {
  FaFire,
  FaReceipt,
  FaArchive,
  FaPlus,
  FaTimes,
  FaCalculator,
  FaSpinner,
  FaCheckCircle,
  FaHourglassHalf,
  FaTimesCircle,
  FaClock,
  FaBolt,
} from "react-icons/fa";
import esewaLogo from "@root-assets/esewa.png";
import khaltiLogo from "@root-assets/khalti.png";
import api from "../../config/config";
import toast from "react-hot-toast";
import useSessionSocket from "../../hooks/useSessionSocket";
import { useAuth } from "../../context/authState";

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

export default function SplitCalculated() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cleanRoundMode, setCleanRoundMode] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState("esewa");
  const [tags, setTags] = useState(["Dinner", "Fuel", "Night Out", "Movies", "Travel"]);
  const [selectedTags, setSelectedTags] = useState(["Dinner"]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [finishing, setFinishing] = useState(false);

  const [split, setSplit] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Table Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const splitId = searchParams.get("splitId");
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");

  const fetchSplit = useCallback(async () => {
    try {
      if (splitId) {
        const splitRes = await api.get(`/splits/${splitId}`);
        setSplit(splitRes.data.split);
      }
    } catch {
      toast.error("Failed to load split data");
    }
  }, [splitId]);

  useEffect(() => {
    const fetchData = async () => {
      await fetchSplit();
      try {
        if (sessionId) {
          const sessionRes = await api.get(`/session/${sessionId}`);
          // Detect if current user is host (first participant)
          const normalizeId = (v) => {
            if (!v) return "";
            if (typeof v === "string") return v;
            if (typeof v === "object") return String(v._id || v.id || v);
            return String(v);
          };
          const currentUserId = normalizeId(user?._id || user?.id);
          const firstP = sessionRes.data?.participants?.[0];
          if (firstP && currentUserId) {
            const hostId = normalizeId(firstP.user || firstP.participant || firstP._id);
            setIsHost(hostId === currentUserId);
          }
        }
      } catch {
        toast.error("Failed to load session data");
      }
    };
    fetchData();
  }, [splitId, sessionId, fetchSplit, user?._id, user?.id]);

  // Socket: listen for real-time navigation events (in case host pushes further)
  const onHostNavigate = useCallback(
    (data) => {
      if (data?.path) navigate(data.path);
    },
    [navigate]
  );
  useSessionSocket(sessionId, null, onHostNavigate, null);

  // ── Table Timer: track elapsed time from lobby start ──
  useEffect(() => {
    const startStr = sessionId && localStorage.getItem(`timer_start_${sessionId}`);
    if (!startStr) return;

    setTimerRunning(true);
    const startTime = parseInt(startStr, 10);

    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    tick(); // initial
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getTimerMessage = (secs) => {
    if (secs < 30) return "Lightning fast! Faster than opening a calculator.";
    if (secs < 60) return "Under a minute! No awkward silence at the table.";
    if (secs < 120) return "Quick work! Manual math would've taken 5x longer.";
    if (secs < 300) return "Still faster than arguing over who had what!";
    return "Worth the wait — no friendships harmed!";
  };

  // Derived from API data
  const totalAmount = split?.totalAmount || 0;
  const breakdown = split?.breakdown || [];

  // Find the "big spender" — participant who paid the most
  const bigSpender = breakdown.length
    ? breakdown.reduce((max, b) => ((b.amountPaid || 0) > (max.amountPaid || 0) ? b : max), breakdown[0])
    : null;
  const bigSpenderName = bigSpender
    ? bigSpender.name || bigSpender.user?.name || bigSpender.participant?.name || "Someone"
    : null;

  // Build participant list with real backend data
  const participants = breakdown.map((b) => {
    const name = b.name || b.user?.name || b.participant?.name || "Participant";
    const amountPaid = b.amountPaid || 0;
    const share = cleanRoundMode ? Math.round(b.amount / 10) * 10 : b.amount;
    const balanceDue = Math.max(0, share - amountPaid);
    const paymentStatus = b.paymentStatus || "unpaid";
    const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    return {
      name,
      initials,
      share,
      amountPaid,
      balanceDue,
      paymentStatus,
    };
  });

  // Count settled vs pending
  const settledCount = participants.filter((p) => p.paymentStatus === "paid").length;
  const pendingCount = participants.length - settledCount;

  const handleToggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag("");
      setShowAddTag(false);
    }
  };

  const handleFinish = async () => {
    if (!split?._id) {
      navigate("/dashboard");
      return;
    }
    setFinishing(true);
    try {
      await api.post(`/splits/${split._id}/finalize`);
      toast.success("Split archived!");

      // Host with a group → navigate to group settlement page
      if (isHost && type === "group" && groupId) {
        navigate(`/group/${groupId}/settlement`);
      } else {
        navigate("/dashboard");
      }
    } catch {
      toast.error("Failed to finalize split");
      navigate("/dashboard");
    } finally {
      setFinishing(false);
    }
  };

  const handleProceedToPay = () => {
    if (!totalAmount) {
      toast.error("No payable amount found");
      return;
    }

    const params = new URLSearchParams({
      amount: String(totalAmount),
      gateway: selectedPayment,
      splitId: splitId || "",
      sessionId: sessionId || "",
      type: type || "",
      groupId: groupId || "",
    });

    navigate(`/payment?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 flex-1 px-4 py-6 pt-24 md:ml-56 md:px-8 md:pt-8 sm:mt-10">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Split Calculated!
              </h1>
              <p className="mt-2 text-sm text-slate-500 md:text-base">
                Your group expenses are ready to be settled.
              </p>
            </div>
            <div className="w-full rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-4 py-2 text-center md:w-auto md:px-5 md:py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Bill Amount
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">
                Rs. {totalAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Table Timer Card */}
          {timerRunning && (
            <div className="mb-6 rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-50 to-violet-50 p-4 shadow-sm md:rounded-3xl md:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-200 text-indigo-600">
                    <FaClock className="text-xl" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">Split Timer</h3>
                      <FaBolt className="text-amber-500" />
                    </div>
                    <p className="text-xs text-slate-600 md:text-sm">
                      {getTimerMessage(elapsedSeconds)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums text-indigo-600 md:text-4xl">
                    {formatTimer(elapsedSeconds)}
                  </p>
                  <p className="text-xs font-medium text-slate-400">Total time</p>
                </div>
              </div>
            </div>
          )}

          {/* Big Spender and Clean Round Mode - Side by Side */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
            {/* Big Spender Card */}
            <div className="rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-4 shadow-sm md:rounded-3xl md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-orange-600 md:h-12 md:w-12">
                  <FaFire className="text-xl md:text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Big Spender <FaFire className="inline text-orange-500" />
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">
                    {bigSpenderName
                      ? `${bigSpenderName} paid Rs. ${(bigSpender?.amountPaid || 0).toLocaleString()} of Rs. ${(bigSpender?.amount || 0).toLocaleString()}`
                      : "No data yet"}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-amber-200 px-2 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 md:px-3">
                    VIP CONTRIBUTOR
                  </span>
                </div>
              </div>
            </div>

            {/* Clean Round Mode */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FaCalculator className="text-emerald-600 text-lg" />
                    <h3 className="text-base font-bold text-slate-900">
                      Clean Round Mode
                    </h3>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 md:text-sm">
                    Automatically round decimals to nearest 10 for easier calculations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCleanRoundMode(!cleanRoundMode)}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                    cleanRoundMode ? "bg-emerald-400" : "bg-zinc-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition ${
                      cleanRoundMode ? "right-1" : "left-1"
                    }`}
                  ></div>
                </button>
              </div>
            </div>
          </div>

          {/* Tag This Outing */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <FaReceipt className="text-slate-400" />
              <h2 className="text-base font-bold text-slate-900 md:text-lg">Tag This Outing</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedTags.includes(tag)
                      ? "bg-emerald-400 text-slate-900"
                      : "border border-zinc-300 bg-white text-slate-600 hover:bg-zinc-50"
                  }`}
                >
                  {tag}
                </button>
              ))}
              {!showAddTag ? (
                <button
                  type="button"
                  onClick={() => setShowAddTag(true)}
                  className="rounded-full border border-dashed border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-slate-400 transition hover:border-emerald-400 hover:text-emerald-600"
                >
                  + Add New
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNewTag()}
                    placeholder="Tag name"
                    className="w-32 rounded-full border border-emerald-400 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddNewTag}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-white transition hover:bg-emerald-500"
                  >
                    <FaPlus className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTag(false);
                      setNewTag("");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-slate-600 transition hover:bg-zinc-300"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaReceipt className="text-slate-400" />
                <h2 className="text-base font-bold text-slate-900 md:text-lg">Payment Methods</h2>
              </div>
              <p className="text-xs font-semibold text-emerald-600 md:text-sm">
                Payable Amount: Rs. {totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedPayment("esewa")}
                className={`rounded-2xl border-2 py-6 text-center transition ${
                  selectedPayment === "esewa"
                    ? "border-green-400 bg-green-50"
                    : "border-zinc-200 bg-zinc-50 hover:border-green-300"
                }`}
              >
                <div className="mb-2 flex items-center justify-center">
                  <img src={esewaLogo} alt="eSewa" className="h-8 w-8 object-contain md:h-10 md:w-10" />
                </div>
                <p className="text-sm font-bold text-slate-900">eSewa</p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayment("khalti")}
                className={`rounded-2xl border-2 py-6 text-center transition ${
                  selectedPayment === "khalti"
                    ? "border-purple-400 bg-purple-50"
                    : "border-zinc-200 bg-zinc-50 hover:border-purple-300"
                }`}
              >
                <div className="mb-2 flex items-center justify-center">
                  <img src={khaltiLogo} alt="Khalti" className="h-8 w-8 object-contain md:h-10 md:w-10" />
                </div>
                <p className="text-sm font-bold text-slate-900">Khalti</p>
              </button>
            </div>
            <button
              type="button"
              onClick={handleProceedToPay}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 md:px-8 md:py-4 md:text-base"
            >
              ⚡ PROCEED TO PAY
            </button>
          </div>

          {/* Settlement Breakdown */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:rounded-3xl md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaReceipt className="text-slate-400" />
                <h2 className="text-base font-bold text-slate-900 md:text-lg">
                  Settlement Breakdown
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-600 md:text-sm">
                  {settledCount} Settled
                </span>
                {pendingCount > 0 && (
                  <span className="text-xs font-semibold text-red-500 md:text-sm">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2 md:space-y-3">
              {participants.map((p, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 md:px-4 md:py-3"
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 md:h-10 md:w-10 md:text-sm">
                      {p.initials}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 md:text-sm">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Share: Rs. {p.share.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 md:flex-row md:items-center md:gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        Paid: <span className="font-bold text-emerald-600">Rs. {p.amountPaid.toLocaleString()}</span>
                      </p>
                      {p.balanceDue > 0 && (
                        <p className="text-xs text-red-500 font-semibold">
                          Due: Rs. {p.balanceDue.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {statusBadge(p.paymentStatus)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finish & Archive Button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleFinish}
              disabled={finishing}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-base font-bold text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500 md:px-8 md:py-4 md:text-lg disabled:opacity-50"
            >
              {finishing ? <FaSpinner className="animate-spin" /> : <FaArchive />}
              FINISH & ARCHIVE
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Archiving will save this split to your history and notify unpaid members.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
