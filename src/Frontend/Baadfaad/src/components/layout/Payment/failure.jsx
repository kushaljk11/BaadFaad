/**
 * @fileoverview Payment Failure Screen
 * @description Informs user of payment failure or cancellation with recovery actions.
 *
 * @module components/layout/Payment/failure
 */

import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../../config/config";
import { base64Decode } from "../../../utills/helper";
import { FaTimesCircle } from "react-icons/fa";
import LoadingButton from "../../common/LoadingButton";

export default function PaymentFailure() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const token = queryParams.get("data");
  const decoded = token ? base64Decode(token) : null;
  const productId =
    decoded?.transaction_uuid ||
    queryParams.get("purchase_order_id") ||
    sessionStorage.getItem("current_transaction_id");

  useEffect(() => {
    if (!productId) return;
    const verifyFailure = async () => {
      try {
        await api.post("/payment/payment-status", { product_id: productId });
      } catch (error) {
        // Log non-fatal
      }
    };
    verifyFailure();
  }, [productId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-2xs max-w-md w-full space-y-6">
        <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-red-100 text-red-600">
          <FaTimesCircle className="text-3xl" />
        </span>

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payment Failed!</h1>
          <p className="mt-1 text-xs text-slate-500">
            The transaction was not completed. If any amount was deducted, it will be
            reversed by the wallet provider within 1-3 business days.
          </p>
        </div>

        {productId && (
          <div className="failure-details rounded-2xl bg-zinc-50 p-3 text-xs text-slate-500 border border-zinc-200">
            Reference: <span className="font-mono text-slate-700">{productId}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <LoadingButton
            fullWidth
            size="lg"
            variant="primary"
            onClick={() => navigate(-1)}
          >
            Try Payment Again
          </LoadingButton>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="w-full rounded-2xl border border-zinc-300 py-3 text-xs font-semibold text-slate-700 hover:bg-zinc-50 transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
