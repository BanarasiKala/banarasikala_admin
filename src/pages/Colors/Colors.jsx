import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Palette,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

const INITIAL_FORM = { name: "", hex_code: "#000000", description: "" };

export default function Colors() {
  const [colors, setColors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
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
      console.log("Fetching colors and products...");
      setLoading(true);
      const [colRes, prodRes] = await Promise.all([
        fetch(API_ENDPOINTS.colors),
        fetch(API_ENDPOINTS.products),
      ]);
      
      if (!colRes.ok) throw new Error(`Colors API failed: ${colRes.status}`);
      if (!prodRes.ok) console.warn(`Products API failed: ${prodRes.status}`);

      let colData = await colRes.json();
      let prodData = await prodRes.json();
      
      console.log("Data received:", { colorsCount: Array.isArray(colData) ? colData.length : 'error', productsCount: Array.isArray(prodData) ? prodData.length : 'error' });

      if (!Array.isArray(colData)) colData = colData.data || [];
      if (!Array.isArray(prodData)) prodData = prodData.data || [];
      
      colData.sort((a, b) => b.id - a.id);
      setColors(colData);
      setProducts(prodData);
    } catch (err) {
      console.error("Fetch error:", err);
      showModal("error", "Error", "Failed to load colors from server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    console.log(`Showing modal: ${type} - ${title}`);
    setModal({ show: true, type, title, message, onConfirm, onCancel });
  };

  const closeModal = () => {
    console.log("Closing modal...");
    setModal((prev) => {
      // If the modal was already closed, don't do anything
      if (!prev.show) return prev;
      return { ...prev, show: false };
    });
    
    // Use a unique ID or just be very careful with timeouts
    // To prevent the race condition where a NEW modal is cleared by an OLD timeout,
    // we should only clear the state if the modal is still hidden after the delay.
    setTimeout(() => {
      setModal(prev => {
        if (prev.show) return prev; // Don't clear if a new modal has been shown
        return { show: false, type: "info", title: "", message: "", onConfirm: null, onCancel: null };
      });
    }, 300);
  };

  const filteredColors = colors.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.hex_code && c.hex_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openFormModal = (color = null) => {
    if (color) {
      setEditingColor(color);
      setFormData({ 
        name: color.name, 
        hex_code: color.hex_code || "#000000",
        description: color.description || "" 
      });
    } else {
      setEditingColor(null);
      setFormData(INITIAL_FORM);
    }
    setIsModalOpen(true);
  };

  const generateSlug = (name) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleSave = async (e) => {
    e.preventDefault();
    const itemName = formData.name.trim();
    if (!itemName) return;

    const slug = generateSlug(itemName);
    if (!slug) {
      showModal("error", "Invalid Name", "Please use a name that contains alphanumeric characters.");
      return;
    }

    console.log("Initiating save for:", itemName);

    showModal(
      "confirm",
      editingColor ? "Update Color?" : "Create Color?",
      editingColor
        ? `Are you sure you want to update "${itemName}"?`
        : `Are you sure you want to create color "${itemName}"?`,
      async () => {
        console.log("Confirm clicked, starting API call...");
        setSubmitting(true);
        // We close the confirm modal, but keep the form modal open with a spinner
        // The closeModal function has a safety check now
        setModal(prev => ({ ...prev, show: false }));

        const payload = {
          name: itemName,
          hex_code: formData.hex_code,
          description: formData.description,
          slug: editingColor ? editingColor.slug : slug,
        };

        try {
          const url = editingColor
            ? `${API_ENDPOINTS.colors}/${editingColor.id}`
            : API_ENDPOINTS.colors;
          const method = editingColor ? "PUT" : "POST";
          
          console.log(`Sending ${method} request to ${url}`, payload);
          
          const token = localStorage.getItem("accessToken");
          const res = await fetch(url, {
            method,
            headers: { 
              "Content-Type": "application/json",
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
          });

          console.log("Response status:", res.status);

          if (res.ok) {
            console.log("Save successful, refreshing data...");
            await fetchData();
            setIsModalOpen(false);
            showModal(
              "success",
              "Success",
              editingColor
                ? `Color "${itemName}" updated successfully!`
                : `Color "${itemName}" created successfully!`
            );
          } else {
            const err = await res.json();
            console.error("API error response:", err);
            showModal("error", "Error", err.message || "Failed to save color");
          }
        } catch (err) {
          console.error("Network error during save:", err);
          showModal("error", "Error", "Network error. Please check your connection and try again.");
        } finally {
          setSubmitting(false);
        }
      },
      closeModal
    );
  };

  const checkAndConfirmDelete = (color) => {
    // Check if color is linked to any products
    const linkedProducts = products.filter((p) => p.color_id === color.id);

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
        "Cannot Delete Color",
        `"${color.name}" is linked to ${linkedProducts.length} product(s):\n\n${productNames}${moreCount}\n\nPlease remove these products or change their color before deleting.`,
        closeModal,
      );
      return;
    }

    showModal(
      "danger",
      "Delete Color?",
      `Are you sure you want to delete "${color.name}"?\n\nThis action cannot be undone.`,
      async () => {
        closeModal();
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API_ENDPOINTS.colors}/${color.id}`, {
            method: "DELETE",
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            await fetchData();
            showModal("success", "Success", `Color "${color.name}" deleted successfully!`);
          } else {
            const err = await res.json();
            showModal("error", "Error", err.message || "Failed to delete color");
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

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-120px)]">
        <div className="space-y-6 opacity-50 pointer-events-none">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#800020]">Color Palette</h1>
              <p className="text-sm text-gray-500 mt-1">Manage product colors</p>
            </div>
            <button className="px-6 py-2.5 bg-[#800020] text-white font-bold rounded-lg opacity-50">
              Add Color
            </button>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 h-20"></div>
          <div className="bg-white rounded-xl border border-[#D4AF37]/20 h-96"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-[#D4AF37]/20 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#800020] animate-spin mb-4" />
            <p className="text-[#4A3F35] font-medium">Loading colors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800020]">Color Palette</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your product color variations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search colors..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none text-sm w-full sm:w-64"
            />
          </div>
          <button
            onClick={() => openFormModal()}
            className="px-6 py-2.5 bg-[#800020] text-white font-bold rounded-lg flex items-center gap-2 hover:bg-[#6b001a] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Color
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#800020]/10 rounded-xl">
            <Palette className="w-6 h-6 text-[#800020]" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Colors</p>
            <p className="text-2xl font-bold text-[#4A3F35]">{colors.length}</p>
          </div>
        </div>
      </div>

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
                Preview
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Color Name
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Hex Code
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
            {filteredColors.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-16 text-center">
                  <Palette className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No colors found.</p>
                </td>
              </tr>
            ) : (
              filteredColors.map((color, index) => (
                <tr key={color.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-bold text-gray-400">{index + 1}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-[#800020] bg-[#800020]/10 px-2 py-1 rounded font-bold">
                      #{color.id}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div 
                      className="w-8 h-8 rounded-full border border-gray-200 shadow-sm"
                      style={{ backgroundColor: color.hex_code }}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-[#4A3F35]">{color.name}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {color.slug}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-600">
                    {color.hex_code}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {color.description || "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openFormModal(color)}
                        className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => checkAndConfirmDelete(color)}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !submitting && setIsModalOpen(false)}
          />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-[#800020] to-[#a0152d] text-white rounded-t-2xl">
              <h2 className="text-lg font-bold">
                {editingColor ? "Edit Color" : "New Color"}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Color Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={submitting}
                  className="w-full mt-1.5 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none transition-all disabled:bg-gray-50"
                  placeholder="e.g., Royal Maroon"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Hex Code
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="color"
                      value={formData.hex_code}
                      onChange={(e) => setFormData({ ...formData, hex_code: e.target.value })}
                      disabled={submitting}
                      className="w-10 h-10 p-1 border border-gray-300 rounded cursor-pointer bg-white disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={formData.hex_code}
                      onChange={(e) => setFormData({ ...formData, hex_code: e.target.value })}
                      disabled={submitting}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 outline-none uppercase font-mono text-sm disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  disabled={submitting}
                  className="w-full mt-1.5 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none transition-all resize-none disabled:bg-gray-50"
                  placeholder="Describe this color..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.name.trim()}
                  className="px-5 py-2 bg-[#800020] text-white font-bold rounded-lg flex items-center gap-2 hover:bg-[#6b001a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingColor ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={modal.type !== 'confirm' && modal.type !== 'danger' ? closeModal : undefined} />
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10">
             <div className={`px-6 py-4 border-b rounded-t-2xl ${
                modal.type === "success" ? "bg-green-500" : 
                modal.type === "error" ? "bg-red-600" : 
                modal.type === "danger" ? "bg-red-500" : "bg-[#800020]"
              } text-white`}>
              <div className="flex items-center gap-3">
                {getIcon(modal.type)}
                <h2 className="text-lg font-bold">{modal.title}</h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 whitespace-pre-line leading-relaxed">{modal.message}</p>
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 rounded-b-2xl">
              {(modal.type === "success" || modal.type === "error") && (
                <button onClick={closeModal} className="px-6 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900 transition-colors">OK</button>
              )}
              {modal.type === "confirm" && (
                <>
                  <button onClick={closeModal} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                  <button onClick={modal.onConfirm} className="px-6 py-2 bg-[#800020] text-white font-bold rounded-lg hover:bg-[#6b001a] transition-colors">Confirm</button>
                </>
              )}
              {modal.type === "danger" && (
                <>
                  <button onClick={closeModal} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                  <button onClick={modal.onConfirm} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors">Delete</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
