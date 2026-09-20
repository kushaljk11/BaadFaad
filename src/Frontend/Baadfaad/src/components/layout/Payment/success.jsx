/**
 * @fileoverview Payment Verification & Success Screen
 * @description Handles wallet callback and performs authoritative verification.
 *              Guaranteed Behaviors:
 *              - Shows explicit "Verifying your payment..." loading state
 *              - Only displays success after backend API verifies the transaction
 *              - Navigates to failure screen if verification fails or is rejected
 *              - Shows transaction details with formatNPR
 *
 * @module components/layout/Payment/success
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../../config/config";
import { base64Decode } from "../../../utills/helper";
import { formatNPR } from "../../../utills/formatNPR";
import { FaCheckCircle, FaSpinner, FaArrowRight } from "react-icons/fa";
import LoadingButton from "../../common/LoadingButton";

export default function PaymentSuccess() {
  const [isLoading, setIsLoading] = useState(true);
  const [verificationError, setVerificationError] = useState(false);
  const [verifiedPayment, setVerifiedPayment] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const token = queryParams.get("data");
  const decoded = token ? base64Decode(token) : null;
  const productId =
    decoded?.transaction_uuid ||
    queryParams.get("purchase_order_id") ||
    sessionStorage.getItem("current_transaction_id");

  useEffect(() => {
    let isMounted = true;
    const verify = async () => {
      if (!productId) {
        if (isMounted) {
          setIsLoading(false);
          setVerificationError(true);
        }
        return;
      }

      try {
        const response = await api.post("/payment/payment-status", {
          product_id: productId,
          pidx: queryParams.get("pidx"),
        });

        if (!isMounted) return;
        setIsLoading(false);

        if (response.data.status === "COMPLETED") {
          setVerifiedPayment(response.data);
        } else {
          navigate(`/payment-failure?purchase_order_id=${productId}`);
        }
      } catch (error) {
        console.error("Payment confirmation error:", error);
        if (!isMounted) return;
        setIsLoading(false);
        setVerificationError(true);
        if (error.response?.status === 400) {
          navigate(`/payment-failure?purchase_order_id=${productId}`);
        }
      }
    };

    verify();
    return () => {
      isMounted = false;
    };
  }, [navigate, productId, queryParams]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-2xs max-w-md w-full space-y-4">
          <span className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <FaSpinner className="animate-spin text-2xl" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Verifying your payment...</h1>
          <p className="text-xs text-slate-500">
            Communicating with payment gateway to confirm the transaction.
          </p>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-2xs max-w-md w-full space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Unable to Verify Payment</h1>
          <p className="text-xs text-slate-500">
            Your transaction was processed, but we couldn't confirm the final status. If
            amount was deducted, it will reconcile automatically.
          </p>
          <p className="text-xs font-mono text-slate-400">Ref: {productId || "Unknown"}</p>
          <LoadingButton fullWidth onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </LoadingButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-2xs max-w-md w-full space-y-6">
        <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <FaCheckCircle className="text-3xl" />
        </span>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Successful!</h1>
          <p className="mt-1 text-xs text-slate-500">
            Your split settlement has been recorded and verified.
          </p>
        </div>

        {/* Details Card */}
        <div className="transaction-details rounded-2xl bg-zinc-50 p-4 border border-zinc-200 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-bold text-slate-900 text-sm">
              {verifiedPayment?.currency ? `${verifiedPayment.currency} ${verifiedPayment.amount}` : formatNPR(verifiedPayment?.amount || 0)}
            </span>
          </div>
          {verifiedPayment?.gateway && (
            <div className="flex items-center justify-between text-xs border-t border-zinc-200/60 pt-2">
              <span className="text-slate-500">Payment Gateway</span>
              <span className="font-bold text-slate-800 capitalize">
                {String(verifiedPayment.gateway).charAt(0).toUpperCase() + String(verifiedPayment.gateway).slice(1)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs border-t border-zinc-200/60 pt-2">
            <span className="text-slate-500">Transaction ID</span>
            <span className="font-mono text-slate-700 truncate max-w-45">
              {productId}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-zinc-200/60 pt-2">
            <span className="text-slate-500">Status</span>
            <span className="font-bold text-emerald-600 uppercase">Confirmed</span>
          </div>
        </div>

        <div className="space-y-2">
          <LoadingButton
            fullWidth
            size="lg"
            onClick={() => navigate("/dashboard")}
            icon={<FaArrowRight />}
          >
            Go to Dashboard
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
