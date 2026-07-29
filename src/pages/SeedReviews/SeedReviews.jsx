import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star, Loader2, Check, X, Trash2, Pencil, Plus, PackageSearch,
  Image as ImageIcon, Eye, EyeOff, Info, BadgeCheck,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

/**
 * Seed reviews: admin-authored reviews that stand in for a product ONLY while it has no real,
 * approved customer reviews. Pick a product, add as many reviews as you like (each with its own
 * reviewer name, rating and words), and they appear on the storefront until a genuine review
 * arrives — at which point they step aside automatically.
 */

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
});
const jsonHeaders = () => ({ ...authHeaders(), "Content-Type": "application/json" });

const EMPTY_FORM = {
  id: null,
  reviewer_name: "",
  rating: 5,
  comment: "",
  images: [],
  review_date: "",
  is_active: true,
  is_verified: false,
};

// Clickable 1–5 stars, used both in the form and (read-only) on each saved review.
const StarRating = ({ value, onChange, size = 20 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(star)}
        className={onChange ? "cursor-pointer" : "cursor-default"}
        aria-label={`${star} star${star === 1 ? "" : "s"}`}
      >
        <Star
          className={star <= value ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#D4AF37]/30"}
          style={{ width: size, height: size }}
        />
      </button>
    ))}
  </div>
);

export default function SeedReviews() {
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { id, name, image }
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Every product, loaded once for the picker dropdown. The Bulk Assign attribute board already
  // returns id + name + sku + cover image for the whole catalogue, so it doubles as the source.
  useEffect(() => {
    (async () => {
      setProductsLoading(true);
      try {
        const res = await fetch(`${API_ENDPOINTS.products}/attribute-board`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load products.");
        setAllProducts(data.products || []);
      } catch (err) {
        setError(err.message || "Could not load products.");
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  const loadReviews = useCallback(async (productId) => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.adminReviews}/product/${productId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load reviews.");
      setReviews(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message || "Failed to load reviews.");
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const pickProduct = (product) => {
    setSelected(product);
    setPickerQuery("");
    setPickerOpen(false);
    setForm(EMPTY_FORM);
    setError("");
    loadReviews(product.id);
  };

  // Client-side filter over the loaded catalogue — searchable without another request.
  const filteredProducts = useMemo(() => {
    const term = pickerQuery.trim().toLowerCase();
    if (!term) return allProducts;
    return allProducts.filter((p) =>
      String(p.name || "").toLowerCase().includes(term) || String(p.sku || "").toLowerCase().includes(term));
  }, [allProducts, pickerQuery]);

  const resetForm = () => setForm(EMPTY_FORM);

  const editReview = (review) => {
    setForm({
      id: review.id,
      reviewer_name: review.reviewer_name || "",
      rating: review.rating || 5,
      comment: review.comment || "",
      images: Array.isArray(review.images) ? review.images.map((i) => (typeof i === "string" ? { url: i } : i)) : [],
      review_date: review.review_date ? String(review.review_date).slice(0, 10) : "",
      is_active: review.is_active !== false,
      is_verified: Boolean(review.is_verified),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    setError("");
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
        if (!res.ok || data.error) throw new Error(data?.error?.message || "Image upload failed.");
        return { url: data.secure_url };
      }));
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded].slice(0, 6) }));
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removeFormImage = (index) => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));

  const submitForm = async () => {
    if (!selected) return;
    if (!form.reviewer_name.trim()) { setError("Reviewer name is required."); return; }
    if (form.comment.trim().length < 3) { setError("Please write the review text."); return; }

    setSaving(true);
    setError("");
    const payload = {
      product_id: selected.id,
      reviewer_name: form.reviewer_name.trim(),
      rating: form.rating,
      comment: form.comment.trim(),
      images: form.images,
      review_date: form.review_date || null,
      is_active: form.is_active,
      is_verified: form.is_verified,
    };
    try {
      const editing = Boolean(form.id);
      const res = await fetch(editing ? `${API_ENDPOINTS.adminReviews}/${form.id}` : API_ENDPOINTS.adminReviews, {
        method: editing ? "PUT" : "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save review.");
      setToast(editing ? "Review updated." : "Review added.");
      resetForm();
      await loadReviews(selected.id);
    } catch (err) {
      setError(err.message || "Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  const deleteReview = async (id) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.adminReviews}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete.");
      setToast("Review deleted.");
      if (form.id === id) resetForm();
      await loadReviews(selected.id);
    } catch (err) {
      setError(err.message || "Failed to delete review.");
    }
  };

  const toggleActive = async (review) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.adminReviews}/${review.id}`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ is_active: !(review.is_active !== false) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update.");
      await loadReviews(selected.id);
    } catch (err) {
      setError(err.message || "Failed to update review.");
    }
  };

  const toggleVerified = async (review) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.adminReviews}/${review.id}`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ is_verified: !review.is_verified }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update.");
      await loadReviews(selected.id);
    } catch (err) {
      setError(err.message || "Failed to update review.");
    }
  };

  // Badging thirty seed reviews one at a time is the kind of job that gets abandoned halfway,
  // and half-done is the worst state: a shopper reading two badged reviews and one unbadged
  // infers something about the unbadged one that is not true.
  const setAllVerified = async (verified) => {
    if (!selected?.id) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.adminReviews}/verified/bulk`, {
        method: "PUT",
        headers: jsonHeaders(),
        body: JSON.stringify({ product_id: selected.id, is_verified: verified }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update.");
      setToast(data?.message || "Reviews updated.");
      await loadReviews(selected.id);
    } catch (err) {
      setError(err.message || "Failed to update reviews.");
    }
  };

  const activeCount = useMemo(() => reviews.filter((r) => r.is_active !== false).length, [reviews]);
  const verifiedCount = useMemo(() => reviews.filter((r) => r.is_verified).length, [reviews]);

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#087a55] text-white shadow-lg text-sm font-semibold">
          <Check className="w-4 h-4 shrink-0" /> <span>{toast}</span>
        </div>
      )}

      <div>
        <h1 className="brand-font text-2xl font-bold text-[#800020] flex items-center gap-2">
          <Star className="w-6 h-6" /> Seed Reviews
        </h1>
        <p className="text-xs text-[#4A3F35]/60 font-semibold mt-0.5">
          Reviews shown on a product only while it has no real customer reviews yet.
        </p>
      </div>

      <div className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          The moment a genuine customer review is approved for a product, these seed reviews stop
          showing on the storefront automatically. They never mix with real reviews.
        </span>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {/* ── Product picker: searchable dropdown over the whole catalogue ──────────────── */}
      <div className="p-4 bg-white rounded-xl border border-[#D4AF37]/20 space-y-3">
        <label className="text-[11px] font-black text-[#4A3F35]/50 uppercase tracking-wider">Choose a product</label>

        {selected && (
          <div className="flex items-center gap-3">
            {selected.image ? (
              <img src={selected.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#D4AF37]/25" />
            ) : (
              <span className="w-12 h-12 rounded-lg grid place-items-center bg-[#F5F1ED] text-[#800020]/40"><PackageSearch className="w-5 h-5" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#4A3F35] truncate">{selected.name}</p>
              <p className="text-[11px] font-semibold text-[#4A3F35]/45">{selected.sku || `#${selected.id}`}</p>
            </div>
            <button
              type="button"
              onClick={() => { setSelected(null); setReviews([]); resetForm(); }}
              className="text-xs font-bold text-[#800020] border border-[#800020]/25 rounded-lg px-3 py-1.5 hover:bg-[#800020]/5"
            >
              Clear
            </button>
          </div>
        )}

        <div className="relative">
          {/* Searchable dropdown: type to filter, click to select. Blur is delayed so a click on
              an option registers before the list closes. */}
          <input
            value={pickerQuery}
            onChange={(e) => { setPickerQuery(e.target.value); setPickerOpen(true); }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            placeholder={productsLoading ? "Loading products…" : `Search ${allProducts.length} products by name or SKU…`}
            disabled={productsLoading}
            className="w-full h-10 px-3 rounded-lg border border-[#D4AF37]/30 text-sm text-[#4A3F35] outline-none focus:border-[#800020] disabled:opacity-60"
          />
          {productsLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[#800020]/50" />}

          {pickerOpen && !productsLoading && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D4AF37]/25 rounded-lg shadow-lg divide-y divide-[#D4AF37]/10 max-h-72 overflow-y-auto custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="px-3 py-3 text-xs font-semibold text-[#4A3F35]/50">No products match “{pickerQuery}”.</div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    // onMouseDown (not onClick) so it fires before the input's onBlur closes the list.
                    onMouseDown={() => pickProduct(p)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#FAF8F6] text-left ${selected?.id === p.id ? "bg-[#800020]/5" : ""}`}
                  >
                    {p.image ? (
                      <img src={p.image} alt="" className="w-9 h-9 rounded object-cover border border-[#D4AF37]/25" />
                    ) : (
                      <span className="w-9 h-9 rounded grid place-items-center bg-[#F5F1ED] text-[#800020]/40"><PackageSearch className="w-4 h-4" /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[#4A3F35] truncate">{p.name}</span>
                      <span className="block text-[11px] font-semibold text-[#4A3F35]/45">{p.sku || `#${p.id}`}</span>
                    </span>
                    {selected?.id === p.id && <Check className="w-4 h-4 text-[#800020] shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <>
          {/* ── Add / edit form ──────────────────────────────────────────────────────── */}
          <div className="p-4 bg-white rounded-xl border border-[#D4AF37]/20 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#4A3F35] flex items-center gap-2">
                {form.id ? <><Pencil className="w-4 h-4 text-[#800020]" /> Edit review</> : <><Plus className="w-4 h-4 text-[#800020]" /> Add a review</>}
              </h2>
              {form.id && (
                <button type="button" onClick={resetForm} className="text-[11px] font-bold text-[#4A3F35]/50 hover:text-[#800020]">Cancel edit</button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-[#4A3F35]/50 uppercase">Reviewer name</label>
                <input
                  value={form.reviewer_name}
                  onChange={(e) => setForm((f) => ({ ...f, reviewer_name: e.target.value }))}
                  placeholder="e.g. Ananya Sharma"
                  className="w-full h-10 px-3 mt-1 rounded-lg border border-[#D4AF37]/30 text-sm text-[#4A3F35] outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-[#4A3F35]/50 uppercase block mb-1">Rating</label>
                <div className="h-10 flex items-center"><StarRating value={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} size={24} /></div>
              </div>
            </div>

            {/* No title field. Seed reviews stand in for real customer reviews, and those
                no longer carry one — a seeded title would render where a real review shows
                nothing, which is exactly how a seed gives itself away. */}
            <div>
              <label className="text-[10px] font-black text-[#4A3F35]/50 uppercase">Review</label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                rows={3}
                placeholder="Write the review as the customer would…"
                className="w-full px-3 py-2 mt-1 rounded-lg border border-[#D4AF37]/30 text-sm text-[#4A3F35] outline-none focus:border-[#800020] resize-y"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-[#4A3F35]/50 uppercase">Date (optional)</label>
                <input
                  type="date"
                  value={form.review_date}
                  onChange={(e) => setForm((f) => ({ ...f, review_date: e.target.value }))}
                  className="w-full h-10 px-3 mt-1 rounded-lg border border-[#D4AF37]/30 text-sm text-[#4A3F35] outline-none focus:border-[#800020]"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#4A3F35]/70 self-end h-10 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-[#800020]" />
                Active (visible on storefront)
              </label>
            </div>

            {/* A seed review has no purchase behind it, so unlike a real customer review there
                is nothing to derive this from — it is off unless deliberately turned on. */}
            <label className="flex items-start gap-2 text-xs font-bold text-[#4A3F35]/70 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_verified}
                onChange={(e) => setForm((f) => ({ ...f, is_verified: e.target.checked }))}
                className="accent-[#800020] mt-0.5"
              />
              <span>
                Show &ldquo;Verified Buyer&rdquo; badge
                <span className="block font-medium text-[#4A3F35]/45 mt-0.5">
                  Leave off and the review shows only its date.
                </span>
              </span>
            </label>

            {/* Images */}
            <div>
              <label className="text-[10px] font-black text-[#4A3F35]/50 uppercase block mb-1">Photos (optional)</label>
              <div className="flex flex-wrap items-center gap-2">
                {form.images.map((img, i) => (
                  <div key={`${img.url}-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#D4AF37]/25">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeFormImage(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {form.images.length < 6 && (
                  <label className="w-16 h-16 rounded-lg border border-dashed border-[#D4AF37]/40 grid place-items-center cursor-pointer text-[#800020]/60 hover:border-[#800020]/50">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadImages(e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={submitForm}
                className="h-10 px-4 rounded-lg bg-[#800020] text-white text-sm font-bold disabled:opacity-40 inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : form.id ? "Save changes" : "Add review"}
              </button>
            </div>
          </div>

          {/* ── Existing reviews ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-[#D4AF37]/20 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#D4AF37]/15 bg-[#FAF8F6] flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#4A3F35]">Seed reviews for this product</span>
              <span className="flex-1 min-w-[8px]" />
              {reviews.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAllVerified(verifiedCount < reviews.length)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#800020] hover:bg-amber-50 rounded px-2 py-1"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  {verifiedCount < reviews.length ? "Verify all" : "Unverify all"}
                </button>
              )}
              <span className="text-[11px] font-bold text-[#4A3F35]/45">
                {activeCount} active · {verifiedCount} verified · {reviews.length} total
              </span>
            </div>

            {loadingReviews ? (
              <div className="p-10 flex flex-col items-center gap-2 text-[#4A3F35]/60">
                <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
                <span className="text-xs font-semibold">Loading…</span>
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-10 flex flex-col items-center gap-2 text-center">
                <Star className="w-8 h-8 text-[#800020]/30" />
                <span className="text-sm font-bold text-[#4A3F35]">No seed reviews yet</span>
                <span className="text-xs text-[#4A3F35]/60 font-semibold">Add one above — it will show until a real review arrives.</span>
              </div>
            ) : (
              <div className="divide-y divide-[#D4AF37]/10">
                {reviews.map((review) => {
                  const inactive = review.is_active === false;
                  return (
                    <div key={review.id} className={`p-4 flex gap-3 ${inactive ? "opacity-55" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StarRating value={review.rating} size={15} />
                          <span className="text-sm font-bold text-[#4A3F35]">{review.reviewer_name}</span>
                          {review.is_verified && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
                              <BadgeCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                          {inactive && <span className="text-[10px] font-bold uppercase text-[#4A3F35]/45 bg-[#4A3F35]/8 rounded px-1.5 py-0.5">Hidden</span>}
                        </div>
                        <p className="text-[13px] text-[#4A3F35]/75 mt-0.5 whitespace-pre-line">{review.comment}</p>
                        {Array.isArray(review.images) && review.images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {review.images.map((img, i) => (
                              <img key={`${img.url}-${i}`} src={img.url} alt="" className="w-12 h-12 rounded object-cover border border-[#D4AF37]/20" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button type="button" onClick={() => toggleActive(review)} title={inactive ? "Show" : "Hide"} className="p-1.5 text-[#4A3F35]/50 hover:text-[#800020] hover:bg-amber-50 rounded">
                          {inactive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVerified(review)}
                          title={review.is_verified ? "Remove Verified Buyer badge" : "Show Verified Buyer badge"}
                          className={`p-1.5 rounded hover:bg-emerald-50 ${review.is_verified ? "text-emerald-600" : "text-[#4A3F35]/50 hover:text-emerald-600"}`}
                        >
                          <BadgeCheck className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => editReview(review)} title="Edit" className="p-1.5 text-[#4A3F35]/50 hover:text-[#D4AF37] hover:bg-amber-50 rounded">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => deleteReview(review.id)} title="Delete" className="p-1.5 text-[#4A3F35]/50 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
