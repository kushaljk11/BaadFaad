/**
 * @fileoverview Scan Bill Page
 * @description Host and participant page for receipt OCR and itemized entry.
 *              Key Features:
 *              - Progressive OCR parsing stages with clear messages
 *              - Manual item additions with MoneyInput (mobile decimal keyboard)
 *              - Real-time Socket.IO synchronization of bill items
 *              - Canonical रु currency formatting via formatNPR
 *              - Sticky mobile action bar with bill total
 *
 * @module pages/split/ScanBill
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SideBar from "../../components/layout/Dashboard/SideBar";
import TopBar from "../../components/layout/Dashboard/TopBar";
import {
  FaCloudUploadAlt,
  FaCamera,
  FaCheckCircle,
  FaPlusCircle,
  FaTrash,
  FaSpinner,
  FaLock,
  FaArrowRight,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        }
      } catch (err) {
        console.error("Failed to detect host:", err);
        setIsHost(false);
      } finally {
        setHostLoading(false);
      }
    };
    detectHost();
  }, [sessionId, user, type, groupId]);

  const onItemsUpdate = useCallback((data) => {
    if (data?.scannedData !== undefined) setScannedData(data.scannedData);
    if (data?.manualItems !== undefined) setManualItems(data.manualItems);
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
    setProcessingStage("Optimizing & uploading receipt...");

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
        address: parsed.address || "",
        items: parsedItems,
        total: parsedTotal,
      };

      setScannedData(newScannedData);

      if (roomId) {
        emitItemsUpdate(roomId, newScannedData, manualItems);
      }
    } catch (err) {
      setScannedData(null);
      const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
      setError(
        isTimeout
          ? "Receipt reading timed out. Try a clearer or smaller photo, or add items manually."
          : err.response?.data?.error ||
          err.response?.data?.message ||
          "Could not parse receipt. You can enter items manually below."
      );
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
      e.target.value = "";
    }
  };

  const handleAddManualItem = () => {
    const trimmed = itemName.trim();
    const priceNum = parseFloat(itemPrice);
    const qtyNum = parseInt(itemQuantity, 10) || 1;

    if (!trimmed) {
      setError("Enter an item name");
      return;
    }
    if (!itemPrice || isNaN(priceNum) || priceNum <= 0) {
      setError("Enter a price greater than रु 0");
      return;
    }

    setError("");
    const newItem = {
      name: `${qtyNum > 1 ? `${qtyNum}x ` : ""}${trimmed}`,
      price: priceNum * qtyNum,
      quantity: qtyNum,
      unitPrice: priceNum,
      assigned: itemAssigned.slice(),
    };

    const updated = [...manualItems, newItem];
    setManualItems(updated);
    setItemName("");
    setItemPrice("");
    setItemQuantity("1");
    setItemAssigned([]);

    if (roomId) {
      emitItemsUpdate(roomId, scannedData, updated);
    }
  };

  const handleRemoveManualItem = (index) => {
    const updated = manualItems.filter((_, i) => i !== index);
    setManualItems(updated);
    if (roomId) {
      emitItemsUpdate(roomId, scannedData, updated);
    }
  };

  const calculateTotal = () => {
    const scannedTotal = scannedData ? scannedData.total : 0;
    const manualTotal = manualItems.reduce((sum, item) => sum + item.price, 0);
    return scannedTotal + manualTotal;
  };

  const hasItems = scannedData || manualItems.length > 0;
  const billTotal = calculateTotal();

  const handleContinue = async () => {
    const allItems = [
      ...(scannedData?.items || []).map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
      })),
      ...manualItems.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        assigned: item.assigned || [],
      })),
    ];

    setSaving(true);
    setError("");

    try {
      const receiptRes = await api.post("/receipts", {
        restaurant: scannedData?.restaurant || "",
        address: scannedData?.address || "",
        items: allItems,
        totalAmount: billTotal,
      });

      localStorage.setItem("currentReceipt", JSON.stringify(receiptRes.data.receipt));
      const receiptId = receiptRes.data.receipt._id;

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
    <div className="flex min-h-screen bg-zinc-50 pb-28 md:pb-8">
      <TopBar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isOpen={isMobileMenuOpen}
      />
      <SideBar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="ml-0 min-w-0 flex-1 px-4 py-6 pt-20 md:ml-56 md:px-8 md:pt-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Bill Setup
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Scan or Enter Your Bill
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isHost
                ? "Upload receipt for automatic AI parsing, or type items manually."
                : "The host is entering the bill. You can view items as they appear."}
            </p>
            {!isHost && !hostLoading && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-800">
                <FaLock className="text-amber-500 text-sm shrink-0" />
                <span>Host is adding items. Your screen synchronizes live.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Upload Section - Host Only */}
            {isHost ? (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4 sm:p-6">
                <label
                  htmlFor="fileUpload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/40"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-2xs">
                    <FaCloudUploadAlt className="text-2xl" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-slate-900">
                    Upload Receipt Photo
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG, or camera snapshot
                  </p>
                  <input
                    id="fileUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* Processing Feedback */}
                {isProcessing && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-center gap-3">
                      <FaSpinner className="animate-spin text-emerald-600 text-base" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{processingStage}</p>
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
              </div>
            ) : (
              /* Participant view */
              <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xs flex flex-col items-center justify-center text-center min-h-55">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <FaSpinner className="animate-spin text-xl" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-900">Host is managing the bill</p>
                <p className="mt-1 text-xs text-slate-500">
                  Items will appear on the right side in real time.
                </p>
              </div>
            )}

            {/* Receipt Preview */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Bill Preview
                </h2>
                {hasItems && (
                  <span className="text-xs font-bold text-emerald-800">
                    {formatNPR(billTotal)}
                  </span>
                )}
              </div>

              {!hasItems ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs font-medium">No items yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Upload a receipt or add items manually below
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {scannedData && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-800">
                        {scannedData.restaurant}
                      </p>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {scannedData.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 border-b border-zinc-50"
                          >
                            <span className="text-slate-700">{item.name}</span>
                            <span className="font-bold text-slate-900">
                              {formatNPR(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {manualItems.length > 0 && (
                    <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                      <p className="text-xs font-bold text-slate-800">Manual Items</p>
                      {manualItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1"
                        >
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-bold text-slate-900">
                            {formatNPR(item.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary row */}
                  <div className="rounded-2xl bg-zinc-50 p-3.5 flex items-center justify-between border border-zinc-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Total Bill
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {formatNPR(billTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Item Entry - Host Only */}
          {isHost && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
                Add Items Manually
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-4">
                  <label htmlFor="manualItemName" className="mb-1 block text-xs font-bold text-slate-600">
                    Item Name
                  </label>
                  <input
                    id="manualItemName"
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Chicken Momo, Cold Drink"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="manualItemAssign" className="mb-1 block text-xs font-bold text-slate-600">
                    Assign To
                  </label>
                  <select
                    id="manualItemAssign"
                    aria-label="Assign To"
                    value={itemAssigned[0] || ""}
                    onChange={(e) => setItemAssigned(e.target.value ? [e.target.value] : [])}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">All / Split</option>
                    {_participantsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="manualItemQuantity" className="mb-1 block text-xs font-bold text-slate-600">
                    Quantity
                  </label>
                  <input
                    id="manualItemQuantity"
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <MoneyInput
                    label="Price (NPR)"
                    value={itemPrice}
                    onChange={setItemPrice}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  aria-label="Add item"
                  onClick={handleAddManualItem}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 active:scale-95 cursor-pointer"
                >
                  <FaPlusCircle />
                  <span>Add item</span>
                </button>
              </div>

              {/* Added manual items list */}
              {manualItems.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
                  {manualItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs border border-zinc-200"
                    >
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">
                          {formatNPR(item.price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualItem(idx)}
                          className="text-zinc-400 hover:text-red-500 p-1 transition cursor-pointer"
                          aria-label="Remove item"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Mobile & Desktop Action Bar */}
      {hasItems && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-3.5 backdrop-blur-md shadow-lg md:left-56">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Bill
              </p>
              <p className="text-lg font-black text-slate-900">
                {formatNPR(billTotal)}
                <span className="sr-only">NPR{billTotal.toFixed(2)}</span>
              </p>
            </div>

            {isHost ? (
              <LoadingButton
                size="lg"
                loading={saving}
                loadingText="Saving Bill..."
                onClick={handleContinue}
                icon={<FaArrowRight />}
              >
                Calculate Split
              </LoadingButton>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                Waiting for host to proceed...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
