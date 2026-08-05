import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, IndianRupee, RefreshCw, RotateCcw, Search, XCircle } from "lucide-react";
import API_ENDPOINTS from "../../config/api";

const ACTION_LABELS = {
  cancel: "Cancellation Requests",
  return: "Return Requests",
  exchange: "Exchange Requests",
};

const ACTION_ICONS = {
  cancel: XCircle,
  return: RotateCcw,
  exchange: RefreshCw,
};

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

// What an exchange must SHIP, as a list. Mirrors utils/exchangeTargets.js on the backend:
// current rows carry meta.exchange_targets; earlier rows carry a single
// exchange_product_id/exchange_color_id; a like-for-like swap carries neither.
const exchangeTargetsOf = (line) => {
  const meta = line?.meta || {};
  if (Array.isArray(meta.exchange_targets) && meta.exchange_targets.length) {
    return meta.exchange_targets;
  }
  if (meta.exchange_product_id || meta.exchange_color_id) {
    return [{
      product_id: meta.exchange_product_id || line?.OrderItem?.product_id,
      product_name: meta.exchange_product_name || line?.OrderItem?.product_name,
      color_id: meta.exchange_color_id ?? null,
      color_name: meta.exchange_color_name || null,
      quantity: line?.quantity || 1,
    }];
  }
  return [];
};

const ACTION_STATUSES = ["all", "Initiated", "Completed", "Rejected", "Cancelled"];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

export default function OrderActions({ type = "return" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  /**
   * Inspection, handled here rather than on the Orders page.
   *
   * Deciding what the customer is owed and paying it are two halves of the same job, and they
   * used to live on two different screens — inspect under Orders → Refund, initiate under
   * Returns — with only a warning to keep them in order. Both now sit on the row they belong
   * to, so the sequence is the layout rather than a caution the admin can read past.
   */
  const [inspectRow, setInspectRow] = useState(null);
  const [inspectForm, setInspectForm] = useState({ inspected_amount: "", inspection_note: "" });
  const [inspectionImages, setInspectionImages] = useState([]);
  const [uploadingInspection, setUploadingInspection] = useState(false);
  const [savingInspection, setSavingInspection] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const Icon = ACTION_ICONS[type] || RotateCcw;
  const title = ACTION_LABELS[type] || "Order Requests";

  const counts = useMemo(() => rows.reduce((map, row) => ({
    ...map,
    [row.status]: (map[row.status] || 0) + 1,
  }), {}), [rows]);

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`${API_ENDPOINTS.orders}/admin/item-actions?${params.toString()}`, {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load requests.");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [type, statusFilter]);

  const updateStatus = async (id, status) => {
    setSavingId(id);
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/admin/item-actions/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update request.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to update request.");
    } finally {
      setSavingId(null);
    }
  };

  const openInspect = (row) => {
    setInspectRow(row);
    // Pre-filled with whatever the inspection already concluded, else the quote — so the
    // common case, a return with nothing wrong with it, is one click.
    setInspectForm({
      inspected_amount: String(row.refund_inspected_amount ?? row.refund_quoted_amount ?? row.estimated_refund_amount ?? ""),
      inspection_note: row.refund_inspection_note || "",
    });
    setInspectionImages(Array.isArray(row.refund_inspection_images) ? row.refund_inspection_images : []);
    setInspectError("");
  };

  // Signed Cloudinary upload, the same path the seed-review images use, so nothing large
  // passes through our API.
  const uploadInspectionImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploadingInspection(true);
    setInspectError("");
    try {
      const sigRes = await fetch(`${API_ENDPOINTS.products}/upload-signature?resourceType=image`, { headers: authHeaders() });
      if (!sigRes.ok) throw new Error("Failed to get upload signature.");
      const sig = await sigRes.json();
      const uploaded = await Promise.all(files.map(async (file) => {
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
      setInspectionImages((current) => [...current, ...uploaded].slice(0, 4));
    } catch (err) {
      setInspectError(err.message || "Upload failed.");
    } finally {
      setUploadingInspection(false);
    }
  };

  const saveInspection = async () => {
    if (!inspectRow?.refund_id) return;
    setSavingInspection(true);
    setInspectError("");
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/refunds/${inspectRow.refund_id}/inspection`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          inspected_amount: Number(inspectForm.inspected_amount),
          inspection_note: inspectForm.inspection_note,
          inspection_images: inspectionImages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to record the inspection.");
      setInspectRow(null);
      await loadRows();
    } catch (err) {
      setInspectError(err.message || "Unable to record the inspection.");
    } finally {
      setSavingInspection(false);
    }
  };

  // Money moves ONLY here: ledger settlement + wallet share + automatic
  // gateway refund. Completing a return just records the item is back.
  const initiateRefund = async (id) => {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/admin/item-actions/${id}/initiate-refund`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to initiate refund.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to initiate refund.");
    } finally {
      setSavingId(null);
    }
  };

  // Goods move ONLY here: books the replacement's forward shipment and pushes
  // it to ShipRocket. Completing an exchange (here or automatically via the
  // courier's RETURN DELIVERED webhook) just records the old item is back.
  const shipReplacement = async (id) => {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`${API_ENDPOINTS.orders}/admin/item-actions/${id}/ship-replacement`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to ship the replacement.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to ship the replacement.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#800020]/10 text-[#800020]">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="brand-font text-xl font-bold text-[#800020]">{title}</h2>
          </div>
          <p className="hidden">
            Requested {counts.Requested || 0} · Approved {counts.Approved || 0} · Completed {counts.Completed || 0}
          </p>
          <p className="mt-1 text-xs text-[#4A3F35]/60">
            Initiated {counts.Initiated || 0} · Completed {counts.Completed || 0}
          </p>
        </div>
        <button
          type="button"
          onClick={loadRows}
          className="rounded-lg border border-[#800020]/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#800020]"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase ${
              statusFilter === status
                ? "border-[#800020] bg-[#800020] text-white"
                : "border-[#800020]/15 bg-white text-[#800020]"
            }`}
          >
            {status === "all" ? "All" : status}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="glass-card overflow-hidden rounded-2xl shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-[#D4AF37]/10 bg-[#FAF8F6] text-[10px] font-bold uppercase text-gray-400">
            <tr>
              <th className="px-5 py-4">Order</th>
              <th className="px-5 py-4">Customer</th>
              <th className="px-5 py-4">Product</th>
              <th className="px-5 py-4">Qty</th>
              <th className="px-5 py-4">Estimate</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4AF37]/5 bg-white text-xs">
            {loading && (
              <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="7">Loading requests...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="7">No requests found.</td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#FAF8F6]/60">
                <td className="px-5 py-4 font-mono font-bold text-[#4A3F35]">
                  {row.Order?.order_number || `#${row.order_id}`}
                  <div className="mt-1 font-sans text-[10px] font-normal text-gray-400">{row.Order?.status}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#4A3F35]">{row.Order?.customer_name}</div>
                  <div className="text-[10px] text-gray-400">{row.Order?.customer_email}</div>
                </td>
                {/* One request = one row, however many products it covers. */}
                <td className="px-5 py-4">
                  <div className="space-y-2">
                    {(row.items || []).map((line) => (
                      <div key={line.action_id}>
                        <div className="font-semibold text-[#4A3F35]">
                          {line.OrderItem?.product_name || line.OrderItem?.Product?.name}
                          {line.quantity > 1 && <span className="text-gray-400"> × {line.quantity}</span>}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {line.OrderItem?.sku}
                          {(row.items || []).length > 1 && ` · ${formatMoney(line.estimated_refund_amount)}`}
                        </div>
                        {/* The pack list. One exchanged line can be swapped for SEVERAL sarees
                            (2 × A + 1 × B), all at the price paid — so this is a list, and its
                            quantities sum to the quantity coming back. The order line itself is
                            never rewritten, so this meta is the ONLY record of the swap. */}
                        {type === "exchange" && (exchangeTargetsOf(line).length > 0) && (
                          <div className="mt-1 rounded bg-[#800020]/5 px-2 py-1.5 text-[10px] leading-relaxed text-[#800020]">
                            <span className="font-bold uppercase tracking-wider">Send</span>
                            <ul className="mt-0.5 space-y-0.5">
                              {exchangeTargetsOf(line).map((t, i) => (
                                <li key={`${t.product_id}-${t.color_id ?? "x"}-${i}`} className="font-bold">
                                  {t.quantity} × {t.product_name || `Product #${t.product_id}`}
                                  {t.color_name ? ` · ${t.color_name}` : ""}
                                </li>
                              ))}
                            </ul>
                            <div className="mt-1 text-[#4A3F35]/60">
                              replaces {line.quantity} × {line.meta?.original_product_name || line.OrderItem?.product_name}
                              {line.OrderItem?.Color?.name ? ` · ${line.OrderItem.Color.name}` : ""}
                              {" "}(same price)
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {(row.items || []).length > 1 && (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#800020]/70">
                      {row.items.length} products · one request
                    </div>
                  )}
                </td>
                <td className="px-5 py-4 font-bold">{row.quantity}</td>
                <td className="px-5 py-4">
                  <div>{formatMoney(row.estimated_refund_amount)}</div>
                  {/* An inspection lowered it. The quote stays visible struck through: the
                      difference is what the customer will ask about, so the person paying
                      should not have to open another page to see it. */}
                  {type === "return" && row.refund_inspected_amount != null
                    && row.refund_inspected_amount < row.refund_quoted_amount && (
                    <div className="mt-1 text-[10px] font-bold text-amber-700">
                      <span className="line-through text-gray-400">{formatMoney(row.refund_quoted_amount)}</span>
                      {" "}quoted · reduced after inspection
                    </div>
                  )}
                  {type === "return" && (
                    <div className="mt-1 text-[10px] text-gray-400">
                      Pickup {formatMoney(row.reverse_shipping_deduction)} · Coupon adj {formatMoney(row.meta?.coupon_adjustment || 0)}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-[#800020]/10 px-2.5 py-1 text-[10px] font-bold text-[#800020]">{row.status}</span>
                  {type === "return" && row.Order?.payment_method === "COD" && (
                    row.refund_bank_details ? (
                      <div className="mt-2 rounded-lg bg-green-50 px-2.5 py-2 text-[10px] leading-relaxed text-green-900">
                        {row.refund_bank_details.method === "upi" ? (
                          <>
                            <div className="font-bold uppercase text-green-700">UPI ID submitted</div>
                            <div className="font-mono">{row.refund_bank_details.upi_id}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold uppercase text-green-700">Bank details submitted</div>
                            <div>{row.refund_bank_details.account_holder_name}</div>
                            <div className="font-mono">{row.refund_bank_details.account_number} · {row.refund_bank_details.ifsc_code}</div>
                            <div>{row.refund_bank_details.bank_name}{row.refund_bank_details.branch_name ? ` · ${row.refund_bank_details.branch_name}` : ""}</div>
                          </>
                        )}
                      </div>
                    ) : String(row.refund_status || "").toLowerCase().includes("bank") ? (
                      <div className="mt-2 text-[10px] font-bold uppercase text-amber-600">Awaiting refund account</div>
                    ) : null
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {!["Completed", "Rejected", "Cancelled"].includes(row.status) && (
                      <>
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => updateStatus(row.id, "Completed")}
                          className="rounded bg-green-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white"
                        >
                          <CheckCircle2 className="mr-1 inline h-3 w-3" /> Complete
                        </button>
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => updateStatus(row.id, "Rejected")}
                          className="rounded border border-red-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase text-red-600"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {/* Inspect, then pay — in that order, left to right, on the row itself.
                        The two used to live on separate screens with only a warning to keep
                        them in sequence; now the screen reads in the order the job is done. */}
                    {type === "return" && row.status === "Completed" && !row.refund_initiated && (
                      <div className="flex items-center gap-2">
                        {row.refund_id && (
                          <button
                            type="button"
                            onClick={() => openInspect(row)}
                            className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase ${
                              row.refund_inspected_at
                                ? "border border-[#800020]/20 bg-white text-[#800020]"
                                : "border border-amber-300 bg-amber-50 text-amber-700"
                            }`}
                          >
                            <Search className="mr-1 inline h-3 w-3" />
                            {row.refund_inspected_at ? "Inspected" : "Inspect parcel"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => initiateRefund(row.id)}
                          className="rounded bg-[#800020] px-3 py-1.5 text-[10px] font-bold uppercase text-white"
                        >
                          <IndianRupee className="mr-1 inline h-3 w-3" />
                          {savingId === row.id ? "Initiating..." : `Initiate Refund ${formatMoney(row.estimated_refund_amount)}`}
                        </button>
                      </div>
                    )}
                    {type === "return" && row.status === "Completed" && row.refund_initiated && (
                      <span className="rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase text-green-700">
                        <CheckCircle2 className="mr-1 inline h-3 w-3" /> Refund Initiated
                      </span>
                    )}
                    {type === "exchange" && row.status === "Completed" && !row.replacement_shipment_id && (
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => shipReplacement(row.id)}
                        className="rounded bg-[#800020] px-3 py-1.5 text-[10px] font-bold uppercase text-white"
                      >
                        <RefreshCw className="mr-1 inline h-3 w-3" />
                        {savingId === row.id ? "Shipping..." : "Ship Replacement"}
                      </button>
                    )}
                    {type === "exchange" && row.status === "Completed" && row.replacement_shipment_id && row.replacement_booked && (
                      <span className="rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase text-green-700">
                        <CheckCircle2 className="mr-1 inline h-3 w-3" />
                        {row.replacement_awb ? `Replacement Shipped (${row.replacement_awb})` : "Replacement Booked — AWB Pending"}
                      </span>
                    )}
                    {type === "exchange" && row.status === "Completed" && row.replacement_shipment_id && !row.replacement_booked && (
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => shipReplacement(row.id)}
                        className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase text-amber-700"
                        title="Courier booking failed earlier — the shipment record exists, retry to book it."
                      >
                        <RefreshCw className="mr-1 inline h-3 w-3" />
                        {savingId === row.id ? "Retrying..." : "Booking Failed — Retry"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scrolls itself and caps its height: the refund modal on the Orders page grew past the
          viewport once this same block landed on it, and a fixed backdrop cannot scroll, so
          everything below the fold became unreachable. */}
      {inspectRow && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[#31180d]/40 p-5 backdrop-blur-sm"
          onClick={() => !savingInspection && setInspectRow(null)}
        >
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); saveInspection(); }}
            className="grid max-h-[calc(100vh-40px)] w-[min(480px,100%)] gap-4 overflow-y-auto rounded-2xl border border-[#800020]/15 bg-[#FFFDF8] p-6 shadow-2xl"
          >
            <div>
              <h3 className="text-lg font-bold text-[#800020]">Inspect returned parcel</h3>
              <p className="mt-1 text-[11px] text-gray-500">
                {inspectRow.Order?.order_number || `#${inspectRow.order_id}`}
                {inspectRow.Order?.customer_name ? ` · ${inspectRow.Order.customer_name}` : ""}
              </p>
            </div>

            {inspectError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{inspectError}</p>
            )}

            <div className="flex items-center justify-between rounded-lg bg-[#FAF8F6] px-3 py-2 text-[11px]">
              <span className="font-bold uppercase tracking-wider text-gray-500">Quoted</span>
              <span className="font-bold text-[#4A3F35]">{formatMoney(inspectRow.refund_quoted_amount ?? inspectRow.estimated_refund_amount)}</span>
            </div>

            <label className="grid gap-1.5 text-[11px] font-bold text-[#4A3F35]">
              Amount to refund
              <input
                type="number"
                min="0"
                step="0.01"
                max={inspectRow.refund_quoted_amount || undefined}
                value={inspectForm.inspected_amount}
                onChange={(event) => setInspectForm((current) => ({ ...current, inspected_amount: event.target.value }))}
                className="w-full rounded-lg border border-[#800020]/15 bg-[#FFFAF1] px-3 py-2.5 font-normal text-[#4A3F35] outline-none"
              />
              <span className="font-normal text-gray-400">An inspection can only lower the refund, never raise it.</span>
            </label>

            <label className="grid gap-1.5 text-[11px] font-bold text-[#4A3F35]">
              Reason <em className="not-italic font-normal text-amber-700">— shown to the customer</em>
              <textarea
                rows={2}
                value={inspectForm.inspection_note}
                onChange={(event) => setInspectForm((current) => ({ ...current, inspection_note: event.target.value }))}
                placeholder="e.g. Saree returned with a tear near the pallu."
                className="w-full rounded-lg border border-[#800020]/15 bg-[#FFFAF1] px-3 py-2.5 font-normal text-[#4A3F35] outline-none"
              />
              <span className="font-normal text-gray-400">Required whenever the amount is below the quote.</span>
            </label>

            <div className="grid gap-1.5 text-[11px] font-bold text-[#4A3F35]">
              Photos of the damage <em className="not-italic font-normal text-amber-700">— shown to the customer</em>
              <div className="flex flex-wrap gap-2">
                {inspectionImages.map((image, index) => (
                  <span key={`${image.url}-${index}`} className="relative h-14 w-14 overflow-hidden rounded-lg border border-[#800020]/15">
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setInspectionImages((current) => current.filter((_, i) => i !== index))}
                      className="absolute right-0 top-0 h-4 w-4 rounded-bl bg-black/60 text-[10px] leading-none text-white"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {inspectionImages.length < 4 && (
                  <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-[#800020]/30 text-[10px] font-bold text-[#800020]">
                    {uploadingInspection ? "..." : "+ Add"}
                    <input type="file" accept="image/*" multiple hidden onChange={(event) => uploadInspectionImages(event.target.files)} />
                  </label>
                )}
              </div>
            </div>

            <div className="sticky bottom-[-24px] -mx-6 -mb-6 flex justify-end gap-2 border-t border-[#800020]/10 bg-[#FFFDF8] px-6 pb-6 pt-3.5">
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                disabled={savingInspection}
                className="rounded-full border border-[#800020]/20 bg-white px-4 py-2 text-[10px] font-bold uppercase text-[#800020]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingInspection}
                className="rounded-full bg-[#800020] px-4 py-2 text-[10px] font-bold uppercase text-white disabled:opacity-60"
              >
                {savingInspection ? "Saving…" : "Record inspection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
