import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import API_ENDPOINTS from "../../config/api";
import "./Orders.css";

const ORDER_STATUSES = [
  "all",
  "Pending",
  "Order Placed",
  "Pickup Scheduled",
  "Out For Pickup",
  "Picked Up",
  "Shipped",
  "Out For Delivery",
  "Delivered",
  "Undelivered",
  "RTO Initiated",
  "RTO In Transit",
  "RTO Delivered",
  "Cancel Requested",
  "Return Requested",
  "Return Initiated",
  "Out For Return Pickup",
  "Return Picked Up",
  "Return Completed",
  "Exchange Requested",
  "Exchange Initiated",
  "Exchange Pickup Scheduled",
  "Exchange Picked Up",
  "Exchange Completed",
  "Re-dispatch Requested",
  "Re-dispatch Payment Pending",
  "Re-dispatch Paid",
  "Re-dispatched",
  "Cancelled",
  "Seller Cancelled",
];

const REFUND_STATUSES = [
  "Bank Details Required",
  "Bank Details Submitted",
  "Refund Pending",
  "Refund Processing",
  "Refund Paid",
  "Not Required",
];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getCanonicalOrderStatus = (status) => {
  const normalized = String(status || "Pending").toLowerCase();
  if (normalized === "processing") return "Order Placed";
  if (normalized === "awb assigned" || normalized === "awb_assigned") return "Picked Up";
  return status || "Pending";
};

const getActionCounts = (order) => (order.OrderItems || []).flatMap((item) => item.actions || []).reduce((map, action) => ({
  ...map,
  [action.action_type]: (map[action.action_type] || 0) + 1,
}), {});

const getItemStatusLabel = (status) => {
  const normalized = String(status || "Active").toLowerCase();
  if (normalized === "active") return "Same as order";
  if (normalized.includes("cancel")) return normalized.includes("partial") ? "Partially cancelled" : "Cancelled";
  if (normalized.includes("return") || normalized.includes("exchange")) return status;
  return status || "Same as order";
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "all", paymentMethod: "all", customer: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundForm, setRefundForm] = useState({ refund_status: "Refund Paid", refund_payment_reference: "", refund_note: "" });
  const [savingRefund, setSavingRefund] = useState(false);
  // Only the transfer receipt now. The inspection and its damage photos moved to the Returns
  // and Exchanges tabs, which own those flows end to end.
  const [proofImages, setProofImages] = useState([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState(null);

  const filteredStatusOptions = useMemo(() => {
    const fromOrders = orders.map((order) => getCanonicalOrderStatus(order.status)).filter(Boolean);
    return Array.from(new Set([...ORDER_STATUSES, ...fromOrders]));
  }, [orders]);

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.paymentMethod !== "all") params.set("paymentMethod", filters.paymentMethod);
      if (filters.customer.trim()) params.set("customer", filters.customer.trim());
      const response = await fetch(`${API_ENDPOINTS.orders}?${params.toString()}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load orders.");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [filters.status, filters.paymentMethod]);

  const submitSearch = (event) => {
    event.preventDefault();
    loadOrders();
  };

  /**
   * The refund this page is responsible for: one with NO item action behind it.
   *
   * Returns and exchanges are settled end-to-end in their own tabs, which is where the
   * inspection, the verdict and the payout belong. What never reaches those queues — because
   * both are built from `order_item_actions` — is a refund that has no action at all:
   * a whole-order cancellation (`full_cancel`) or an RTO. This page is the only place those
   * can be settled, and that is now the only thing it does.
   */
  const standaloneRefundOf = (order) => (Array.isArray(order?.refunds) ? order.refunds : [])
    .find((refund) => !refund.order_item_action_id) || null;

  const openRefundModal = (order) => {
    const refund = standaloneRefundOf(order);
    if (!refund) return;
    // The specific row, not the order's "latest" — see the refund_id note in savePayment.
    setSelectedOrder({ ...order, _refund: refund });
    setRefundForm({
      refund_status: refund.status || "Refund Paid",
      refund_payment_reference: refund.gateway_refund_id || "",
      refund_note: refund.note || "",
    });
    setProofImages(Array.isArray(refund.proof_images) ? refund.proof_images : []);
  };

  /**
   * Straight to Cloudinary with a signed request, same path the seed-review images use, so
   * nothing large passes through our API. Shared by both photo sets on this modal.
   */
  const uploadImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return [];
    const sigRes = await fetch(`${API_ENDPOINTS.products}/upload-signature?resourceType=image`, { headers: authHeaders() });
    if (!sigRes.ok) throw new Error("Failed to get upload signature.");
    const sig = await sigRes.json();
    return Promise.all(files.map(async (file) => {
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.error?.message || "Upload failed.");
      return { url: data.secure_url };
    }));
  };

  // The transfer screenshot / NEFT receipt.
  const uploadProof = async (fileList) => {
    setUploadingProof(true);
    setError("");
    try {
      const uploaded = await uploadImages(fileList);
      setProofImages((current) => [...current, ...uploaded].slice(0, 4));
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploadingProof(false);
    }
  };

  /**
   * The inspection form has MOVED to the Returns and Exchanges tabs.
   *
   * It never belonged here: an inspection is the act of opening a returned parcel, which only
   * happens on a return or an exchange — and both of those are now driven end-to-end from
   * their own queue, where the verdict, the amount and the payout sit on one row. The refunds
   * this page still settles (a cancellation, an RTO) have no parcel to inspect, so the form
   * had nothing to act on and only offered a second, divergent path to the same endpoint.
   */

  const saveRefundStatus = async (event) => {
    event.preventDefault();
    if (!selectedOrder) return;
    setSavingRefund(true);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/${selectedOrder.id}/refund-status`, {
        method: "PATCH",
        headers: authHeaders(),
        // Proof rides along with the status change — the moment it is marked paid is exactly
        // when the receipt exists. `refund_id` names the cancellation/RTO row this modal
        // opened, so an order that ALSO carries a return refund cannot have the wrong one
        // settled by date order.
        body: JSON.stringify({
          refund_id: selectedOrder._refund?.id,
          ...refundForm,
          proof_images: proofImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update refund status.");
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      setError(err.message || "Unable to update refund status.");
    } finally {
      setSavingRefund(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    setSavingStatusId(orderId);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/${orderId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update order status.");
      await loadOrders();
    } catch (err) {
      setError(err.message || "Unable to update order status.");
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="brand-font text-xl font-bold text-[#800020]">Orders</h2>
          <p className="mt-1 text-xs text-[#4A3F35]/60">All customer orders, payment method, item requests and refund status.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex items-center gap-2 rounded-lg border border-[#800020]/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#800020]"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <form onSubmit={submitSearch} className="orders-filter-bar">
        <div className="orders-filter-input">
          <Search className="h-4 w-4" />
          <input
            value={filters.customer}
            onChange={(event) => setFilters((current) => ({ ...current, customer: event.target.value }))}
            placeholder="Search by customer, email, phone or order id"
          />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          {filteredStatusOptions.map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>)}
        </select>
        <select value={filters.paymentMethod} onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))}>
          <option value="all">All payments</option>
          <option value="COD">COD</option>
          <option value="Prepaid">Prepaid</option>
        </select>
        <button type="submit"><SlidersHorizontal className="h-4 w-4" /> Apply</button>
      </form>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400 border-b border-[#D4AF37]/10">
              <tr>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Items</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4">Requests</th>
                <th className="px-5 py-4">Refund</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-white">
              {loading && <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="9">Loading orders...</td></tr>}
              {!loading && orders.length === 0 && <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="9">No orders found.</td></tr>}
              {!loading && orders.map((order) => {
                const actionCounts = getActionCounts(order);
                const paymentIcon = String(order.payment_method).toUpperCase() === "COD" ? Banknote : CreditCard;
                const PaymentIcon = paymentIcon;
                return (
                  <tr key={order.id} className="hover:bg-[#FAF8F6]/60 transition-colors align-top">
                    <td className="px-5 py-4 font-mono font-bold text-[#4A3F35]">
                      {order.order_number || `#${order.id}`}
                      <div className="mt-1 font-sans text-[10px] font-normal text-gray-400">{formatDate(order.createdAt)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#4A3F35]">{order.customer_name}</div>
                      <div className="text-[10px] text-gray-400">{order.customer_email}</div>
                      <div className="text-[10px] text-gray-400">{order.phone}</div>
                    </td>
                    <td className="px-5 py-4">
                      {(order.OrderItems || []).slice(0, 2).map((item) => (
                        <div key={item.id} className="mb-2">
                          <span className="block font-semibold text-[#4A3F35]">{item.product_name}</span>
                          <span className="mt-1 inline-flex rounded-full bg-[#FAF8F6] px-2 py-0.5 text-[10px] font-semibold text-[#800020]">
                            Qty {Math.max(0, (item.quantity || 0) - (item.cancelled_quantity || 0))}{item.cancelled_quantity > 0 ? ` (${item.cancelled_quantity} cancelled)` : ""} - {getItemStatusLabel(item.status)}
                          </span>
                        </div>
                      ))}
                      {(order.OrderItems || []).length > 2 && <span className="text-[10px] text-gray-400">+{order.OrderItems.length - 2} more</span>}
                    </td>
                    <td className="px-5 py-4 font-bold text-[#D4AF37]">{formatMoney(order.payable_amount || order.total_amount)}</td>
                    <td className="px-5 py-4">
                      <select
                        className="orders-status-select"
                        value={getCanonicalOrderStatus(order.status)}
                        disabled={savingStatusId === order.id}
                        onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                      >
                        {filteredStatusOptions.filter((status) => status !== "all").map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-600">
                        <PaymentIcon className="h-3.5 w-3.5 text-[#800020]" />
                        <span className="text-[10px] font-bold uppercase">{order.payment_method}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400">{order.payment_status}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {["cancel", "return", "exchange"].map((type) => (
                          actionCounts[type] ? <span key={type} className="rounded bg-[#FAF8F6] px-2 py-1 text-[10px] font-bold uppercase text-[#800020]">{type}: {actionCounts[type]}</span> : null
                        ))}
                        {!actionCounts.cancel && !actionCounts.return && !actionCounts.exchange && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#4A3F35]">{order.refund_status || "-"}</div>
                      {order.refund_amount > 0 && <div className="text-[10px] text-gray-400">{formatMoney(order.refund_amount)}</div>}
                    </td>
                    {/* Only where this page is the right tool. It used to render on EVERY
                        row: on an order with no refund at all it opened a form that could
                        only answer "No refund record found", and on a return or exchange it
                        offered a second, weaker path to a job the tabs now do properly. */}
                    <td className="px-5 py-4 text-right">
                      {standaloneRefundOf(order) ? (
                        <button
                          type="button"
                          onClick={() => openRefundModal(order)}
                          className="rounded border border-[#800020]/20 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#800020]"
                        >
                          Refund
                        </button>
                      ) : (
                        <span
                          className="text-[10px] text-gray-400"
                          title={actionCounts.return || actionCounts.exchange
                            ? "Settled from the Returns or Exchanges tab"
                            : "No refund on this order"}
                        >
                          {actionCounts.return || actionCounts.exchange ? "In queue" : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="orders-modal-backdrop">
          <form className="orders-refund-modal" onSubmit={saveRefundStatus}>
            <div>
              <h3>Refund status</h3>
              <p>{selectedOrder.order_number || `#${selectedOrder.id}`} · {selectedOrder.customer_name}</p>
            </div>
            {selectedOrder.payment_method === "COD" && (
              <div className="orders-bank-box">
                <strong>Where to send the refund</strong>
                {!selectedOrder.refund_bank_details ? (
                  <span>Not submitted yet.</span>
                ) : selectedOrder.refund_bank_details.method === "upi" ? (
                  <>
                    <span>UPI</span>
                    <span>{selectedOrder.refund_bank_details.upi_id}</span>
                  </>
                ) : (
                  <>
                    <span>{selectedOrder.refund_bank_details.account_holder_name}</span>
                    <span>{selectedOrder.refund_bank_details.bank_name} · {selectedOrder.refund_bank_details.ifsc_code}</span>
                    <span>Account ending {selectedOrder.refund_bank_details.account_number_last4}</span>
                  </>
                )}
              </div>
            )}

            <label>
              Refund status
              <select value={refundForm.refund_status} onChange={(event) => setRefundForm((current) => ({ ...current, refund_status: event.target.value }))}>
                {REFUND_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              Payment reference
              <input value={refundForm.refund_payment_reference} onChange={(event) => setRefundForm((current) => ({ ...current, refund_payment_reference: event.target.value }))} placeholder="Bank UTR / Razorpay refund id" />
            </label>
            <label>
              Note
              <textarea value={refundForm.refund_note} onChange={(event) => setRefundForm((current) => ({ ...current, refund_note: event.target.value }))} rows={4} />
            </label>

            {/* Transfer proof. The customer sees these — for a COD refund there is no gateway
                record they can check themselves, and even on prepaid a screenshot answers
                "has it actually been sent?" without a support message. */}
            <label>
              Payment proof — <em>shown to the customer</em>
              <div className="orders-proof-row">
                {proofImages.map((image, index) => (
                  <span className="orders-proof-thumb" key={`${image.url}-${index}`}>
                    <img src={image.url} alt="" />
                    <button
                      type="button"
                      onClick={() => setProofImages((current) => current.filter((_, i) => i !== index))}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {proofImages.length < 4 && (
                  <label className="orders-proof-add">
                    {uploadingProof ? "Uploading…" : "+ Add"}
                    <input type="file" accept="image/*" multiple hidden onChange={(event) => uploadProof(event.target.files)} />
                  </label>
                )}
              </div>
            </label>
            <div className="orders-modal-actions">
              <button type="button" onClick={() => setSelectedOrder(null)}>Cancel</button>
              <button type="submit" disabled={savingRefund}>{savingRefund ? "Saving..." : "Save refund"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
