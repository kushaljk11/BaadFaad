import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../../config/config";
import { base64Decode } from "../../../utills/helper";

const Failure = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const token = queryParams.get("data");
  const decoded = token ? base64Decode(token) : null;
  const product_id =
    decoded?.transaction_uuid ||
    queryParams.get("purchase_order_id") ||
    sessionStorage.getItem("current_transaction_id");

  useEffect(() => {
    if (!product_id) return;
    const verifyFailure = async () => {
      try {
        await api.post("/payment/payment-status", { product_id });
      } catch (error) {
        console.error("Error verifying payment status:", error);
      }
    };
    verifyFailure();
  }, [product_id]);

  return (
    <div className="failure-container">
      <div className="status-icon error">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <h1>Payment Failed!</h1>
      <p className="failure-message">
        There was an issue processing your payment.
      </p>

      <div className="failure-details">
        <p>
          <strong>Transaction ID:</strong> {product_id || "Not available"}
        </p>
        <p>
          If the amount was deducted from your account, it will be refunded
          within 3-5 business days.
        </p>
      </div>

      <div className="action-buttons">
        <button onClick={() => navigate("/")} className="go-home-button">
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default Failure;
