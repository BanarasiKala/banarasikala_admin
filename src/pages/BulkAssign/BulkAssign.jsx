import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers, Search, Loader2, Check, AlertTriangle, PackageSearch, X, Eraser,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

/**
 * Bulk assign varieties and materials to many products at once.
 *
 * Editing 47 products one form at a time is the problem this replaces. Products arrive in
 * families — the same design in six colours — so the workflow is: search the family name,
 * select all matches, apply. What took forty page loads takes one.
 *
 * ── Variety and material are set independently, and each is a SET ────────────────────────
 * A product now holds many varieties and many materials, so applying one has to say what
 * happens to what is already there:
 *   Add      the chosen ones join whatever each product already has (the default)
 *   Remove   the chosen ones are taken off, the rest left alone
 *   Replace  the chosen set becomes exactly what each product has (empty = clear the lot)
 *
 * Variety and material each have their own Apply so fixing one never forces a decision about
 * the other — the server leaves an attribute untouched unless its key is present in the body.
 */

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token")}`,
});

const jsonHeaders = () => ({ ...authHeaders(), "Content-Type": "application/json" });

const MODES = [
  { key: "add", label: "Add" },
  { key: "remove", label: "Remove" },
  { key: "replace", label: "Replace" },
];

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
  const [mode, setMode] = useState("add");
  const [pickVarieties, setPickVarieties] = useState(() => new Set());
  const [pickMaterials, setPickMaterials] = useState(() => new Set());

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

  const togglePick = (setter) => (id) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleVarietyPick = togglePick(setPickVarieties);
  const toggleMaterialPick = togglePick(setPickMaterials);

  /**
   * Apply one attribute (variety or material) to the selected products under the current mode.
   * Only that attribute's key is sent, so the other is left untouched server-side. In
   * add/remove the picked set must be non-empty; replace-with-nothing is a valid "clear all".
   */
  const apply = async (attr) => {
    const ids = [...selected];
    if (!ids.length || saving) return;

    const pickedSet = attr === "variety" ? pickVarieties : pickMaterials;
    const picked = [...pickedSet].map(Number);
    if (mode !== "replace" && picked.length === 0) return;

    const body = { productIds: ids, mode };
    body[attr === "variety" ? "varietyIds" : "materialIds"] = picked;

    setSaving(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.products}/bulk-attributes`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Update failed.");

      const label = attr === "variety" ? "Variety" : "Material";
      const nameMap = attr === "variety" ? varietyById : materialById;
      const names = picked.map((id) => nameMap.get(id) || id).join(", ");
      let detail;
      if (mode === "replace" && picked.length === 0) detail = "cleared";
      else if (mode === "add") detail = `added ${names}`;
      else if (mode === "remove") detail = `removed ${names}`;
      else detail = `set to ${names}`;

      setToast(`${label} ${detail} on ${data.updated} product${data.updated === 1 ? "" : "s"}.`);
      setError("");
      // Selection and picks are kept: assigning varieties then materials to the same family is
      // the normal case, and clearing them would mean re-selecting six products for the second half.
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

  // add/remove need something to act with; replace can run empty (clears the attribute).
  const canApplyVariety = selected.size > 0 && !saving && (mode === "replace" || pickVarieties.size > 0);
  const canApplyMaterial = selected.size > 0 && !saving && (mode === "replace" || pickMaterials.size > 0);
  const applyWord = (pickCount) => (mode === "replace" && pickCount === 0 ? "Clear" : "Apply");

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
            Add, remove, or replace varieties and materials on many products at once.
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
      <div className={`sticky top-2 z-30 p-3 rounded-xl border transition-colors space-y-2.5 ${
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

          {/* Mode governs both Apply buttons — add joins, remove strips, replace overwrites. */}
          <span className="text-[11px] font-bold text-[#4A3F35]/55 uppercase tracking-wide">Mode</span>
          <div className="inline-flex rounded-lg border border-[#D4AF37]/30 overflow-hidden">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`px-3 h-8 text-[11px] font-bold transition-colors ${
                  mode === m.key
                    ? "bg-[#800020] text-white"
                    : "bg-white text-[#4A3F35]/70 hover:bg-[#FAF8F6]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variety row */}
        <div className="flex items-start gap-2">
          <span className="w-16 shrink-0 pt-1.5 text-[11px] font-bold text-[#4A3F35]/60">Variety</span>
          <div className="flex-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
            {varieties.length === 0 && <span className="text-[11px] font-semibold text-[#4A3F35]/40 pt-1">None yet.</span>}
            {varieties.map((v) => {
              const on = pickVarieties.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVarietyPick(v.id)}
                  className={`px-2.5 h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                    on
                      ? "bg-[#800020] text-white border-[#800020]"
                      : "bg-white text-[#4A3F35]/75 border-[#D4AF37]/30 hover:border-[#800020]/40"
                  }`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canApplyVariety}
            onClick={() => apply("variety")}
            className="h-8 px-3 shrink-0 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : applyWord(pickVarieties.size)}
          </button>
        </div>

        {/* Material row */}
        <div className="flex items-start gap-2">
          <span className="w-16 shrink-0 pt-1.5 text-[11px] font-bold text-[#4A3F35]/60">Material</span>
          <div className="flex-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
            {materials.length === 0 && <span className="text-[11px] font-semibold text-[#4A3F35]/40 pt-1">None yet.</span>}
            {materials.map((m) => {
              const on = pickMaterials.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMaterialPick(m.id)}
                  className={`px-2.5 h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                    on
                      ? "bg-[#800020] text-white border-[#800020]"
                      : "bg-white text-[#4A3F35]/75 border-[#D4AF37]/30 hover:border-[#800020]/40"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canApplyMaterial}
            onClick={() => apply("material")}
            className="h-8 px-3 shrink-0 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : applyWord(pickMaterials.size)}
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

                  {/* Current values, so you can see what you are about to change. A missing group
                      is called out rather than left blank — blank reads as "loading". */}
                  <span className="hidden sm:flex flex-col items-end gap-1 shrink-0 max-w-[48%]">
                    <TagGroup items={p.varieties} empty="No variety" />
                    <TagGroup items={p.materials} empty="No material" />
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

/** The varieties (or materials) currently on a row. "None" is stated, never left blank. */
const TagGroup = ({ items, empty }) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200">
        {empty}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {list.map((it) => (
        <span key={it.id}
          className="px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap bg-white text-[#4A3F35]/75 border-[#D4AF37]/30">
          {it.name}
        </span>
      ))}
    </span>
  );
};
