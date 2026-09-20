import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../../config/config";
import { useAuth } from "../../../context/authState";
import { generateUniqueId } from "../../../utills/helper";

const PaymentComponent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const inputClass =
    "mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
  const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

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
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Proceed with the selected gateway (khalti or esewa). Backend will validate gateway availability.

    setIsSubmitting(true);

    try {
      const productId = generateUniqueId();
      sessionStorage.setItem("current_transaction_id", productId);

      const response = await api.post("/payment/initiate-payment", {
        ...formData,
        productId,
        splitId: splitIdFromQuery || undefined,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error("Payment URL is invalid. Please try again.");
      }
    } catch (error) {
      console.error("Error initiating payment:", error);
      const responseData = error?.response?.data;
      const errorDetails =
        typeof responseData?.error === "string"
          ? responseData.error
          : responseData?.message;
      toast.error(errorDetails || "Payment initiation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-zinc-50"
        >
          Back
        </button>

        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Payment Integration</h1>
          <p className="mt-2 text-sm text-slate-500">
            Fill in the details below to proceed with secure payment.
          </p>

          <form className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="customerName" className={labelClass}>Full Name</label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                required
                placeholder="Enter your full name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="customerEmail" className={labelClass}>Email</label>
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleChange}
                required
                placeholder="Enter your email"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="customerPhone" className={labelClass}>Phone Number</label>
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                required
                placeholder="Enter your phone number"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="productName" className={labelClass}>Product / Service</label>
              <input
                type="text"
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                required
                placeholder="Enter product/service name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="amount" className={labelClass}>Amount (NPR)</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="1"
                placeholder="Enter amount"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="paymentGateway" className={labelClass}>Payment Method</label>
              <select
                id="paymentGateway"
                name="paymentGateway"
                value={formData.paymentGateway}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
              </select>
            </div>

            <div className="sm:col-span-2 mt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {isSubmitting ? "Processing..." : "Proceed to Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentComponent;
