import { useState, useEffect } from "react";
import { imgUrl } from "../../utils/cloudinary";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Layers,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Search,
  Sparkles,
  Video,
  UploadCloud,
  X,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

const INITIAL_FORM = { name: "", description: "", video: "" };

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

export default function Occasions() {
  const [occasions, setOccasions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Unified modal system
  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    onCancel: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [occRes, prodRes] = await Promise.all([
        fetch(API_ENDPOINTS.occasions),
        fetch(API_ENDPOINTS.products),
      ]);
      let occ = await occRes.json();
      let prods = await prodRes.json();
      if (!Array.isArray(occ)) occ = occ.data || [];
      if (!Array.isArray(prods)) prods = prods.data || [];
      occ.sort((a, b) => b.id - a.id);
      setOccasions(occ);
      setProducts(prods);
    } catch {
      showModal("error", "Error", "Failed to load occasions from server");
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    setModal({ show: true, type, title, message, onConfirm, onCancel });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, show: false }));
    setTimeout(() => {
      setModal({ show: false, type: "info", title: "", message: "", onConfirm: null, onCancel: null });
    }, 200);
  };

  const filteredOccasions = occasions.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.description && o.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openFormModal = (occasion = null) => {
    if (occasion) {
      setEditingOccasion(occasion);
      setFormData({ name: occasion.name, description: occasion.description || "", video: occasion.video || "" });
    } else {
      setEditingOccasion(null);
      setFormData(INITIAL_FORM);
    }
    setUploading(false);
    setUploadPct(0);
    setUploadError("");
    setIsModalOpen(true);
  };

  const generateSlug = (name) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // Upload the chosen video straight to S3, then keep the public URL on the form.
  const handleVideoFile = async (file) => {
    if (!file) return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setUploadError("You are not logged in. Please log in again.");
      return;
    }
    setUploadError("");
    setUploading(true);
    setUploadPct(0);
    try {
      const contentType = file.type || "video/mp4";
      const params = new URLSearchParams({ fileName: file.name || "occasion.mp4", contentType });
      const res = await fetch(`${API_ENDPOINTS.occasions}/admin/upload-url?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Could not get upload URL (HTTP ${res.status})`);
      }
      const { uploadUrl, publicUrl } = await res.json();
      // Content-Type on the PUT must match what the URL was signed for.
      await uploadToS3(uploadUrl, file, setUploadPct, contentType);
      setFormData((f) => ({ ...f, video: publicUrl }));
    } catch (e) {
      setUploadError(e.message || "Video upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const itemName = formData.name;
    const slug = generateSlug(itemName);

    showModal(
      "confirm",
      editingOccasion ? "Update Occasion?" : "Create Occasion?",
      editingOccasion
        ? `Are you sure you want to update "${itemName}"?`
        : `Are you sure you want to create occasion "${itemName}"?`,
      async () => {
        setSubmitting(true);
        closeModal();

        try {
          const url = editingOccasion
            ? `${API_ENDPOINTS.occasions}/${editingOccasion.id}`
            : API_ENDPOINTS.occasions;
          const method = editingOccasion ? "PUT" : "POST";
          const token = localStorage.getItem("accessToken");

          const payload = {
            name: formData.name,
            slug: editingOccasion ? editingOccasion.slug : slug,
            video: formData.video,
          };
          if (formData.description) payload.description = formData.description;

          const res = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            await fetchData();
            setIsModalOpen(false);
            showModal(
              "success",
              "Success",
              editingOccasion
                ? `Occasion "${itemName}" updated successfully!`
                : `Occasion "${itemName}" created successfully!`
            );
          } else {
            const err = await res.json();
            showModal("error", "Error", err.message || "Failed to save occasion");
          }
        } catch {
          showModal("error", "Error", "Network error. Please try again.");
        } finally {
          setSubmitting(false);
        }
      },
      closeModal
    );
  };

  const checkAndConfirmDelete = (occasion) => {
    // Check if occasion is linked to any products
    const linkedProducts = products.filter((p) => Array.isArray(p.occasion_ids) && p.occasion_ids.map(Number).includes(Number(occasion.id)));

    if (linkedProducts.length > 0) {
      const productNames = linkedProducts
        .slice(0, 3)
        .map((p) => `• ${p.name}`)
        .join("\n");
      const moreCount =
        linkedProducts.length > 3
          ? `\n... and ${linkedProducts.length - 3} more products`
          : "";
      showModal(
        "error",
        "Cannot Delete Occasion",
        `"${occasion.name}" is linked to ${linkedProducts.length} product(s):\n\n${productNames}${moreCount}\n\nPlease remove these products or change their occasion before deleting.`,
        closeModal,
      );
      return;
    }

    // No linked products — show confirmation
    showModal(
      "danger",
      "Delete Occasion?",
      `Are you sure you want to delete "${occasion.name}"?\n\nThis action cannot be undone.`,
      async () => {
        closeModal();
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API_ENDPOINTS.occasions}/${occasion.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            await fetchData();
            showModal("success", "Success", `Occasion "${occasion.name}" deleted successfully!`);
          } else {
            const err = await res.json();
            showModal("error", "Error", err.message || "Failed to delete occasion");
          }
        } catch {
          showModal("error", "Error", "Network error. Please try again.");
        }
      },
      closeModal
    );
  };

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "error":   return <AlertCircle className="w-6 h-6 text-red-500" />;
      case "danger":  return <AlertTriangle className="w-6 h-6 text-red-600" />;
      default:        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <div className="space-y-6 opacity-50 pointer-events-none">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#800020]">Occasions</h1>
              <p className="text-sm text-gray-500 mt-1">Product occasion types</p>
            </div>
            <button className="px-6 py-2.5 bg-[#800020] text-white font-bold rounded-lg opacity-50">
              Add Occasion
            </button>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 h-20"></div>
          <div className="bg-white rounded-xl border border-[#D4AF37]/20 h-96"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-[#D4AF37]/20 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#800020] animate-spin mb-4" />
            <p className="text-[#4A3F35] font-medium">Loading occasions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800020]">Occasions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Product occasion types (Wedding, Festival, etc.)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search occasions..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none text-sm w-full sm:w-64"
            />
          </div>
          <button
            onClick={() => openFormModal()}
            className="px-6 py-2.5 bg-[#800020] text-white font-bold rounded-lg flex items-center gap-2 hover:bg-[#6b001a] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Occasion
          </button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#800020]/10 rounded-xl">
            <Sparkles className="w-6 h-6 text-[#800020]" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Occasions</p>
            <p className="text-2xl font-bold text-[#4A3F35]">{occasions.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D4AF37]/20 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#FAF8F6]">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-16">
                S.No
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Video
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Occasion Name
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOccasions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-16 text-center">
                  <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No occasions found. Add your first occasion!</p>
                </td>
              </tr>
            ) : (
              filteredOccasions.map((occasion, index) => (
                <tr key={occasion.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-bold text-gray-400">{index + 1}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-[#800020] bg-[#800020]/10 px-2 py-1 rounded font-bold">
                      #{occasion.id}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {occasion.video ? (
                      <video
                        src={occasion.video}
                        className="w-16 h-10 rounded object-cover bg-black"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : occasion.image ? (
                      <img src={imgUrl(occasion.image)} alt={occasion.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-[10px]">No media</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-[#4A3F35]">{occasion.name}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {occasion.slug}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-md">
                    {occasion.description || "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openFormModal(occasion)}
                        className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          checkAndConfirmDelete(occasion);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal - Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !uploading && setIsModalOpen(false)}
          />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-[#800020] to-[#a0152d] text-white rounded-t-2xl">
              <h2 className="text-lg font-bold">
                {editingOccasion ? "Edit Occasion" : "New Occasion"}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {editingOccasion ? "Update occasion details" : "Add a new occasion type"}
              </p>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Occasion Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full mt-1.5 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none transition-all"
                  placeholder="e.g., Wedding, Festival, Party"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1.5 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none transition-all resize-none"
                  placeholder="Describe this occasion..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Video {editingOccasion ? "" : "*"}
                </label>
                {uploadError && (
                  <div className="mt-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg">
                    {uploadError}
                  </div>
                )}
                <div className="mt-1.5">
                  {formData.video ? (
                    <div className="relative bg-black rounded-lg overflow-hidden w-32 h-40">
                      <video src={formData.video} className="w-full h-full object-cover" muted controls playsInline />
                      <button
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, video: "" }))}
                        className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full"
                        title="Remove video"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
                        uploading ? "border-[#800020]/40 bg-[#800020]/5" : "border-gray-300 hover:border-[#800020]/40"
                      }`}
                    >
                      {uploading ? (
                        <>
                          <UploadCloud className="w-7 h-7 text-[#800020]" />
                          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#800020] transition-all" style={{ width: `${uploadPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">Uploading… {uploadPct}%</span>
                        </>
                      ) : (
                        <>
                          <Video className="w-7 h-7 text-gray-300" />
                          <span className="text-xs text-gray-500 font-medium">Click to upload a video (MP4)</span>
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
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={uploading}
                  className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading || !formData.name.trim() || !formData.video}
                  className="px-5 py-2 bg-[#800020] text-white font-bold rounded-lg flex items-center gap-2 hover:bg-[#6b001a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingOccasion ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Modal */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={modal.type === "success" || modal.type === "error" ? closeModal : undefined}
          />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-6 py-4 border-b rounded-t-2xl ${
                modal.type === "success"
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : modal.type === "error"
                  ? "bg-gradient-to-r from-red-600 to-red-700"
                  : modal.type === "danger"
                  ? "bg-gradient-to-r from-red-500 to-red-600"
                  : "bg-gradient-to-r from-[#800020] to-[#a0152d]"
              } text-white`}
            >
              <div className="flex items-center gap-3">
                {getIcon(modal.type === "confirm" ? "warning" : modal.type)}
                <h2 className="text-lg font-bold">{modal.title}</h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 whitespace-pre-line leading-relaxed">{modal.message}</p>
            </div>

            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 rounded-b-2xl">
              {(modal.type === "success" || modal.type === "error") && (
                <button
                  onClick={closeModal}
                  className={`px-6 py-2 font-bold rounded-lg transition-colors ${
                    modal.type === "success"
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                >
                  OK
                </button>
              )}

              {modal.type === "confirm" && (
                <>
                  <button
                    onClick={modal.onCancel || closeModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modal.onConfirm}
                    className="px-6 py-2 bg-[#800020] hover:bg-[#6b001a] text-white font-bold rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                </>
              )}

              {modal.type === "danger" && (
                <>
                  <button
                    onClick={modal.onCancel || closeModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={modal.onConfirm}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
