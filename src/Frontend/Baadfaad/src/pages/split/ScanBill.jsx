/**
 * @fileoverview Scan Bill Page
 * @description Host-only page for uploading or capturing a bill image.
 *              Sends the image to the Gemini AI backend for OCR parsing,
 *              displays extracted items in an editable table, and allows
 *              manual item additions. Non-host participants see a read-only
 *              preview synced in real time via Socket.IO.
 *              Includes a "Table Timer" that auto-navigates after a timeout.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/split/ScanBill
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import { FaCloudUploadAlt, FaCamera, FaCheckCircle, FaPlusCircle, FaTrash, FaSpinner, FaLock } from "react-icons/fa";
import api from "../../config/config";
import { useAuth } from "../../context/authState";
import useSessionSocket, { emitItemsUpdate, emitHostNavigate } from "../../hooks/useSessionSocket";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const MAX_UPLOAD_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const COMPRESSION_THRESHOLD_BYTES = 1.2 * 1024 * 1024;

const compressImageForUpload = (file) =>
  new Promise((resolve) => {
    if (!file?.type?.startsWith("image/") || file.size <= COMPRESSION_THRESHOLD_BYTES) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          MAX_UPLOAD_DIMENSION / Math.max(img.width || 1, img.height || 1),
        );
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.\w+$/, ".jpg"),
              { type: "image/jpeg" },
            );
            resolve(compressedFile);
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });

export default function ScanBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scannedData, setScannedData] = useState(null);
  const [manualItems, setManualItems] = useState([]);
  const [participantsList, setParticipantsList] = useState([]);
  const [itemName, setItemName] = useState("");
  const [itemAssigned, setItemAssigned] = useState([]);
  const [itemPrice, setItemPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [hostLoading, setHostLoading] = useState(true);

  const sessionId = searchParams.get("sessionId");
  const splitId = searchParams.get("splitId");
  const type = searchParams.get("type");
  const groupId = searchParams.get("groupId");
  const roomId = type === 'group' ? groupId : sessionId;

  // Detect if current user is host (first participant in session)
  useEffect(() => {
    const detectHost = async () => {
      // If this is a group link, fetch group members and treat group.creator as host
      if (type === 'group' && groupId) {
        try {
          const groupRes = await api.get(`/groups/${groupId}`);
          const grp = groupRes.data.data || groupRes.data;
          const members = grp.members || [];
          const normalized = members.map((m) => {
            const id = m._id || m.id || m;
            const name = m.fullName || m.name || m.email || (m.user && (m.user.fullName || m.user.name)) || `User`;
            return { id: String(id), name };
          });
          setParticipantsList(normalized);
          const currentUserId = String(user?._id || user?.id || '');
          const creatorId = String(grp.createdBy?._id || grp.createdBy || '');
          setIsHost(creatorId === currentUserId);
        } catch (err) {
          console.error('Failed to load group for ScanBill:', err);
          setIsHost(false);
        } finally {
          setHostLoading(false);
        }
        return;
      }

      // session-based detection
      if (!sessionId) {
        // No session = direct split, user is effectively the host
        setIsHost(true);
        setHostLoading(false);
        return;
      }

      try {
        const sessionRes = await api.get(`/session/${sessionId}`);
        const normalizeId = (v) => {
          if (!v) return "";
          if (typeof v === "string") return v;
          if (typeof v === "object") return String(v._id || v.id || v);
          return String(v);
        };
        const currentUserId = normalizeId(user?._id || user?.id);
        const participants = sessionRes.data?.participants || sessionRes.data?.session?.participants || [];
        // normalize participants for selection
        const normalized = participants.map((p) => {
          const id = p.user?._id || p.user?.id || p.participant?._id || p.participant?.id || p._id || p.id;
          const name = p.name || p.user?.name || p.participant?.name || p.email || p.user?.email || p.participant?.email || `User`;
          return { id: String(id), name };
        });
        setParticipantsList(normalized);
        const firstP = participants[0];
        if (firstP && currentUserId) {
          const hostId = normalizeId(firstP.user || firstP.participant || firstP._id);
          setIsHost(hostId === currentUserId);
        }
      } catch (err) {
        console.error("Failed to detect host:", err);
        // Fallback: assume not host if detection fails
        setIsHost(false);
      } finally {
        setHostLoading(false);
      }
    };
    detectHost();
  }, [sessionId, user, type, groupId]);

  // Socket: participants receive live item updates from host
  const onItemsUpdate = useCallback((data) => {
    if (data?.scannedData !== undefined) setScannedData(data.scannedData);
    if (data?.manualItems !== undefined) setManualItems(data.manualItems);
  }, []);

  // Socket: listen for host navigation
  const onHostNavigate = useCallback((data) => {
    if (data?.path) navigate(data.path);
  }, [navigate]);

  useSessionSocket(roomId, null, onHostNavigate, onItemsUpdate);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, etc.)");
      return;
    }

    setError("");
    setIsProcessing(true);
    setProgress(0);

    const progressInterval = setInterval(() => {  
      setProgress((prev) => {
        if (prev >= 90) {
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const uploadFile = await compressImageForUpload(file);
      const image = await toBase64(uploadFile);
      const response = await api.post("/bills/parse", { image }, { timeout: 60000 });
      const parsed = response.data || {};


      const parsedItems = Array.isArray(parsed.items)
        ? parsed.items.map((item) => {
            const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
            const unitPrice = Number(item.unit_price) || 0;
            const totalPrice = Number(item.total_price) || unitPrice * quantity;

            return {
              name: `${quantity}x ${item.name || "Item"}`,
              price: totalPrice,
              quantity,
              unitPrice,
            };
          })
        : [];

      const parsedTotal =
        Number(parsed.grand_total) ||
        parsedItems.reduce((sum, item) => sum + item.price, 0);

      const newScannedData = {
        restaurant: "Parsed Receipt",
        address: "",
        items: parsedItems,
        total: parsedTotal,
      };
      setScannedData(newScannedData);
      setProgress(100);

      // Broadcast to participants via socket
      if (roomId) {
        emitItemsUpdate(roomId, newScannedData, manualItems);
      }
    } catch (err) {
      setScannedData(null);

      const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
      setError(
        isTimeout
          ? "Parsing is taking longer than expected. Please retry with a clearer/smaller image."
          : err.response?.data?.error ||
              err.response?.data?.message ||
              err.message ||
              "Failed to parse bill image",
      );
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleCameraCapture = () => {
    const fileInput = document.getElementById("fileUpload");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleAddManualItem = () => {
    if (itemName.trim() && itemPrice && itemQuantity) {
      const newItem = {
        name: `${itemQuantity}x ${itemName.trim()}`,
        price: parseFloat(itemPrice) * parseInt(itemQuantity),
        quantity: parseInt(itemQuantity),
        unitPrice: parseFloat(itemPrice),
        assigned: itemAssigned.slice(),
      };
      const updatedItems = [...manualItems, newItem];
      setManualItems(updatedItems);
      setItemAssigned([]);
      setItemName("");
      setItemPrice("");
      setItemQuantity("1");

      // Broadcast to participants via socket
      if (roomId) {
        emitItemsUpdate(roomId, scannedData, updatedItems);
      }
    }
  };

  const handleRemoveManualItem = (index) => {
    const updatedItems = manualItems.filter((_, i) => i !== index);
    setManualItems(updatedItems);

    // Broadcast to participants via socket
    if (roomId) {
      emitItemsUpdate(roomId, scannedData, updatedItems);
    }
  };

  const calculateTotal = () => {
    const scannedTotal = scannedData ? scannedData.total : 0;
    const manualTotal = manualItems.reduce((sum, item) => sum + item.price, 0);
    return scannedTotal + manualTotal;
  };

  const hasItems = scannedData || manualItems.length > 0;

  const handleContinue = async () => {
    // Build all items from scanned + manual
    const allItems = [
      ...(scannedData?.items || []).map((item) => ({
        name: item.name,
        price: item.price,
        quantity: 1,
      })),
      ...manualItems.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        assigned: item.assigned || [],
      })),
    ];

    const totalAmount = calculateTotal();

    setSaving(true);
    setError("");
    try {
      // Create receipt in backend
      const receiptRes = await api.post("/receipts", {
        restaurant: scannedData?.restaurant || "",
        address: scannedData?.address || "",
        items: allItems,
        totalAmount,
      });

      // Store receipt for next pages
      localStorage.setItem("currentReceipt", JSON.stringify(receiptRes.data.receipt));

      const receiptId = receiptRes.data.receipt._id;

        if (splitId) {
        // Update existing split with receipt + session so backend auto-calculates breakdown
        const updateRes = await api.put(`/splits/${splitId}`, {
          receiptId,
          totalAmount,
          splitType: "equal",
          ...(sessionId ? { sessionId } : {}),
        });

        localStorage.setItem("currentSplit", JSON.stringify(updateRes.data.split));

        // Navigate to breakdown page with all query params
        const targetPath = `/split/breakdown?splitId=${splitId}&sessionId=${sessionId}&type=${type}${groupId ? `&groupId=${groupId}` : ''}`;

        // Emit socket event so participants are redirected too
        if (roomId) {
          emitHostNavigate(roomId, targetPath);
        }

        navigate(targetPath);
      } else {
        // No existing split — create a new one (direct split without session)
        const splitRes = await api.post("/splits", {
          receiptId,
          splitType: "equal",
          totalAmount,
          breakdown: [],
        });

        localStorage.setItem("currentSplit", JSON.stringify(splitRes.data.split));
        navigate(`/split/breakdown?splitId=${splitRes.data.split._id}${sessionId ? `&sessionId=${sessionId}` : ""}&type=${type || "direct"}${groupId ? `&groupId=${groupId}` : ""}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save receipt and calculate split");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <TopBar onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 min-w-0 flex-1 overflow-x-hidden px-4 py-8 pt-24 sm:mt-10 sm:px-8 md:ml-56 md:pt-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Scan Your Bill</h1>
            <p className="mt-2 text-base text-slate-500">
              {isHost
                ? "Upload a photo of your receipt to auto-fill items and prices."
                : "The host is adding items. You can watch the bill update in real-time."}
            </p>
            {!isHost && !hostLoading && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <FaLock className="text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  Only the host can add or scan items. You're viewing as a participant.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Upload Section - Host Only */}
            {isHost ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8">
              <label
                htmlFor="fileUpload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 transition hover:border-emerald-400 hover:bg-emerald-50/30"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                  <FaCloudUploadAlt className="text-3xl" />
                </div>
                <p className="text-lg font-bold text-slate-900">
                  Upload or Drag & Drop
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Supports JPG and PNG receipts
                </p>
                <input
                  id="fileUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <div className="mt-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-200"></div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  or
                </span>
                <div className="h-px flex-1 bg-zinc-200"></div>
              </div>

              <button
                type="button"
                onClick={handleCameraCapture}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-zinc-50"
              >
                <FaCamera className="text-lg" />
                Camera Capture
              </button>

              {/* Processing Indicator */}
              {isProcessing && (
                <div className="mt-8">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="animate-pulse text-emerald-500" />
                      <span className="font-semibold text-slate-700">
                        Processing Receipt...
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600">
                      {progress}% Complete
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {error && !hasItems && (
                <p className="mt-4 text-sm font-medium text-red-500 text-center">{error}</p>
              )}
            </div>
            ) : (
            /* Participant: Waiting view instead of upload */
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm flex flex-col items-center justify-center min-h-75">
              {hostLoading ? (
                <FaSpinner className="animate-spin text-3xl text-emerald-400 mb-4" />
              ) : (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500">
                    <FaLock className="text-2xl" />
                  </div>
                  <p className="text-lg font-bold text-slate-900 text-center">Host is Managing the Bill</p>
                  <p className="mt-2 text-sm text-slate-500 text-center">
                    Items will appear here in real-time as the host adds them.
                  </p>
                  <div className="mt-6 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-medium text-emerald-600">Watching live...</span>
                  </div>
                </>
              )}
            </div>
            )}

            {/* Preview Section — visible to both host and participants */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              {!scannedData && manualItems.length === 0 ? (
                <div className="flex h-full min-h-100 flex-col items-center justify-center text-center">
                  {!isHost && !hostLoading ? (
                    <>
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                        <FaSpinner className="animate-spin text-2xl text-emerald-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        Waiting for host to scan or add items...
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                        </span>
                        <span className="text-xs text-emerald-600">Live preview</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 h-20 w-20 rounded-full bg-zinc-100"></div>
                      <p className="text-sm font-semibold text-slate-400">
                        Receipt preview will appear here
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {!isHost && (
                    <div className="mb-4 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Live from host</span>
                    </div>
                  )}
                  {scannedData && (
                    <>
                      <div className="mb-6 border-b border-zinc-200 pb-4 text-center">
                        <h3 className="text-lg font-bold text-slate-900">
                          {scannedData.restaurant}
                        </h3>
                        <p className="text-xs text-slate-500">{scannedData.address}</p>
                      </div>

                      <div className="space-y-3">
                        {scannedData.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex min-w-0 items-start justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 break-words text-slate-700">{item.name}</span>
                            <span className="shrink-0 font-semibold text-slate-900">
                              NPR{item.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {manualItems.length > 0 && (
                    <>
                      {scannedData && (
                        <div className="my-4 border-t border-zinc-200 pt-4">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Manual Items
                          </p>
                        </div>
                      )}
                      <div className="space-y-3">
                        {manualItems.map((item, index) => (
                          <div
                            key={index}
                            className="flex min-w-0 items-start justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 break-words text-slate-700">{item.name}</span>
                            <span className="shrink-0 font-semibold text-slate-900">
                              NPR{item.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mt-6 border-t border-emerald-200 bg-emerald-50 px-4 py-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">
                        TOTAL
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        NPR{calculateTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Entry Section - Host Only */}
          {isHost ? (
          <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add Items Manually</h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                OPTIONAL
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-5">
                <label htmlFor="manualItemName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Item Name
                </label>
                <input
                  id="manualItemName"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., Pizza"
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="md:col-span-3">
                <label htmlFor="manualItemAssignees" className="mb-2 block text-sm font-semibold text-slate-700">
                  Assign To
                </label>
                <select
                  id="manualItemAssignees"
                  multiple
                  value={itemAssigned}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setItemAssigned(opts);
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  {participantsList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-600">Hold Ctrl/Cmd to select multiple</p>
              </div>

              <div className="md:col-span-3">
                <label htmlFor="manualItemQuantity" className="mb-2 block text-sm font-semibold text-slate-700">
                  Quantity
                </label>
                <input
                  id="manualItemQuantity"
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  min="1"
                  placeholder="1"
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="md:col-span-3">
                <label htmlFor="manualItemPrice" className="mb-2 block text-sm font-semibold text-slate-700">
                  Price (NPR)
                </label>
                <input
                  id="manualItemPrice"
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="md:col-span-1 md:self-end">
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                  title="Add Item"
                  aria-label="Add item"
                >
                  <FaPlusCircle className="text-xl" />
                </button>
              </div>
            </div>

            {manualItems.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm font-semibold text-slate-700">Added Items:</p>
                {manualItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{item.name}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        (NPR{item.unitPrice.toFixed(2)} each)
                      </span>
                      {item.assigned && item.assigned.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600">
                          Assigned to: {item.assigned.map(a => {
                            const found = participantsList.find(p => p.id === String(a));
                            return found ? found.name : a;
                          }).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        NPR{item.price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualItem(index)}
                        className="text-red-500 transition hover:text-red-600"
                        title="Remove Item"
                      >
                        <FaTrash className="text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : (
          /* Participant: Read-only list of manual items */
          manualItems.length > 0 && (
            <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Manual Items</h2>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                  ADDED BY HOST
                </span>
              </div>
              <div className="space-y-2">
                {manualItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">
                      NPR{item.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
          )}

          {/* Continue Button - Host only can calculate; participants see waiting state */}
          {hasItems && (
            <div className="mt-6">
              {error && (
                <p className="mb-3 text-sm text-red-500 font-medium text-center">{error}</p>
              )}
              {isHost ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={saving}
                  className="w-full rounded-full bg-emerald-400 px-8 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <FaSpinner className="animate-spin" /> : null}
                  Calculate Split
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-full bg-zinc-100 px-8 py-4 text-lg font-semibold text-slate-500">
                  <FaSpinner className="animate-spin" />
                  Waiting for host to calculate split...
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
