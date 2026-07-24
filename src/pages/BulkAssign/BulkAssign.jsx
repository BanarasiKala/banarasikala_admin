import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers, Search, Loader2, Check, AlertTriangle, PackageSearch, X, Eraser,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

/**
 * Bulk assign variety and material to many products at once.
 *
 * Editing 47 products one form at a time is the problem this replaces. Products arrive in
 * families — the same design in six colours — so the workflow is: search the family name,
 * select all matches, apply. What took forty page loads takes one.
 *
 * ── Variety and material are set independently ──────────────────────────────────────────
 * Each dropdown has its own Apply. Sending both at once would force a decision about the
 * material every time you only meant to fix the variety, and "leave it as it is" has to be
 * expressible or the tool cannot be used twice on the same product without undoing itself.
 */

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token") || localStorage.getItem("accessToken") || localStorage.getItem("token")}`,
});

const jsonHeaders = () => ({ ...authHeaders(), "Content-Type": "application/json" });

// Sentinel for the "clear this field" option. A real id is a number and "" means "no change",
// so the third state needs a value that can never collide with either.
const CLEAR = "__clear__";

export default function BulkAssign() {
  const [products, setProducts] = useState([]);
  const [totals, setTotals] = useState({ totalProducts: 0, missingVariety: 0, missingMaterial: 0 });
  const [varieties, setVarieties] = useState([]);
  const [materials, setMaterials] = useState([]);

  const [search, setSearch] = useState("");
  const [filterVariety, setFilterVariety] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("");
  const [onlyMissingVariety, setOnlyMissingVariety] = useState(false);
  const [onlyMissingMaterial, setOnlyMissingMaterial] = useState(false);

  const [selected, setSelected] = useState(() => new Set());
  const [pickVariety, setPickVariety] = useState("");
  const [pickMaterial, setPickMaterial] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const varietyById = useMemo(() => new Map(varieties.map((v) => [v.id, v.name])), [varieties]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m.name])), [materials]);

  // Taxonomy is loaded once; it changes on its own screens, not this one.
  useEffect(() => {
    (async () => {
      try {
        const [v, m] = await Promise.all([
          fetch(API_ENDPOINTS.varieties, { cache: "no-store" }).then((r) => r.json()),
          fetch(API_ENDPOINTS.materials, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setVarieties(Array.isArray(v) ? v : []);
        setMaterials(Array.isArray(m) ? m : []);
      } catch {
        setError("Could not load varieties and materials.");
      }
    })();
  }, []);

  const fetchBoard = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (onlyMissingVariety) params.set("unassignedVariety", "true");
    else if (filterVariety) params.set("varietyId", filterVariety);
    if (onlyMissingMaterial) params.set("unassignedMaterial", "true");
    else if (filterMaterial) params.set("materialId", filterMaterial);

    try {
      const response = await fetch(`${API_ENDPOINTS.products}/attribute-board?${params}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to load products.");
      setProducts(data.products || []);
      setTotals(data.totals || { totalProducts: 0, missingVariety: 0, missingMaterial: 0 });
      setError("");
    } catch (err) {
      setProducts([]);
      setError(err.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [search, filterVariety, filterMaterial, onlyMissingVariety, onlyMissingMaterial]);

  // Debounced so typing a family name doesn't fire a request per keystroke.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; fetchBoard(); return undefined; }
    const timer = setTimeout(fetchBoard, 300);
    return () => clearTimeout(timer);
  }, [fetchBoard]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const visibleIds = useMemo(() => products.map((p) => p.id), [products]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleOne = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Selects every product the filter matched, not just what fits on screen — the board
  // returns the whole matching set for exactly this reason.
  const toggleAllVisible = () => setSelected((current) => {
    const next = new Set(current);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    return next;
  });

  const apply = async (field, rawValue) => {
    const ids = [...selected];
    if (!ids.length || saving) return;

    // Only the field being applied is sent. An omitted key means "leave alone" server-side,
    // which is what keeps the two dropdowns independent.
    const body = { productIds: ids };
    body[field] = rawValue === CLEAR ? null : Number(rawValue);

    setSaving(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.products}/bulk-attributes`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Update failed.");

      const label = field === "varietyId" ? "Variety" : "Material";
      const name = rawValue === CLEAR
        ? "cleared"
        : `set to ${(field === "varietyId" ? varietyById : materialById).get(Number(rawValue)) || rawValue}`;
      setToast(`${label} ${name} on ${data.updated} product${data.updated === 1 ? "" : "s"}.`);
      setError("");
      // Selection is kept: assigning a variety then a material to the same family is the
      // normal case, and clearing it would mean re-selecting six products to do the second half.
      await fetchBoard();
    } catch (err) {
      setError(err.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setFilterVariety(""); setFilterMaterial("");
    setOnlyMissingVariety(false); setOnlyMissingMaterial(false);
  };

  const pill = (done, total, label) => {
    const left = total - done;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
        left === 0
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}>
        {left === 0 ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {label}: {done}/{total}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#087a55] text-white shadow-lg text-sm font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brand-font text-2xl font-bold text-[#800020] flex items-center gap-2">
            <Layers className="w-6 h-6" />
            Bulk Assign
          </h1>
          <p className="text-xs text-[#4A3F35]/60 font-semibold mt-0.5">
            Set variety and material on many products at once.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pill(totals.totalProducts - totals.missingVariety, totals.totalProducts, "Variety")}
          {pill(totals.totalProducts - totals.missingMaterial, totals.totalProducts, "Material")}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────────────── */}
      <div className="p-4 bg-white rounded-xl border border-[#D4AF37]/20 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#4A3F35]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or SKU — try a family, e.g. “cutwork”"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D4AF37]/30 text-sm text-[#4A3F35] outline-none focus:border-[#800020]"
            />
          </div>

          <select
            value={onlyMissingVariety ? "" : filterVariety}
            disabled={onlyMissingVariety}
            onChange={(e) => setFilterVariety(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#D4AF37]/30 bg-white text-xs font-bold text-[#4A3F35] outline-none focus:border-[#800020] disabled:opacity-50"
          >
            <option value="">Any variety</option>
            {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>

          <select
            value={onlyMissingMaterial ? "" : filterMaterial}
            disabled={onlyMissingMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#D4AF37]/30 bg-white text-xs font-bold text-[#4A3F35] outline-none focus:border-[#800020] disabled:opacity-50"
          >
            <option value="">Any material</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="h-10 px-3 rounded-lg border border-[#D4AF37]/25 text-xs font-bold text-[#4A3F35]/70 hover:border-[#800020]/40"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-bold text-[#4A3F35]/70">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyMissingVariety}
              onChange={(e) => setOnlyMissingVariety(e.target.checked)} className="accent-[#800020]" />
            Only missing variety
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyMissingMaterial}
              onChange={(e) => setOnlyMissingMaterial(e.target.checked)} className="accent-[#800020]" />
            Only missing material
          </label>
        </div>
      </div>

      {/* ── Apply bar. Sticky, because the selection is made at the bottom of a long list
             and the controls that act on it must not be scrolled away from. ─────────── */}
      <div className={`sticky top-2 z-30 p-3 rounded-xl border transition-colors ${
        selected.size > 0
          ? "bg-[#800020]/5 border-[#800020]/30"
          : "bg-white border-[#D4AF37]/20"
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#4A3F35] mr-1">
            {selected.size > 0 ? `${selected.size} selected` : "Nothing selected"}
          </span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4A3F35]/60 hover:text-[#800020]">
              <X className="w-3 h-3" /> clear
            </button>
          )}

          <span className="flex-1" />

          <select value={pickVariety} onChange={(e) => setPickVariety(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-[#D4AF37]/30 bg-white text-xs font-bold text-[#4A3F35] outline-none focus:border-[#800020]">
            <option value="">Set variety…</option>
            {varieties.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            <option value={CLEAR}>— Clear variety —</option>
          </select>
          <button
            type="button"
            disabled={!selected.size || !pickVariety || saving}
            onClick={() => apply("varietyId", pickVariety)}
            className="h-9 px-3 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
          </button>

          <select value={pickMaterial} onChange={(e) => setPickMaterial(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-[#D4AF37]/30 bg-white text-xs font-bold text-[#4A3F35] outline-none focus:border-[#800020]">
            <option value="">Set material…</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={CLEAR}>— Clear material —</option>
          </select>
          <button
            type="button"
            disabled={!selected.size || !pickMaterial || saving}
            onClick={() => apply("materialId", pickMaterial)}
            className="h-9 px-3 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
          </button>
        </div>
      </div>

      {/* ── Products ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#D4AF37]/20 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#D4AF37]/15 bg-[#FAF8F6] flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[#4A3F35]">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}
              disabled={!visibleIds.length} className="accent-[#800020]" />
            Select all {visibleIds.length} matching
          </label>
          <span className="flex-1" />
          <span className="text-[11px] font-bold text-[#4A3F35]/45">
            {loading ? "loading…" : `${products.length} shown`}
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center gap-2 text-[#4A3F35]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
            <span className="text-xs font-semibold">Loading products…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-2 text-center">
            <PackageSearch className="w-8 h-8 text-[#800020]/35" />
            <span className="text-sm font-bold text-[#4A3F35]">No products match</span>
            <span className="text-xs text-[#4A3F35]/60 font-semibold">Try a broader search or reset the filters.</span>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/10 max-h-[58vh] overflow-y-auto custom-scrollbar">
            {products.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-[#800020]/5" : "hover:bg-[#FAF8F6]"
                  }`}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(p.id)}
                    className="accent-[#800020] shrink-0" />

                  {p.image ? (
                    <img src={p.image} alt="" loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover border border-[#D4AF37]/25 shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-lg grid place-items-center bg-[#F5F1ED] text-[#800020]/40 shrink-0">
                      <PackageSearch className="w-4 h-4" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-[#4A3F35] truncate">{p.name}</span>
                    <span className="block text-[11px] font-semibold text-[#4A3F35]/45">{p.sku || `#${p.id}`}</span>
                  </span>

                  {/* Current values, so you can see what you are about to change. A missing
                      one is called out rather than left blank — blank reads as "loading". */}
                  <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <Tag label={varietyById.get(p.variety_id)} />
                    <Tag label={materialById.get(p.material_id)} />
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] font-semibold text-[#4A3F35]/45 flex items-center gap-1.5">
        <Eraser className="w-3 h-3" />
        Storefront category pages cache for up to 2 minutes, so a change can take that long to
        show on the site.
      </p>
    </div>
  );
}

/** Current variety/material on a row. "Not set" is stated, never left blank. */
const Tag = ({ label }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${
    label
      ? "bg-white text-[#4A3F35]/75 border-[#D4AF37]/30"
      : "bg-amber-50 text-amber-700 border-amber-200"
  }`}>
    {label || "Not set"}
  </span>
);
