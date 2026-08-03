import { useEffect, useState } from "react";
import { Film, ImagePlus, LayoutGrid, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import API_ENDPOINTS from "../../config/api";
import { imgUrl } from "../../utils/cloudinary";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

// Upload directly to S3 via a pre-signed PUT URL, reporting progress.
const uploadToS3 = (uploadUrl, file, onProgress, contentType, cacheControl) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    // Must match the CacheControl the presigned URL was signed with, or S3 returns a
    // signature mismatch. The value comes from the server so the two cannot drift.
    if (cacheControl) xhr.setRequestHeader("Cache-Control", cacheControl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("S3 upload failed."));
    xhr.send(file);
  });

const INITIAL_FORM = {
  title: "",
  description: "",
  images: [],
  videos: [],
  display_order: 0,
  is_active: true,
};

// Admin manager for the home page's "Box Section" mosaic: each entry holds a
// title/description plus multiple images and multiple videos.
export default function BoxSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoStatus, setVideoStatus] = useState(null); // "2/3 · 47%" while uploading

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_ENDPOINTS.boxSections}/admin/list`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load entries.");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const busy = saving || imageUploading || videoStatus !== null;

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: row.description || "",
      images: Array.isArray(row.images) ? row.images : [],
      videos: Array.isArray(row.videos) ? row.videos : [],
      display_order: Number(row.display_order) || 0,
      is_active: row.is_active !== false,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (busy) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  // Multiple images → Cloudinary, using the shared signed-upload endpoint.
  const handleImageFiles = async (files) => {
    if (!files.length) return;
    setImageUploading(true);
    setError("");
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
      const sigRes = await fetch(`${API_ENDPOINTS.products}/upload-signature?resourceType=image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!sigRes.ok) throw new Error("Failed to get upload signature");
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
        if (!res.ok || data.error) throw new Error(data?.error?.message || `Image upload failed (${res.status})`);
        return data.secure_url;
      }));
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded] }));
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setImageUploading(false);
    }
  };

  // Multiple videos → direct-to-S3, uploaded one after another with progress.
  const handleVideoFiles = async (files) => {
    if (!files.length) return;
    setError("");
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const contentType = file.type || "video/mp4";
        setVideoStatus(`${index + 1}/${files.length} · 0%`);
        const params = new URLSearchParams({ fileName: file.name, contentType });
        const res = await fetch(`${API_ENDPOINTS.boxSections}/admin/upload-url?${params}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to get upload URL.");
        await uploadToS3(data.uploadUrl, file, (pct) => setVideoStatus(`${index + 1}/${files.length} · ${pct}%`), contentType, data.cacheControl);
        setForm((current) => ({ ...current, videos: [...current.videos, data.publicUrl] }));
      }
    } catch (err) {
      setError(err.message || "Video upload failed.");
    } finally {
      setVideoStatus(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.images.length && !form.videos.length) {
      setError("Add at least one image or video.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(editingId ? `${API_ENDPOINTS.boxSections}/${editingId}` : API_ENDPOINTS.boxSections, {
        method: editingId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, display_order: Number(form.display_order) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to save the entry.");
      closeForm();
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to save the entry.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const res = await fetch(`${API_ENDPOINTS.boxSections}/${row.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      if (!res.ok) throw new Error("Unable to update the entry.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to update the entry.");
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete "${row.title || `entry #${row.id}`}"? Its videos are removed from storage too.`)) return;
    try {
      const res = await fetch(`${API_ENDPOINTS.boxSections}/${row.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok && res.status !== 204) throw new Error("Unable to delete the entry.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to delete the entry.");
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#800020]/10 text-[#800020]">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <h2 className="brand-font text-xl font-bold text-[#800020]">Box Section</h2>
            <p className="mt-0.5 text-xs text-[#4A3F35]/60">Home-page mosaic — title with multiple images and videos per entry.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadRows} className="rounded-lg border border-[#800020]/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#800020]">
            <RefreshCw className="mr-1 inline h-3 w-3" /> Refresh
          </button>
          <button type="button" onClick={openCreate} className="rounded-lg bg-[#800020] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
            <Plus className="mr-1 inline h-3 w-3" /> New Entry
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="glass-card overflow-hidden rounded-2xl shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-[#D4AF37]/10 bg-[#FAF8F6] text-[10px] font-bold uppercase text-gray-400">
            <tr>
              <th className="px-5 py-4">Media</th>
              <th className="px-5 py-4">Title</th>
              <th className="px-5 py-4">Order</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4AF37]/5 bg-white text-xs">
            {loading && (
              <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="5">Loading entries...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td className="px-5 py-8 text-center text-gray-500" colSpan="5">No entries yet. Create the first one.</td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#FAF8F6]/60">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    {(Array.isArray(row.images) ? row.images : []).slice(0, 3).map((url, index) => (
                      <img key={`${url}-${index}`} src={imgUrl(url, 120)} alt="" className="h-12 w-9 rounded object-cover" />
                    ))}
                    {(row.images?.length || 0) > 3 && (
                      <span className="text-[10px] font-bold text-gray-400">+{row.images.length - 3}</span>
                    )}
                    {(row.videos?.length || 0) > 0 && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#800020]/10 px-2 py-1 text-[10px] font-bold text-[#800020]">
                        <Film className="h-3 w-3" /> {row.videos.length} video{row.videos.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#4A3F35]">{row.title || `Entry #${row.id}`}</div>
                  {row.description && <div className="mt-0.5 max-w-[260px] truncate text-[10px] text-gray-400">{row.description}</div>}
                </td>
                <td className="px-5 py-4 font-bold">{row.display_order}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggleActive(row)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {row.is_active ? "Active" : "Hidden"}
                  </button>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEdit(row)} className="rounded border border-[#800020]/20 bg-white px-3 py-1.5 text-[10px] font-bold uppercase text-[#800020]">
                      <Pencil className="mr-1 inline h-3 w-3" /> Edit
                    </button>
                    <button type="button" onClick={() => deleteRow(row)} className="rounded border border-red-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase text-red-600">
                      <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
          <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="brand-font text-lg font-bold text-[#800020]">{editingId ? "Edit entry" : "New Box Section entry"}</h3>
              <button type="button" onClick={closeForm} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase text-gray-500">
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Woven Wonders of Banaras"
                  className="mt-1 w-full rounded-lg border border-[#800020]/15 px-3 py-2 text-sm font-normal normal-case"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-gray-500">
                Display order
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#800020]/15 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>

            <label className="block text-xs font-bold uppercase text-gray-500">
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short line shown with this block (optional)"
                className="mt-1 w-full rounded-lg border border-[#800020]/15 px-3 py-2 text-sm font-normal normal-case"
              />
            </label>

            {/* ── Images (multiple, Cloudinary) ── */}
            <div>
              <span className="text-xs font-bold uppercase text-gray-500">Images</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {form.images.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative">
                    <img src={imgUrl(url, 160)} alt="" className="h-20 w-14 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-white"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className={`grid h-20 w-14 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[#800020]/25 text-[#800020] ${imageUploading ? "opacity-50" : ""}`}>
                  <ImagePlus className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={imageUploading}
                    onChange={(e) => {
                      handleImageFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {imageUploading && <p className="mt-1 text-[11px] text-gray-500">Uploading images…</p>}
            </div>

            {/* ── Videos (multiple, direct-to-S3) ── */}
            <div>
              <span className="text-xs font-bold uppercase text-gray-500">Videos</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {form.videos.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative">
                    <video src={url} className="h-20 w-14 rounded-lg bg-black object-cover" muted />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, videos: f.videos.filter((_, i) => i !== index) }))}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-white"
                      aria-label="Remove video"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className={`grid h-20 w-14 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-[#800020]/25 text-[#800020] ${videoStatus !== null ? "opacity-50" : ""}`}>
                  <Film className="h-5 w-5" />
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    disabled={videoStatus !== null}
                    onChange={(e) => {
                      handleVideoFiles(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {videoStatus !== null && <p className="mt-1 text-[11px] text-gray-500">Uploading video {videoStatus}</p>}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Visible on the home page
            </label>

            <div className="flex justify-end gap-2 border-t border-[#D4AF37]/10 pt-4">
              <button type="button" onClick={closeForm} className="rounded-lg border border-[#800020]/20 px-4 py-2 text-xs font-bold uppercase text-[#800020]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#800020] px-5 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Create entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
