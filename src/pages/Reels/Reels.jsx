import { useState, useEffect } from "react";
import {
  Plus, Trash2, Pencil, CheckCircle, Film, Video, Heart, Eye,
  MessageSquare, X, Search, UploadCloud, EyeOff,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

const token = () =>
  localStorage.getItem("accessToken") ||
  localStorage.getItem("admin_token") ||
  localStorage.getItem("token");

const authHeaders = (extra = {}) => ({
  Authorization: `Bearer ${token()}`,
  ...extra,
});

const EMPTY_FORM = {
  title: "",
  description: "",
  product_ids: [],
  display_order: 0,
  is_published: true,
  video_url: "",
};

// Upload directly to S3 via a pre-signed PUT URL, reporting progress. The
// Content-Type MUST equal the value the URL was signed with or S3 returns 403.
const uploadToS3 = (uploadUrl, file, onProgress, contentType) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType || file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 upload rejected the file (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error uploading to S3 (check connection / bucket CORS)"));
    xhr.send(file);
  });

export default function Reels() {
  const [activeTab, setActiveTab] = useState("reels"); // 'reels' | 'comments'
  const [reels, setReels] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  const fetchReels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/admin/all`, { headers: authHeaders() });
      const data = await res.json();
      setReels(Array.isArray(data.reels) ? data.reels : []);
    } catch (e) {
      console.error("fetchReels", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.reels}/admin/comments/pending`, { headers: authHeaders() });
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      console.error("fetchComments", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.products}?status=active&limit=500`);
      const data = await res.json();
      const list = data.items || data.products || (Array.isArray(data) ? data : []);
      setProducts(list);
    } catch (e) {
      console.error("fetchProducts", e);
    }
  };

  useEffect(() => {
    const load = activeTab === "reels" ? fetchReels : fetchComments;
    load();
  }, [activeTab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch
    fetchProducts();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setUploadPct(0);
    setModalOpen(true);
  };

  const openEdit = (reel) => {
    setEditing(reel);
    setForm({
      title: reel.title || "",
      description: reel.description || "",
      product_ids: (reel.products || []).map((p) => p.id),
      display_order: reel.display_order || 0,
      is_published: reel.is_published,
      video_url: reel.video_url || "",
    });
    setError("");
    setUploadPct(0);
    setModalOpen(true);
  };

  const handleVideoFile = async (file) => {
    if (!file) return;
    if (!token()) {
      setError("You are not logged in (no admin token). Please log in again.");
      return;
    }
    setError("");
    setUploading(true);
    setUploadPct(0);
    try {
      const contentType = file.type || "video/mp4";
      const params = new URLSearchParams({ fileName: file.name || "reel.mp4", contentType });
      const res = await fetch(`${API_ENDPOINTS.reels}/admin/upload-url?${params}`, { headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Could not get upload URL (HTTP ${res.status})`);
      }
      const { uploadUrl, publicUrl } = await res.json();
      // Content-Type on the PUT must match what the URL was signed for.
      await uploadToS3(uploadUrl, file, setUploadPct, contentType);
      setForm((f) => ({ ...f, video_url: publicUrl }));
    } catch (e) {
      console.error("[Reels] video upload failed:", e);
      setError(e.message || "Video upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleProduct = (id) => {
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id)
        ? f.product_ids.filter((p) => p !== id)
        : [...f.product_ids, id],
    }));
  };

  const saveReel = async () => {
    if (!form.video_url) { setError("Please upload a video first."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editing ? `${API_ENDPOINTS.reels}/${editing.id}` : API_ENDPOINTS.reels;
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Could not save reel");
      }
      setModalOpen(false);
      fetchReels();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReel = async (id) => {
    if (!window.confirm("Delete this reel? Its video will be removed from storage.")) return;
    await fetch(`${API_ENDPOINTS.reels}/${id}`, { method: "DELETE", headers: authHeaders() });
    fetchReels();
  };

  const approveComment = async (id) => {
    await fetch(`${API_ENDPOINTS.reels}/admin/comments/${id}/approve`, {
      method: "PUT",
      headers: authHeaders(),
    });
    fetchComments();
  };

  const deleteComment = async (id) => {
    await fetch(`${API_ENDPOINTS.reels}/admin/comments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    fetchComments();
  };

  const filteredProducts = products.filter((p) =>
    (p.name || "").toLowerCase().includes(productSearch.toLowerCase())
  );

  const productThumb = (p) => (Array.isArray(p.images) && p.images[0]?.url) || p.image_url || "";

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="brand-font text-2xl font-bold text-[#800020]">Reels</h2>
          <p className="text-gray-500 text-sm mt-1">Shoppable short videos with likes and moderated comments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("reels")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "reels" ? "bg-white text-[#800020] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Reels
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "comments" ? "bg-white text-[#800020] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Pending Comments{comments.length ? ` (${comments.length})` : ""}
            </button>
          </div>
          {activeTab === "reels" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#800020] text-white text-xs font-bold rounded-xl hover:bg-[#6a001a] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Reel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-20 text-center">
          <div className="w-10 h-10 border-4 border-[#D4AF37]/20 border-t-[#800020] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium">Loading…</p>
        </div>
      ) : activeTab === "reels" ? (
        reels.length === 0 ? (
          <div className="glass-card rounded-2xl border border-[#D4AF37]/10 p-20 text-center">
            <Film className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No reels yet. Click “New Reel” to add one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {reels.map((reel) => (
              <div key={reel.id} className="glass-card rounded-2xl overflow-hidden border border-[#D4AF37]/10 shadow-sm flex flex-col">
                <div className="relative bg-black aspect-[9/16] flex items-center justify-center">
                  <video src={reel.video_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  {!reel.is_published && (
                    <span className="absolute top-2 left-2 bg-gray-900/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <p className="font-bold text-[#4A3F35] text-sm truncate">{reel.title || "Untitled reel"}</p>
                  <p className="text-[11px] text-gray-500 line-clamp-2 min-h-[30px]">{reel.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {reel.like_count}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {reel.comment_count}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {reel.view_count}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(reel.products || []).slice(0, 4).map((p) => (
                      <img key={p.id} src={productThumb(p)} alt={p.name} title={p.name} className="w-8 h-8 rounded object-cover border" />
                    ))}
                    {(reel.products || []).length > 4 && (
                      <span className="text-[10px] text-gray-400">+{reel.products.length - 4}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button onClick={() => openEdit(reel)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[#800020] bg-[#800020]/5 rounded-lg hover:bg-[#800020]/10">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => deleteReel(reel.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : comments.length === 0 ? (
        <div className="glass-card rounded-2xl border border-[#D4AF37]/10 p-20 text-center">
          <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No comments awaiting approval.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-[#D4AF37]/10">
          <table className="w-full text-left">
            <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400 border-b border-[#D4AF37]/10">
              <tr>
                <th className="px-6 py-4">Author</th>
                <th className="px-6 py-4">Comment</th>
                <th className="px-6 py-4">Reel</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-white">
              {comments.map((c) => (
                <tr key={c.id} className="hover:bg-[#FAF8F6]/50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#4A3F35]">{c.author}</p>
                    <p className="text-[10px] text-gray-400">{c.author_email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 max-w-sm italic">“{c.comment}”</td>
                  <td className="px-6 py-4 text-gray-600">{c.reel_title}</td>
                  <td className="px-6 py-4 text-gray-400 text-[10px]">
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => approveComment(c.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteComment(c.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && !uploading && setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-[#800020] text-lg">{editing ? "Edit Reel" : "New Reel"}</h3>
              <button onClick={() => !saving && !uploading && setModalOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && <div className="bg-red-50 text-red-600 text-xs font-semibold px-4 py-3 rounded-lg">{error}</div>}

              {/* Video */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Video *</label>
                <div className="mt-2">
                  {form.video_url ? (
                    <div className="relative bg-black rounded-xl overflow-hidden aspect-[9/16] max-w-[200px]">
                      <video src={form.video_url} className="w-full h-full object-cover" muted controls playsInline />
                      <button
                        onClick={() => setForm((f) => ({ ...f, video_url: "" }))}
                        className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full"
                        title="Replace video"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors ${uploading ? "border-[#800020]/40 bg-[#800020]/5" : "border-gray-200 hover:border-[#800020]/40"}`}>
                      {uploading ? (
                        <>
                          <UploadCloud className="w-8 h-8 text-[#800020]" />
                          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#800020] transition-all" style={{ width: `${uploadPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">Uploading… {uploadPct}%</span>
                        </>
                      ) : (
                        <>
                          <Video className="w-8 h-8 text-gray-300" />
                          <span className="text-xs text-gray-500 font-medium">Click to upload a vertical video (MP4)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleVideoFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Title + description */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Optional headline"
                  className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#800020]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Caption shown under the reel"
                  className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#800020]"
                />
              </div>

              {/* Products */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Featured products ({form.product_ids.length})
                </label>
                <div className="mt-2 relative">
                  <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products to feature"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {filteredProducts.slice(0, 60).map((p) => {
                    const selected = form.product_ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProduct(p.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${selected ? "bg-[#800020]/5" : "hover:bg-gray-50"}`}
                      >
                        <img src={productThumb(p)} alt="" className="w-10 h-10 rounded object-cover border" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#4A3F35] truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400">₹{p.selling_price}</p>
                        </div>
                        {selected && <CheckCircle className="w-4 h-4 text-[#800020]" />}
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-6 text-center">No products match.</p>
                  )}
                </div>
              </div>

              {/* Order + publish */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Display order</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                    className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#800020]"
                  />
                </div>
                <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                    className="w-4 h-4 accent-[#800020]"
                  />
                  <span className="text-sm font-semibold text-gray-700">Published</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setModalOpen(false)} disabled={saving || uploading} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                Cancel
              </button>
              <button onClick={saveReel} disabled={saving || uploading} className="px-6 py-2.5 text-sm font-bold text-white bg-[#800020] rounded-xl hover:bg-[#6a001a] disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save changes" : "Create reel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
