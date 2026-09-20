/**
 * @fileoverview Ready To Split / Waiting Room Page
 * @description Displays the session QR code and share options.
 *              Key Features:
 *              - High contrast QR display with camera focus frame
 *              - Copy link & native mobile Share API
 *              - Real-time live count with ConnectionPill
 *              - Host navigation to lobby or bill scanning
 *
 * @module pages/split/ReadyToSplit
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/authState";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import {
  FaArrowRight,
  FaCopy,
  FaCheck,
  FaShareAlt,
  FaQrcode,
  FaCamera,
} from "react-icons/fa";
import api from "../../config/config";
import useSessionSocket from "../../hooks/useSessionSocket";
import { ConnectionPill, SkeletonCard } from "../../components/common/primitives";
import LoadingButton from "../../components/common/LoadingButton";

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

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/session/${sessionId}`);
      setSession(response.data);

      if ((groupId || type === "group") && groupId) {
        try {
          const groupRes = await api.get(`/groups/${groupId}`);
          const groupData = groupRes.data?.data || groupRes.data;
          setGroup(groupData);
        } catch (groupErr) {
          console.warn("Failed to fetch group QR:", groupErr);
        }
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, groupId, type]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleParticipantJoined = useCallback((data) => {
    if (data?.participants) {
      setSession((prev) => ({ ...(prev || {}), participants: data.participants }));
      return;
    }
    if (data?.session) {
      setSession(data.session);
    }
  }, []);

  const { connectionStatus } = useSessionSocket(
    sessionId,
    handleParticipantJoined,
    null,
    null,
    fetchSession
  );

  const splitName = session?.name || "Split Session";

  const getJoinLink = () => {
    return groupId || type === "group"
      ? `${window.location.origin}/group/join?groupId=${groupId || ""}&splitId=${splitId}&type=group&invite=${encodeURIComponent(
          inviteToken || ""
        )}`
      : `${window.location.origin}/session/join?splitId=${splitId}&sessionId=${sessionId}&type=session&invite=${encodeURIComponent(
          inviteToken || ""
        )}`;
  };

  const handleCopyLink = async () => {
    const link = getJoinLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  };

  const handleNativeShare = async () => {
    const link = getJoinLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${splitName} on BaadFaad`,
          text: `Join our bill split for ${splitName}:`,
          url: link,
        });
      } catch (e) {
        // Share dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleGoToLobby = () => {
    if (!isAuthenticated && (type === "session" || (!type && !groupId))) {
      navigate(
        `/session/join?splitId=${splitId}&sessionId=${sessionId}&invite=${encodeURIComponent(
          inviteToken || ""
        )}`
      );
      return;
    }

    navigate(
      `/split/joined?splitId=${splitId}&sessionId=${sessionId}&type=${
        type || (groupId ? "group" : "session")
      }${groupId ? `&groupId=${groupId}` : ""}`
    );
  };

  const qrCodeImage =
    groupId || type === "group" ? group?.qrCode || session?.qrCode : session?.qrCode;

  const participantCount = session?.participants?.length || 0;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        disableInteraction={true}
      />

      <main className="ml-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Share & Join
              </span>
              <ConnectionPill status={connectionStatus} />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Ready to Split!
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ask friends at the table to scan or open your invite link.
            </p>
          </div>

          {loading ? (
            <SkeletonCard lines={6} />
          ) : (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs text-center space-y-5 sm:p-8">
              <div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {type === "group" ? "GROUP SPLIT" : "LIVE SESSION"}
                </span>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{splitName}</h2>
              </div>

              {/* QR Code Container */}
              <div className="relative mx-auto w-fit">
                <div className="rounded-3xl bg-linear-to-b from-emerald-50 to-teal-50 p-6 shadow-inner border border-emerald-100">
                  <div className="rounded-2xl bg-white p-3 shadow-md">
                    {qrCodeImage ? (
                      <img
                        src={qrCodeImage}
                        alt="Session QR Code"
                        className="mx-auto h-44 w-44 rounded-xl object-contain"
                      />
                    ) : (
                      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                        <FaQrcode className="text-5xl" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2.5 text-[11px] font-semibold text-slate-500">
                    Scan with any phone camera
                  </p>
                </div>
              </div>

              {/* Participant Joined Indicator */}
              <div className="rounded-2xl bg-zinc-50 p-3.5 flex items-center justify-between border border-zinc-200 text-xs">
                <span className="font-semibold text-slate-600">People in Room</span>
                <span className="font-semibold text-emerald-600 text-sm">
                  {participantCount} Joined
                </span>
              </div>

              {/* Share & Copy Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white py-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50 active:scale-95 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <FaCheck className="text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <FaCopy />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white py-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50 active:scale-95 transition cursor-pointer"
                >
                  <FaShareAlt />
                  <span>Share Link</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <LoadingButton
                  fullWidth
                  size="lg"
                  variant="primary"
                  onClick={handleGoToLobby}
                  icon={<FaArrowRight />}
                >
                  Enter Live Room
                </LoadingButton>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/split/scan?splitId=${splitId}&sessionId=${sessionId}&type=${
                        type || (groupId ? "group" : "session")
                      }${groupId ? `&groupId=${groupId}` : ""}`
                    )
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <FaCamera />
                  <span>Scan or Enter Bill Receipt</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
