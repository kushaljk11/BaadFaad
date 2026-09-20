/**
 * @fileoverview Join Session Page
 * @description Allows a user to join an existing bill-splitting session by
 *              entering or pasting a session ID. Validates the input and
 *              navigates to the split flow with the session context.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/Dashboard/JoinSession
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaLink, FaArrowRight, FaQrcode, FaStop, FaImage } from "react-icons/fa";
import jsQR from "jsqr";
import toast from "react-hot-toast";

export default function JoinSession() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessionLink, setSessionLink] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [uploadDecoding, setUploadDecoding] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const parseAndNavigate = (rawLink) => {
    if (!rawLink.trim()) {
      toast.error("Please enter a session link");
      return;
    }

    try {
      let url;
      try {
        url = new URL(rawLink.trim());
      } catch {
        url = new URL(rawLink.trim(), window.location.origin);
      }

      const splitId = url.searchParams.get("splitId");
      const sessionId = url.searchParams.get("sessionId");
      const groupId = url.searchParams.get("groupId");
      const inviteToken = url.searchParams.get("invite");
      const type = String(url.searchParams.get("type") || "session").toLowerCase();

      if (groupId || type === "group") {
        if (!groupId || !splitId || !inviteToken) {
          toast.error("Invalid group link. Please check and try again.");
          return;
        }
        navigate(`/group/join?groupId=${encodeURIComponent(groupId)}&splitId=${encodeURIComponent(splitId)}&type=group&invite=${encodeURIComponent(inviteToken)}`);
        return;
      }

      if (!splitId || !sessionId || !inviteToken) {
        toast.error("Invalid session link. Please check the link and try again.");
        return;
      }

      navigate(`/session/join?splitId=${encodeURIComponent(splitId)}&sessionId=${encodeURIComponent(sessionId)}&type=session&invite=${encodeURIComponent(inviteToken)}`);
    } catch (err) {
      toast.error("Invalid link format. Please paste a valid session link.");
    }
  };

  const handleJoinSession = () => {
    parseAndNavigate(sessionLink);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadDecoding(true);
    setScanError("");

    try {
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(imageBitmap, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);

      if (!decoded?.data) {
        toast.error("No QR code found in the selected image.");
        return;
      }

      const scannedValue = String(decoded.data).trim();
      setSessionLink(scannedValue);
      toast.success("QR image decoded successfully");
      parseAndNavigate(scannedValue);
    } catch (err) {
      toast.error("Unable to decode this image. Try a clearer QR screenshot/photo.");
    } finally {
      setUploadDecoding(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerActive(false);
  };

  const startScanner = async () => {
    setScanError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera is not available on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      streamRef.current = stream;

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector =
        "BarcodeDetector" in window
          ? new window.BarcodeDetector({ formats: ["qr_code"] })
          : null;

      const handleScannedValue = (value) => {
        const scanned = String(value || "").trim();
        if (!scanned) return false;

        setSessionLink(scanned);
        stopScanner();
        setScannerOpen(false);
        toast.success("QR scanned successfully");
        parseAndNavigate(scanned);
        return true;
      };

      setScannerActive(true);

      const scanLoop = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const sourceWidth = video.videoWidth || 640;
          const sourceHeight = video.videoHeight || 480;

          // Keep decode workload reasonable on lower-end phones.
          const maxWidth = 960;
          const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;

          canvas.width = Math.max(1, Math.floor(sourceWidth * scale));
          canvas.height = Math.max(1, Math.floor(sourceHeight * scale));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            if (detector) {
              const codes = await detector.detect(canvas);
              if (codes?.length && handleScannedValue(codes[0].rawValue)) {
                return;
              }
            }
          } catch {
            // Fall back to jsQR below.
          }

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(imageData.data, imageData.width, imageData.height);
            if (qr?.data && handleScannedValue(qr.data)) {
              return;
            }
          } catch {
            // Keep scanning unless a valid QR is detected.
          }
        }

        rafRef.current = requestAnimationFrame(scanLoop);
      };

      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      setScanError("Unable to access camera. Allow camera permission and use HTTPS on mobile.");
      stopScanner();
    }
  };

  useEffect(() => {
    if (scannerOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => stopScanner();
  // Scanner callbacks intentionally restart only when the dialog opens/closes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 flex-1 px-8 py-6 pt-24 md:ml-56 md:pt-6 sm:mt-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <FaLink className="text-3xl text-emerald-600" />
            </div>
            <h1 className="text-3xl font-semibold text-slate-900">Join Split Session</h1>
            <p className="mt-2 text-base text-slate-500">
              Paste the session link you received to join
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label htmlFor="sessionLink" className="block text-sm font-semibold text-slate-700 mb-2">
                  Session Link
                </label>
                <input
                  type="text"
                  id="sessionLink"
                  value={sessionLink}
                  onChange={(e) => setSessionLink(e.target.value)}
                  placeholder="https://example.com/session/join?splitId=... or https://example.com/group/join?groupId=..."
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <button
                type="button"
                onClick={handleJoinSession}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500"
              >
                Continue
                <FaArrowRight className="text-sm" />
              </button>

              <div className="pt-2">
                {!scannerOpen ? (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition hover:bg-zinc-50"
                  >
                    <FaQrcode className="text-base" />
                    Scan QR to Join
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-8 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <FaStop className="text-sm" />
                    Stop Scanner
                  </button>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDecoding}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaImage className="text-sm" />
                  {uploadDecoding ? "Decoding QR image..." : "Upload QR Image"}
                </button>
              </div>

              {scannerOpen && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black/90">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-64 w-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="bg-zinc-900 px-4 py-3 text-xs text-zinc-200">
                    {scannerActive
                      ? "Point your camera at the session/group QR code"
                      : "Starting camera scanner..."}
                  </div>
                </div>
              )}

              {scanError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {scanError}
                </p>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-zinc-50 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">How to join:</p>
              <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                <li>Ask the host to share a link or QR code</li>
                <li>Paste link, scan live QR, or upload QR image</li>
                <li>Continue to join the split/group</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
