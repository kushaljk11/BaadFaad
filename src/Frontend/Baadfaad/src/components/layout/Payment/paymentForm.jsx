/**
 * @fileoverview Payment Form Component
 * @description Secure settlement payment form for eSewa and Khalti.
 *              Key Features:
 *              - Clean provider choice cards
 *              - Amount display formatted via formatNPR and MoneyInput
 *              - Double-click protected LoadingButton
 *
 * @module components/layout/Payment/paymentForm
 */

import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../../config/config";
import { useAuth } from "../../../context/authState";
import { generateUniqueId } from "../../../utills/helper";
import { formatNPR } from "../../../utills/formatNPR";
import LoadingButton from "../../common/LoadingButton";
import MoneyInput from "../../common/MoneyInput";
import esewaLogo from "@root-assets/esewa.png";
import khaltiLogo from "@root-assets/khalti.png";

export default function PaymentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const amountFromQuery = searchParams.get("amount") || "";
  const gatewayFromQuery = searchParams.get("gateway") || "esewa";
  const splitIdFromQuery = searchParams.get("splitId") || "";

  const [formData, setFormData] = useState({
    customerName: user?.name || "",
    customerEmail: user?.email || "",
    customerPhone: user?.phone || "",
    productName: "Split Settlement",
    amount: amountFromQuery,
    paymentGateway: gatewayFromQuery,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amtNum = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amtNum) || amtNum <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const productId = generateUniqueId();
      sessionStorage.setItem("current_transaction_id", productId);

      const response = await api.post("/payment/initiate-payment", {
        ...formData,
        amount: amtNum,
        productId,
        splitId: splitIdFromQuery || undefined,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error("Could not obtain payment redirect URL. Please try again.");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Payment initiation failed";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-zinc-50 transition cursor-pointer"
        >
          ← Back
        </button>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs sm:p-8 space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Secure Checkout
            </span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Pay Settlement
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Settle your bill share directly through eSewa or Khalti.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Gateway Selection Cards */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Select Wallet
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, paymentGateway: "esewa" }))
                  }
                  className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition cursor-pointer ${
                    formData.paymentGateway === "esewa"
                      ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <img src={esewaLogo} alt="eSewa" className="h-7 object-contain" />
                  <span className="mt-2 text-xs font-semibold text-slate-900">eSewa</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, paymentGateway: "khalti" }))
                  }
                  className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition cursor-pointer ${
                    formData.paymentGateway === "khalti"
                      ? "border-purple-500 bg-purple-50/70 ring-2 ring-purple-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <img src={khaltiLogo} alt="Khalti" className="h-7 object-contain" />
                  <span className="mt-2 text-xs font-semibold text-slate-900">Khalti</span>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <MoneyInput
                label="Amount to Settle"
                value={formData.amount}
                onChange={(val) => setFormData((prev) => ({ ...prev, amount: val }))}
                required
              />
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="customerName"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Payer Name
              </label>
              <input
                id="customerName"
                name="customerName"
                type="text"
                required
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="customerEmail"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Email Address
              </label>
              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                required
                value={formData.customerEmail}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <LoadingButton
                type="submit"
                fullWidth
                size="lg"
                loading={isSubmitting}
                loadingText="Redirecting to Wallet..."
              >
                Pay {formData.amount ? formatNPR(formData.amount) : "Now"}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
