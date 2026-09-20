/**
 * @fileoverview Mobile-First Scan Bill Page
 * @description Host and participant view for receipt OCR and itemized entry:
 *              - Dual upload buttons: [Take photo] (native camera) & [Choose from gallery]
 *              - Progressive OCR stages with clear feedback
 *              - Compact editable list of bill items
 *              - Manual item additions with MoneyInput (mobile decimal keyboard)
 *              - Sticky bottom action bar with bill total and safe area support
 *
 * @module pages/split/ScanBill
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import {
  FaCamera,
  FaImages,
  FaPlusCircle,
  FaTrash,
  FaSpinner,
  FaLock,
  FaArrowRight,
  FaReceipt,
} from "react-icons/fa";
import api from "../../config/config";
import { useAuth } from "../../context/authState";
import useSessionSocket, { emitItemsUpdate, emitHostNavigate } from "../../hooks/useSessionSocket";
import { formatNPR } from "../../utills/formatNPR";
import MoneyInput from "../../components/common/MoneyInput";
import LoadingButton from "../../components/common/LoadingButton";

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
          MAX_UPLOAD_DIMENSION / Math.max(img.width || 1, img.height || 1)
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
              { type: "image/jpeg" }
            );
            resolve(compressedFile);
          },
          "image/jpeg",
          JPEG_QUALITY
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

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [scannedData, setScannedData] = useState(null);
  const [manualItems, setManualItems] = useState([]);
  const [_participantsList, setParticipantsList] = useState([]);
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
  const roomId = type === "group" ? groupId : sessionId;

  useEffect(() => {
    const detectHost = async () => {
      if (type === "group" && groupId) {
        try {
          const groupRes = await api.get(`/groups/${groupId}`);
          const grp = groupRes.data.data || groupRes.data;
          const members = grp.members || [];
          const normalized = members.map((m) => {
            const id = m._id || m.id || m;
            const name =
              m.fullName ||
              m.name ||
              m.email ||
              (m.user && (m.user.fullName || m.user.name)) ||
              `User`;
            return { id: String(id), name };
          });
          setParticipantsList(normalized);
          const currentUserId = String(user?._id || user?.id || "");
          const creatorId = String(grp.createdBy?._id || grp.createdBy || "");
          setIsHost(creatorId === currentUserId);
        } catch (err) {
          console.error("Failed to load group for ScanBill:", err);
          setIsHost(false);
        } finally {
          setHostLoading(false);
        }
        return;
      }

      if (!sessionId) {
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
        const participants =
          sessionRes.data?.participants || sessionRes.data?.session?.participants || [];
        const normalized = participants.map((p) => {
          const id =
            p.user?._id ||
            p.user?.id ||
            p.participant?._id ||
            p.participant?.id ||
            p._id ||
            p.id;
          const name =
            p.name ||
            p.user?.name ||
            p.participant?.name ||
            p.email ||
            p.user?.email ||
            p.participant?.email ||
            `User`;
          return { id: String(id), name };
        });
        setParticipantsList(normalized);
        const firstP = participants[0];
        if (firstP && currentUserId) {
          const hostId = normalizeId(firstP.user || firstP.participant || firstP._id);
          setIsHost(hostId === currentUserId);
        } else {
          setIsHost(true);
        }
      } catch (err) {
        console.error("Failed to load session for ScanBill:", err);
        setIsHost(true);
      } finally {
        setHostLoading(false);
      }
    };

    detectHost();
  }, [sessionId, user, type, groupId]);

  const onItemsUpdate = useCallback((data) => {
    if (data?.items) {
      setManualItems(data.items);
    }
  }, []);

  const onHostNavigate = useCallback(
    (data) => {
      if (data?.path) navigate(data.path);
    },
    [navigate]
  );

  useSessionSocket(roomId, null, onHostNavigate, onItemsUpdate);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a receipt image (JPG, PNG, WebP)");
      return;
    }

    setError("");
    setIsProcessing(true);
    setProcessingStage("Optimizing receipt image...");

    try {
      const uploadFile = await compressImageForUpload(file);
      const image = await toBase64(uploadFile);

      setProcessingStage("Reading items with Gemini AI...");
      const response = await api.post("/bills/parse", { image }, { timeout: 60000 });
      const parsed = response.data || {};

      setProcessingStage("Preparing parsed bill items...");

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
        restaurant: parsed.restaurant || "Parsed Receipt",
        items: parsedItems,
        total: parsedTotal,
      };

      setScannedData(newScannedData);

      if (roomId) {
        emitItemsUpdate(roomId, [...parsedItems, ...manualItems]);
      }
    } catch (err) {
      console.error("OCR parse failed:", err);
      setError(
        err.response?.data?.message ||
        "Could not extract items automatically. You can add items manually below."
      );
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleAddManualItem = () => {
    const trimmed = itemName.trim();
    const priceNum = parseFloat(itemPrice);

    if (!trimmed) {
      setError("Please enter an item name");
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid positive price");
      return;
    }

    const qty = parseInt(itemQuantity, 10) || 1;
    const newItem = {
      name: qty > 1 ? `${qty}x ${trimmed}` : trimmed,
      price: priceNum * qty,
      quantity: qty,
      unitPrice: priceNum,
      assigned: itemAssigned.length > 0 ? itemAssigned : [],
    };

    const updated = [...manualItems, newItem];
    setManualItems(updated);
    setItemName("");
    setItemPrice("");
    setItemQuantity("1");
    setItemAssigned([]);
    setError("");

    if (roomId) {
      const allItems = [...(scannedData?.items || []), ...updated];
      emitItemsUpdate(roomId, allItems);
    }
  };

  const handleRemoveManualItem = (index) => {
    const updated = manualItems.filter((_, idx) => idx !== index);
    setManualItems(updated);
    if (roomId) {
      const allItems = [...(scannedData?.items || []), ...updated];
      emitItemsUpdate(roomId, allItems);
    }
  };

  const allItemsList = [...(scannedData?.items || []), ...manualItems];
  const billTotal = allItemsList.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const hasItems = allItemsList.length > 0;

  const handleContinue = async () => {
    if (!hasItems) {
      setError("Please add at least one item before continuing");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const receiptRes = await api.post("/receipts", {
        restaurant: scannedData?.restaurant || "Manual Bill",
        totalAmount: billTotal,
        items: allItemsList,
      });

      const receiptId =
        receiptRes.data?.receipt?._id ||
        receiptRes.data?.receipt?.id ||
        receiptRes.data?.data?.id ||
        receiptRes.data?.id;

      if (splitId) {
        const updateRes = await api.put(`/splits/${splitId}`, {
          receiptId,
          totalAmount: billTotal,
          splitType: "equal",
          ...(sessionId ? { sessionId } : {}),
        });

        localStorage.setItem("currentSplit", JSON.stringify(updateRes.data.split));
        const targetPath = `/split/breakdown?splitId=${splitId}&sessionId=${sessionId}&type=${type}${groupId ? `&groupId=${groupId}` : ""
          }`;

        if (roomId) {
          emitHostNavigate(roomId, targetPath);
        }

        navigate(targetPath);
      } else {
        const splitRes = await api.post("/splits", {
          receiptId,
          splitType: "equal",
          totalAmount: billTotal,
          breakdown: [],
        });

        localStorage.setItem("currentSplit", JSON.stringify(splitRes.data.split));
        navigate(
          `/split/breakdown?splitId=${splitRes.data.split._id}${sessionId ? `&sessionId=${sessionId}` : ""
          }&type=${type || "direct"}${groupId ? `&groupId=${groupId}` : ""}`
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save receipt and calculate split");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell hideBottomNav={true} title="Bill Setup" backTo="/dashboard">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10 space-y-6">
        {/* Header */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Bill Setup
          </span>
          <h1 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
            Scan or enter your bill
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isHost
              ? "Take a photo of the receipt or type dishes manually."
              : "The host is setting up the bill. Items appear live on your screen."}
          </p>
          {!isHost && !hostLoading && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
              <FaLock className="text-amber-500 text-xs shrink-0" />
              <span>Host is adding items. Your screen synchronizes live.</span>
            </div>
          )}
        </div>

        {/* Upload Action Section - Host Only */}
        {isHost && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Receipt Scan
            </h2>

            {/* Hidden native inputs */}
            <input
              id="fileUpload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              id="cameraUpload"
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Dual Mobile Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50/70 p-3.5 text-xs font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer min-h-12 touch-manipulation active:scale-95"
              >
                <FaCamera className="text-sm text-emerald-700" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-zinc-50 transition-colors cursor-pointer min-h-12 touch-manipulation active:scale-95"
              >
                <FaImages className="text-sm text-slate-500" />
                <span>Choose Gallery</span>
              </button>
            </div>

            {/* Processing State */}
            {isProcessing && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                <div className="flex items-center gap-3">
                  <FaSpinner className="animate-spin text-emerald-700 text-sm" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{processingStage}</p>
                    <p className="text-[11px] text-slate-500">AI is extracting prices and dishes...</p>
                  </div>
                </div>
              </div>
            )}

            {error && !hasItems && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </section>
        )}

        {/* Bill Preview / Extracted Items */}
        <section className="space-y-3 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Bill Items ({allItemsList.length})
            </h2>
            {hasItems && (
              <span className="text-sm font-semibold text-emerald-800">
                {formatNPR(billTotal)}
              </span>
            )}
          </div>

          {!hasItems ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-6 text-center text-slate-400">
              <FaReceipt className="mx-auto text-xl text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-600">No items yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Take a photo or enter items below
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Scanned Items */}
              {scannedData && scannedData.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {scannedData.restaurant}
                  </p>
                  {scannedData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-white p-3 border border-zinc-200 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className="font-semibold text-slate-900">
                        {formatNPR(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Items */}
              {manualItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Manual Items
                  </p>
                  {manualItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-white p-3 border border-zinc-200 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-900">
                          {formatNPR(item.price)}
                        </span>
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManualItem(idx)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            aria-label="Remove item"
                          >
                            <FaTrash className="text-xs" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Row */}
              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-3 text-xs font-semibold">
                <span className="text-slate-700">Total</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatNPR(billTotal)}
                  <span className="sr-only">NPR{billTotal.toFixed(2)}</span>
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Manual Item Entry - Host Only */}
        {isHost && (
          <section className="space-y-3 pt-2 border-t border-zinc-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Add item manually
            </h2>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="manualItemName"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Item Name
                </label>
                <input
                  id="manualItemName"
                  aria-label="Item Name"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Momo, Coke, Fries"
                  className="w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="manualItemQuantity"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Quantity
                  </label>
                  <input
                    id="manualItemQuantity"
                    aria-label="Quantity"
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <MoneyInput
                    label="Price (NPR)"
                    value={itemPrice}
                    onChange={setItemPrice}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="manualItemAssign"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Assign To
                </label>
                <select
                  id="manualItemAssign"
                  aria-label="Assign To"
                  value={itemAssigned[0] || ""}
                  onChange={(e) => setItemAssigned(e.target.value ? [e.target.value] : [])}
                  className="w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All / Split</option>
                  {_participantsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                aria-label="Add item"
                onClick={handleAddManualItem}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-95 cursor-pointer min-h-11"
              >
                <FaPlusCircle className="text-xs" />
                <span>Add item</span>
              </button>
            </div>
          </section>
        )}

        {/* Sticky Mobile & Desktop Action Bar */}
        {hasItems && (
          <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pt-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Bill
                </p>
                <p className="text-base sm:text-lg font-semibold text-slate-900">
                  {formatNPR(billTotal)}
                  <span className="sr-only">NPR{billTotal.toFixed(2)}</span>
                </p>
              </div>

              {isHost ? (
                <div className="flex-1 max-w-56">
                  <LoadingButton
                    fullWidth
                    size="lg"
                    loading={saving}
                    loadingText="Saving..."
                    onClick={handleContinue}
                    icon={<FaArrowRight />}
                  >
                    Calculate Split
                  </LoadingButton>
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-500">
                  Waiting for host...
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
