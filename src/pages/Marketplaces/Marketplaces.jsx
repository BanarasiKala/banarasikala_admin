import { useEffect, useState } from "react";
import {
  ExternalLink, Layers, Pencil, Plus, Search, Store, Trash2, X, Link2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import API_ENDPOINTS from "../../config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

const EMPTY_FORM = {
  slug: "",
  name: "",
  tagline: "",
  icon: "",
  accent_color: "#800020",
  storefront_url: "",
  storefront_note: "",
  url_pattern: "",
  status: "live",
  display_order: 0,
};

const STATUSES = [
  { value: "live", label: "Live", hint: "Page lists the products linked to this channel." },
  { value: "coming_soon", label: "Coming soon", hint: "Page and footer badge exist, but announce that we are not there yet." },
  { value: "hidden", label: "Hidden", hint: "No page, no badge. Product links are kept." },
];

const statusPill = (status) => {
  if (status === "live") return "bg-green-50 text-green-700";
  if (status === "coming_soon") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-500";
};

// Placeholder for a product with no photo, so rows keep their alignment.
const NO_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

export default function Marketplaces() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [bulkFor, setBulkFor] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  // Picker state: what was typed, what came back, and the rows staged for saving.
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Staged rows: [{ id, name, sku, image, url, existing }]. `existing` marks a product
  // that already had a link here, so the row can say it is replacing rather than adding.
  // Named apart from `rows` above, which is the marketplace list.
  const [attachRows, setAttachRows] = useState([]);
  /**
   * The thumbnail being shown large: { product, pinned }.
   *
   * `pinned` is what makes this work on both inputs. Hover opens it unpinned and moving
   * away closes it, which is what a mouse expects; a tap opens it pinned so it survives
   * the synthetic mouseleave a touch device fires straight afterwards, and then only the
   * close button dismisses it. One state, both behaviours, no device sniffing.
   */
  const [preview, setPreview] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/admin/all`, { headers: authHeaders() });
      const data = await res.json();
      setRows(Array.isArray(data.marketplaces) ? data.marketplaces : []);
    } catch (e) {
      console.error("fetchMarketplaces", e);
      setError("Could not load marketplaces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch
    fetchRows();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...EMPTY_FORM, ...row, accent_color: row.accent_color || "#800020" });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const url = editing
        ? `${API_ENDPOINTS.marketplaces}/admin/${editing.id}`
        : `${API_ENDPOINTS.marketplaces}/admin`;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save.");
      setModalOpen(false);
      fetchRows();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Deleting takes every product link with it, so the count goes in the confirmation —
  // "delete Amazon" is a very different act with 0 links than with 300.
  const remove = async (row) => {
    const warning = row.link_count
      ? `Delete ${row.name}? Its ${row.link_count} product link${row.link_count === 1 ? "" : "s"} will be deleted too. To take the page down without losing them, set the status to Hidden instead.`
      : `Delete ${row.name}?`;
    if (!window.confirm(warning)) return;
    await fetch(`${API_ENDPOINTS.marketplaces}/admin/${row.id}`, { method: "DELETE", headers: authHeaders() });
    fetchRows();
  };

  const openAttach = (row) => {
    setBulkFor(row);
    setSearch("");
    setResults([]);
    setAttachRows([]);
    setBulkResult(null);
    setPreview(null);
  };

  // Debounced so typing a product name is one request when you stop, not one per letter.
  useEffect(() => {
    if (!bulkFor) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // No limit sent: the picker shows the whole catalogue on open, so a product can
        // be scrolled to rather than only found by typing its name.
        const params = new URLSearchParams({ search });
        const res = await fetch(`${API_ENDPOINTS.marketplaces}/admin/${bulkFor.id}/products?${params}`, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (e.name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [bulkFor, search]);

  // Picking a product stages a row, pre-filled with whatever is already linked here — so
  // the field shows what it is about to replace rather than looking empty.
  const addRow = (product) => {
    setAttachRows((current) => {
      if (current.some((r) => r.id === product.id)) return current;
      return [...current, { ...product, existing: Boolean(product.url) }];
    });
    setBulkResult(null);
  };

  const setRowUrl = (id, url) =>
    setAttachRows((current) => current.map((r) => (r.id === id ? { ...r, url } : r)));

  const removeRow = (id) => setAttachRows((current) => current.filter((r) => r.id !== id));

  const readyRows = attachRows.filter((r) => String(r.url || "").trim());

  const runBulk = async () => {
    if (readyRows.length === 0) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API_ENDPOINTS.marketplaces}/admin/${bulkFor.id}/bulk`, {
        method: "POST",
        headers: authHeaders(),
        // The server accepts a product id as the key, so the picker sends ids and no SKU
        // lookup can go wrong.
        body: JSON.stringify({ rows: readyRows.map((r) => ({ key: String(r.id), url: r.url })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not attach those links.");
      setBulkResult(data);
      // Rows that saved are cleared; anything rejected stays on screen with its URL, so
      // it can be corrected without being picked out of the catalogue again.
      const failedKeys = new Set((data.failed || []).map((f) => String(f.key)));
      setAttachRows((current) => current.filter((r) => failedKeys.has(String(r.id)) || !String(r.url || "").trim()));
      fetchRows();
    } catch (e) {
      setBulkResult({ attached: 0, updated: 0, failed: [{ key: "—", reason: e.message }] });
    } finally {
      setBulkBusy(false);
    }
  };

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="brand-font text-2xl font-bold text-[#800020]">Marketplaces</h2>
          <p className="text-gray-500 text-sm mt-1">
            Where else we sell. Each one gets a page at <code className="text-[#800020]">/store/&lt;slug&gt;</code>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-xs font-bold rounded-xl hover:bg-[#6a001a] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Marketplace
        </button>
      </div>

      {loading ? (
        <div className="p-20 text-center">
          <div className="w-10 h-10 border-4 border-[#D4AF37]/20 border-t-[#800020] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium">Loading…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card rounded-2xl border border-[#D4AF37]/10 p-20 text-center">
          <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No marketplaces yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rows.map((row) => (
            <div key={row.id} className="glass-card rounded-2xl border border-[#D4AF37]/10 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-none"
                      style={{ background: row.accent_color || "#800020" }}
                    />
                    <p className="font-bold text-[#4A3F35] truncate">{row.name}</p>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">/store/{row.slug}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusPill(row.status)}`}>
                  {STATUSES.find((s) => s.value === row.status)?.label || row.status}
                </span>
              </div>

              <p className="text-[11px] text-gray-500 line-clamp-2 min-h-[30px]">{row.tagline || "—"}</p>

              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> {row.link_count} product{row.link_count === 1 ? "" : "s"}</span>
                {row.storefront_url && (
                  <span className="flex items-center gap-1 text-green-600">
                    <ExternalLink className="w-3.5 h-3.5" /> storefront
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-auto pt-2">
                <button
                  onClick={() => openAttach(row)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[#800020] bg-[#800020]/5 rounded-lg hover:bg-[#800020]/10"
                >
                  <Layers className="w-3.5 h-3.5" /> Attach products
                </button>
                <button onClick={() => openEdit(row)} className="p-2 text-gray-400 hover:text-[#800020] hover:bg-[#800020]/5 rounded-lg" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(row)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Channel editor ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-[#800020] text-lg">{editing ? `Edit ${editing.name}` : "New Marketplace"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <p className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-none mt-px" /> {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Name</span>
                  <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Myntra" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Slug</span>
                  <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.slug} onChange={(e) => field("slug", e.target.value)} placeholder="myntra" />
                  <span className="text-[10px] text-gray-400">The page URL: /store/{form.slug || "…"}. Left blank, it comes from the name.</span>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Tagline</span>
                <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.tagline || ""} onChange={(e) => field("tagline", e.target.value)} placeholder="Genuine Banarasi handloom, delivered by Amazon." />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Logo</span>
                  <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.icon || ""} onChange={(e) => field("icon", e.target.value)} placeholder="simple-icons:amazon" />
                  <span className="text-[10px] text-gray-400">
                    An Iconify id (<code>simple-icons:amazon</code>) or an image path (<code>/image.png</code>).
                  </span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Brand colour</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" className="h-9 w-12 rounded border border-gray-200" value={form.accent_color || "#800020"} onChange={(e) => field("accent_color", e.target.value)} />
                    <input className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.accent_color || ""} onChange={(e) => field("accent_color", e.target.value)} />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Our storefront URL</span>
                <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.storefront_url || ""} onChange={(e) => field("storefront_url", e.target.value)} placeholder="https://www.amazon.in/stores/…" />
                <span className="text-[10px] text-gray-400">
                  Our own shop page on that marketplace. Leave blank where we do not have one — the
                  “See all our products” button then does not appear at all, rather than linking to
                  their homepage.
                </span>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Storefront blurb</span>
                <textarea rows={3} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.storefront_note || ""} onChange={(e) => field("storefront_note", e.target.value)} placeholder="Every Banarasi Kala saree we list on Amazon, in one place — with Prime delivery." />
                <span className="text-[10px] text-gray-400">Shown above that button.</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">URL must contain</span>
                  <input className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.url_pattern || ""} onChange={(e) => field("url_pattern", e.target.value)} placeholder="amazon." />
                  <span className="text-[10px] text-gray-400">Stops a Flipkart link being pasted into this channel. Blank turns the check off.</span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">Order</span>
                  <input type="number" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={form.display_order} onChange={(e) => field("display_order", e.target.value)} />
                  <span className="text-[10px] text-gray-400">Lower shows first in the footer.</span>
                </label>
              </div>

              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase">Status</span>
                <div className="mt-2 space-y-2">
                  {STATUSES.map((s) => (
                    <label key={s.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${form.status === s.value ? "bg-[#800020]/5 border-[#800020]/40" : "bg-white border-gray-100"}`}>
                      <input type="radio" className="mt-0.5" checked={form.status === s.value} onChange={() => field("status", s.value)} />
                      <span>
                        <span className="block text-xs font-bold text-[#4A3F35]">{s.label}</span>
                        <span className="block text-[10px] text-gray-500">{s.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl hover:bg-[#6a001a] disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attach products ── */}
      {bulkFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!bulkBusy) { setBulkFor(null); setPreview(null); } }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-[#800020] text-lg">Attach products — {bulkFor.name}</h3>
              <button onClick={() => setBulkFor(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Search a product by name or SKU, pick it, then paste its {bulkFor.name} link.
                Add as many as you like and save them together. A product already linked here
                shows its current URL — editing it replaces the link.
              </p>

              {/* Search + results. Kept as a list rather than a native <select> so each row
                  can carry a thumbnail, the SKU and whether it is already linked — none of
                  which fits in an option element. */}
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products by name or SKU…"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#800020]"
                  />
                </div>

                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-100 divide-y">
                  {searching && <p className="p-3 text-[11px] text-gray-400">Searching…</p>}
                  {!searching && results.length === 0 && (
                    <p className="p-3 text-[11px] text-gray-400">
                      {search ? "No products match that." : "Start typing to find a product."}
                    </p>
                  )}
                  {!searching && results.map((product) => {
                    const staged = attachRows.some((r) => r.id === product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addRow(product)}
                        disabled={staged}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${staged ? "opacity-50 cursor-default" : "hover:bg-gray-50"}`}
                      >
                        {/* The thumbnail is its own control: it enlarges the photo instead
                            of staging the row, so stopPropagation keeps a tap meant for
                            "let me see this" from also adding the product. */}
                        <img
                          src={product.image || NO_IMAGE}
                          alt=""
                          className="w-9 h-9 rounded object-cover border bg-gray-50 flex-none cursor-zoom-in"
                          onMouseEnter={() => setPreview((p) => (p?.pinned ? p : { product, pinned: false }))}
                          onMouseLeave={() => setPreview((p) => (p?.pinned ? p : null))}
                          onClick={(e) => { e.stopPropagation(); setPreview({ product, pinned: true }); }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-[#4A3F35] truncate">{product.name}</span>
                          <span className="block text-[10px] text-gray-400">{product.sku || `#${product.id}`}</span>
                        </span>
                        {/* Says so before anything is typed, so the same link is not pasted twice. */}
                        {product.url && !staged && (
                          <span className="text-[10px] font-bold text-green-600 uppercase">linked</span>
                        )}
                        {staged ? (
                          <span className="text-[10px] font-bold text-gray-400 uppercase">added</span>
                        ) : (
                          <Plus className="w-4 h-4 text-[#800020] flex-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staged rows */}
              {attachRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase">
                    To attach ({readyRows.length} of {attachRows.length} ready)
                  </p>
                  {attachRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <img
                        src={row.image || NO_IMAGE}
                        alt=""
                        className="w-9 h-9 rounded object-cover border bg-gray-50 flex-none cursor-zoom-in"
                        onMouseEnter={() => setPreview((p) => (p?.pinned ? p : { product: row, pinned: false }))}
                        onMouseLeave={() => setPreview((p) => (p?.pinned ? p : null))}
                        onClick={() => setPreview({ product: row, pinned: true })}
                      />
                      <span className="w-40 flex-none min-w-0">
                        <span className="block text-xs font-semibold text-[#4A3F35] truncate">{row.name}</span>
                        <span className="block text-[10px] text-gray-400">
                          {row.existing ? "replacing existing link" : row.sku || `#${row.id}`}
                        </span>
                      </span>
                      <input
                        type="url"
                        value={row.url}
                        onChange={(e) => setRowUrl(row.id, e.target.value)}
                        placeholder={`https://www.${bulkFor.slug}.in/…`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#800020]"
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-none"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bulkResult && (
                <div className="rounded-xl border border-gray-100 divide-y">
                  <div className="flex items-center gap-4 p-3 text-xs">
                    <span className="flex items-center gap-1.5 text-green-700 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> {bulkResult.attached} added
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-700 font-bold">
                      <Link2 className="w-4 h-4" /> {bulkResult.updated} updated
                    </span>
                    {bulkResult.failed?.length > 0 && (
                      <span className="flex items-center gap-1.5 text-red-600 font-bold">
                        <AlertTriangle className="w-4 h-4" /> {bulkResult.failed.length} skipped
                      </span>
                    )}
                  </div>
                  {/* Every bad row is named. A batch that silently dropped rows would leave
                      the admin believing the whole paste landed. */}
                  {bulkResult.failed?.length > 0 && (
                    <div className="max-h-48 overflow-y-auto p-3 space-y-1">
                      {bulkResult.failed.map((f, i) => (
                        <p key={i} className="text-[11px] text-gray-600">
                          <span className="font-bold text-red-600">{f.key}</span> — {f.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => { setBulkFor(null); setPreview(null); }} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Close</button>
              <button
                onClick={runBulk}
                disabled={bulkBusy || readyRows.length === 0}
                className="px-5 py-2 bg-[#800020] text-white text-xs font-bold rounded-xl hover:bg-[#6a001a] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkBusy
                  ? "Attaching…"
                  : readyRows.length === 0
                    ? "Attach links"
                    : `Attach ${readyRows.length} link${readyRows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged thumbnail. z-index sits above the attach modal (z-50) so it is not
          trapped behind the sheet it was opened from. Only a pinned preview gets the
          backdrop and close button — an unpinned one is following the mouse and would be
          dismissed by moving away before either could be used. */}
      {preview?.product && (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${preview.pinned ? "bg-black/80" : "pointer-events-none"}`}
          onClick={() => setPreview(null)}
        >
          <div
            className={`relative rounded-xl bg-white p-3 shadow-2xl ${preview.pinned ? "w-full max-w-2xl" : "w-auto"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {preview.pinned && (
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="absolute right-2 top-2 z-10 rounded-md bg-black/70 p-1.5 text-white hover:bg-black"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <img
              src={preview.product.image || NO_IMAGE}
              alt={preview.product.name || "Preview"}
              className={`rounded-lg bg-white object-contain ${preview.pinned ? "h-[70vh] w-full" : "h-64 w-64"}`}
            />
            <p className="mt-2 truncate px-1 text-xs font-semibold text-[#4A3F35]">
              {preview.product.name}
            </p>
            <p className="px-1 text-[10px] text-gray-400">
              {preview.product.sku || `#${preview.product.id}`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
