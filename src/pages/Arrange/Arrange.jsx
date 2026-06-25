import { useState, useEffect, useRef } from "react";
import { GripVertical, Save, RotateCcw, Sparkles, Star, LayoutGrid, CheckCircle, AlertCircle, Package } from "lucide-react";
import { imgUrl } from "../../utils/cloudinary";
import { API_ENDPOINTS } from "../../config/api";

// Each surface maps to the order column the backend writes and the query
// params that return its candidate products already in saved order.
const SECTIONS = [
  {
    key: "exclusive",
    label: "Exclusive Picks",
    hint: "Home page — Exclusive Picks rail.",
    icon: Star,
    params: { view: "home", specialCollection: "true", status: "active", limit: "200" },
  },
  {
    key: "new_arrival",
    label: "New Arrivals",
    hint: "Home page — New Arrivals rail.",
    icon: Sparkles,
    params: { view: "home", newArrival: "true", status: "active", limit: "200" },
  },
  {
    key: "collection",
    label: "Collection",
    hint: "Collection page — default sort order.",
    icon: LayoutGrid,
    params: { view: "collection", status: "active", sortBy: "newest", limit: "200" },
  },
];

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function Arrange() {
  const [activeKey, setActiveKey] = useState(SECTIONS[0].key);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const dragIndexRef = useRef(null);
  const activeSection = SECTIONS.find((s) => s.key === activeKey) || SECTIONS[0];

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadSection = async (section) => {
    setLoading(true);
    setDirty(false);
    try {
      const params = new URLSearchParams(section.params);
      const res = await fetch(`${API_ENDPOINTS.products}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load products");
      const items = Array.isArray(data) ? data : data.items || [];
      setProducts(items);
    } catch (error) {
      console.error("Arrange load failed:", error);
      setProducts([]);
      showToast("error", "Could not load products for this section.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const section = SECTIONS.find((s) => s.key === activeKey) || SECTIONS[0];
    (async () => { await loadSection(section); })();
  }, [activeKey]);

  const handleDragStart = (index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (event, index) => {
    event.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) {
      setOverIndex(index);
      return;
    }
    setOverIndex(index);
    setProducts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = index;
    setDragIndex(index);
    setDirty(true);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_ENDPOINTS.products}/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          section: activeSection.key,
          orderedIds: products.map((p) => p.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save order");
      setDirty(false);
      showToast("success", "Order saved. The storefront now reflects this arrangement.");
    } catch (error) {
      console.error("Arrange save failed:", error);
      showToast("error", error.message || "Could not save order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#800020]">Arrange Storefront</h1>
          <p className="text-sm text-gray-500 mt-1">Drag products to set the order shoppers see on each section.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSection(activeSection)}
            disabled={loading || saving}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || loading}
            className="px-6 py-2 bg-[#800020] text-white text-sm font-bold rounded-lg flex items-center gap-2 hover:bg-[#6b001a] transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.key === activeKey;
          return (
            <button
              key={section.key}
              onClick={() => setActiveKey(section.key)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 border transition-colors ${
                isActive
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" /> {section.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#D4AF37]/20 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{activeSection.hint}</p>
          {dirty && <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Unsaved changes</span>}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-[#D4AF37]/20 border-t-[#800020] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No products available for this section yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {products.map((product, index) => {
              const cover = product.images?.find((img) => img.is_cover)?.url || product.images?.[0]?.url;
              const isDragging = dragIndex === index;
              const isOver = overIndex === index && dragIndex !== index;
              return (
                <li
                  key={product.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(event) => event.preventDefault()}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white cursor-grab active:cursor-grabbing transition-all ${
                    isDragging ? "opacity-50 border-[#800020]" : isOver ? "border-[#D4AF37] bg-amber-50/40" : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <GripVertical className="w-5 h-5 text-gray-300 shrink-0" />
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-[#800020]/10 text-[#800020] text-xs font-bold">
                    {index + 1}
                  </span>
                  <img
                    src={imgUrl(cover)}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded-lg shrink-0 bg-gray-100"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#4A3F35] text-sm truncate">{product.name}</p>
                    <p className="text-[11px] text-gray-400">{formatMoney(product.selling_price)}</p>
                  </div>
                  {product.is_new_arrival && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded shrink-0">NEW</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[140]">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
