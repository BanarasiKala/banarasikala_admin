import { useState, useEffect } from "react";
import { imgUrl } from "../../utils/cloudinary";
import compressImage from "../../utils/compressImage";
import { Plus, Pencil, Trash2, Search, Filter, ChevronLeft, ChevronRight, Package, AlertCircle, Star, Sparkles, CheckCircle, AlertTriangle, X } from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import ProductModal from "./ProductModal";
import "./Products.css";

const INITIAL_FORM_STATE = {
  name: "", sku: "", description: "", short_description: "",
  selling_price: "", mrp_price: "", cost_price: "", discount_percent: "",
  images: [], videos: [], cover_color_id: "", stock_quantity: 0, low_stock_threshold: 5,
  color_stocks: {},
  weight: "", length: "6.5", width: "1.1", height: "5",
  material_id: "", variety_id: "", occasion_ids: [],
  special_collection: false, is_new_arrival: false, status: "active",
  blouse_piece: true,
  payment_options: ["prepaid"],
  service_options: [],
  care_instructions: "",
  key_highlights: [],
};

export default function Products() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [colors, setColors] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [newColorImageFiles, setNewColorImageFiles] = useState({});
  const [newColorVideoFiles, setNewColorVideoFiles] = useState({});
  const [videoStatus, setVideoStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    material: "",
    variety: "",
    color: "",
    stockStatus: "",
    status: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableReady, setTableReady] = useState(false);
  const [summary, setSummary] = useState({ totalProducts: 0, outOfStock: 0, lowStock: 0, inStock: 0 });
  const [paginationMeta, setPaginationMeta] = useState({
    totalItems: 0,
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    currentPageCount: 0,
  });
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [modal, setModal] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
    onCancel: null,
  });
  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    setModal({ show: true, type, title, message, onConfirm, onCancel });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, show: false }));
    setTimeout(() => {
      setModal((prev) =>
        prev.show
          ? prev
          : {
              show: false,
              type: "info",
              title: "",
              message: "",
              onConfirm: null,
              onCancel: null,
            },
      );
    }, 200);
  };

  useEffect(() => {
    fetchLookupData();
    fetchProductSummary();
  }, []);

  const fetchLookupData = async () => {
    try {
      setLoading(true);
      const [colRes, matRes, varRes, occRes] = await Promise.all([
        fetch(API_ENDPOINTS.colors), fetch(API_ENDPOINTS.materials),
        fetch(API_ENDPOINTS.varieties), fetch(API_ENDPOINTS.occasions),
      ]);
      const [cols, mats, vars, occs] = await Promise.all([
        colRes.json(), matRes.json(), varRes.json(), occRes.json(),
      ]);
      setColors(Array.isArray(cols) ? cols : []);
      setMaterials(Array.isArray(mats) ? mats : []);
      setVarieties(Array.isArray(vars) ? vars : []);
      setOccasions(Array.isArray(occs) ? occs : []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const fetchProducts = async (page = currentPage, size = pageSize) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        paginated: "true",
        page: String(page),
        pageSize: String(size),
        search: searchTerm.trim(),
        material: filters.material || "",
        variety: filters.variety || "",
        color: filters.color || "",
        stockStatus: filters.stockStatus || "",
        status: filters.status || "",
      });
      const res = await fetch(`${API_ENDPOINTS.products}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load products");

      setProducts(Array.isArray(data.items) ? data.items : []);
      setPaginationMeta(data.meta || {
        totalItems: 0, currentPage: 1, totalPages: 1, pageSize: size, currentPageCount: 0,
      });
      setTableReady(true);
    } catch (error) {
      console.error("Product fetch failed:", error);
      setProducts([]);
      setTableReady(false);
      showModal("error", "Load failed", "Unable to load products with selected filters.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProductSummary = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_ENDPOINTS.products}/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setSummary({
        totalProducts: data.totalProducts ?? 0,
        outOfStock: data.outOfStock ?? 0,
        lowStock: data.lowStock ?? 0,
        inStock: data.inStock ?? 0,
      });
    } catch (error) {
      console.error("Product summary fetch failed:", error);
      setSummary({ totalProducts: 0, outOfStock: 0, lowStock: 0, inStock: 0 });
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        ...INITIAL_FORM_STATE,
        ...product,
        selling_price: product.selling_price?.toString() || product.price?.toString() || "",
        mrp_price: product.mrp_price?.toString() || product.old_price?.toString() || "",
        color_stocks: product.color_stocks && typeof product.color_stocks === "object" ? product.color_stocks : {},
        images: Array.isArray(product.images) ? product.images : [],
        videos: Array.isArray(product.videos) ? product.videos : [],
        cover_color_id: product.images?.find((img) => img.is_cover)?.color_id || "",
        occasion_ids: Array.isArray(product.occasion_ids) ? product.occasion_ids.map(Number).filter(Boolean) : [],
        key_highlights: Array.isArray(product.key_highlights) ? product.key_highlights.map(String) : [],
      });
    } else { setEditingProduct(null); setFormData(INITIAL_FORM_STATE); }
    setNewColorImageFiles({});
    setNewColorVideoFiles({});
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      // Special Collection and New Arrival are mutually exclusive: enabling one
      // turns the other off. A product can still be neither.
      if (type === "checkbox" && checked && (name === "special_collection" || name === "is_new_arrival")) {
        const other = name === "special_collection" ? "is_new_arrival" : "special_collection";
        return { ...prev, [name]: true, [other]: false };
      }
      return { ...prev, [name]: type === "checkbox" ? checked : value };
    });
  };

  const handleOccasionToggle = (id) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.occasion_ids) ? prev.occasion_ids : [];
      return {
        ...prev,
        occasion_ids: current.includes(id)
          ? current.filter((oid) => oid !== id)
          : [...current, id],
      };
    });
  };

  const handleColorStockChange = (colorId, value) => {
    if (value !== "" && !/^\d+$/.test(value)) return;

    setFormData((prev) => {
      const nextColorStocks = { ...(prev.color_stocks || {}) };

      if (value === "") {
        delete nextColorStocks[colorId];
      } else {
        nextColorStocks[colorId] = parseInt(value, 10) || 0;
      }

      const totalStock = Object.values(nextColorStocks).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);

      return {
        ...prev,
        color_stocks: nextColorStocks,
        stock_quantity: totalStock,
      };
    });
  };

  const handleColorImageUpload = (colorId, files) => {
    const incomingFiles = Array.from(files || []);
    if (incomingFiles.length === 0) return;

    setNewColorImageFiles((prev) => {
      const existingNewFiles = prev[colorId] || [];
      const existingSavedImages = (formData.images || []).filter(img => img.color_id === parseInt(colorId, 10));
      
      const existingSignatures = new Set(
        existingNewFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const uniqueIncomingFiles = [];
      let duplicateCount = 0;

      incomingFiles.forEach((file) => {
        const signature = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingSignatures.has(signature)) {
          existingSignatures.add(signature);
          uniqueIncomingFiles.push(file);
        } else {
          duplicateCount += 1;
        }
      });

      const availableSlots = Math.max(0, 6 - existingSavedImages.length - existingNewFiles.length);
      const acceptedFiles = uniqueIncomingFiles.slice(0, availableSlots);
      const overflowCount = uniqueIncomingFiles.length - acceptedFiles.length;

      if (duplicateCount > 0 || overflowCount > 0) {
        const messages = [];
        if (duplicateCount > 0) messages.push(`${duplicateCount} duplicate image(s) skipped.`);
        if (overflowCount > 0) messages.push(`${overflowCount} image(s) skipped because max 6 allowed per color.`);
        showModal("warning", "Some files were skipped", messages.join(" "));
      }

      return {
        ...prev,
        [colorId]: [...existingNewFiles, ...acceptedFiles],
      };
    });
  };

  const handleRemoveSavedColorImage = (colorId, imageUrl) => {
    setFormData((prev) => {
      const updatedImages = (prev.images || []).filter((img) => img.url !== imageUrl);
      
      const wasCover = (prev.images || []).find(img => img.url === imageUrl)?.is_cover;

      return {
        ...prev,
        images: updatedImages,
        cover_color_id: wasCover ? updatedImages[0]?.color_id || "" : prev.cover_color_id,
      };
    });
  };

  const handleMultiSelectChange = (fieldName, optionValue) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
      const next = current.includes(optionValue)
        ? current.filter((item) => item !== optionValue)
        : [...current, optionValue];

      return { ...prev, [fieldName]: next };
    });
  };

  const handleRemoveNewColorImage = (colorId, index) => {
    setNewColorImageFiles((prev) => {
      const next = { ...prev };
      const current = Array.isArray(next[colorId]) ? next[colorId] : [];
      const updated = current.filter((_, i) => i !== index);
      if (updated.length > 0) next[colorId] = updated;
      else delete next[colorId];
      return next;
    });
  };

  const handleCoverImageSelect = ({ colorId }) => {
    setFormData((prev) => ({
      ...prev,
      cover_color_id: parseInt(colorId, 10) || "",
    }));
  };

  const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // Cloudinary 100 MB limit

  const handleColorVideoUpload = (colorId, files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const oversized = incoming.filter((f) => f.size > VIDEO_MAX_BYTES);
    if (oversized.length) {
      showModal(
        "warning",
        "Video too large",
        `${oversized.map((f) => f.name).join(", ")} exceed${oversized.length === 1 ? "s" : ""} the 100 MB limit. Please compress the video before uploading.`
      );
      return;
    }

    setNewColorVideoFiles((prev) => {
      const existingNew = prev[colorId] || [];
      const existingSaved = (formData.videos || []).filter((v) => v.color_id === parseInt(colorId, 10));
      const slots = Math.max(0, 3 - existingSaved.length - existingNew.length);
      const accepted = incoming.slice(0, slots);
      if (accepted.length < incoming.length) {
        showModal("warning", "Video limit reached", "Maximum 3 videos per color.");
      }
      return { ...prev, [colorId]: [...existingNew, ...accepted] };
    });
  };

  const handleRemoveNewColorVideo = (colorId, index) => {
    setNewColorVideoFiles((prev) => {
      const next = { ...prev };
      const updated = (next[colorId] || []).filter((_, i) => i !== index);
      if (updated.length > 0) next[colorId] = updated;
      else delete next[colorId];
      return next;
    });
  };

  const handleRemoveSavedColorVideo = (colorId, url) => {
    setFormData((prev) => ({
      ...prev,
      videos: (prev.videos || []).filter((v) => !(parseInt(v.color_id, 10) === colorId && v.url === url)),
    }));
  };

  // Reorder the items of a single color within a flat media array, leaving items of
  // other colors untouched. Order within a color is what the storefront uses
  // (display_order is derived from array position at save time).
  const reorderColorGroup = (list, colorId, from, to) => {
    const group = (list || []).filter((item) => parseInt(item.color_id, 10) === colorId);
    const rest = (list || []).filter((item) => parseInt(item.color_id, 10) !== colorId);
    if (from < 0 || to < 0 || from >= group.length || to >= group.length || from === to) return list;
    const [moved] = group.splice(from, 1);
    group.splice(to, 0, moved);
    return [...rest, ...group];
  };

  const reorderNewFiles = (map, colorId, from, to) => {
    const key = String(colorId);
    const arr = [...(map[key] || [])];
    if (from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return map;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return { ...map, [key]: arr };
  };

  const handleReorderSavedImage = (colorId, from, to) => {
    setFormData((prev) => ({ ...prev, images: reorderColorGroup(prev.images, colorId, from, to) }));
  };

  const handleReorderNewImage = (colorId, from, to) => {
    setNewColorImageFiles((prev) => reorderNewFiles(prev, colorId, from, to));
  };

  const handleReorderSavedVideo = (colorId, from, to) => {
    setFormData((prev) => ({ ...prev, videos: reorderColorGroup(prev.videos, colorId, from, to) }));
  };

  const handleReorderNewVideo = (colorId, from, to) => {
    setNewColorVideoFiles((prev) => reorderNewFiles(prev, colorId, from, to));
  };

  const handleKeyHighlightChange = (index, value) => {
    setFormData((prev) => {
      const next = [...(prev.key_highlights || [])];
      next[index] = value;
      return { ...prev, key_highlights: next };
    });
  };

  const handleAddKeyHighlight = () => {
    setFormData((prev) => ({
      ...prev,
      key_highlights: [...(prev.key_highlights || []), ""],
    }));
  };

  const handleRemoveKeyHighlight = (index) => {
    setFormData((prev) => ({
      ...prev,
      key_highlights: (prev.key_highlights || []).filter((_, i) => i !== index),
    }));
  };

  const handleCreateColor = async (name, hexCode, description) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const token = localStorage.getItem("accessToken");
    const res = await fetch(API_ENDPOINTS.colors, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, hex_code: hexCode, slug, description: description || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create color");
    setColors((prev) => [...prev, data]);
    return data;
  };

  const getUploadSignature = async (resourceType) => {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(
      `${API_ENDPOINTS.products}/upload-signature?resourceType=${resourceType}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Failed to get upload signature");
    return res.json();
  };

  const uploadToCloudinary = async (file, sigData) => {
    const form = new FormData();
    const uploadFile = sigData.resourceType === "image"
      ? await compressImage(file, 2000, 0.85)
      : file;
    form.append("file", uploadFile);
    form.append("api_key", sigData.apiKey);
    form.append("timestamp", String(sigData.timestamp));
    form.append("signature", sigData.signature);
    form.append("folder", sigData.folder);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${sigData.resourceType}/upload`,
      { method: "POST", body: form }
    );
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Cloudinary returned a non-JSON response (status ${res.status})`);
    }
    if (!res.ok || data.error) {
      const msg = data?.error?.message || `Cloudinary error (status ${res.status})`;
      console.error("[Cloudinary upload error]", data);
      throw new Error(msg);
    }
    return data.secure_url;
  };

  const getS3VideoUploadUrl = async (fileName, contentType) => {
    const token = localStorage.getItem("accessToken");
    const params = new URLSearchParams({ fileName, contentType });
    const res = await fetch(
      `${API_ENDPOINTS.products}/s3-video-url?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Failed to get S3 upload URL");
    return res.json(); // { uploadUrl, publicUrl }
  };

  const uploadVideoToS3 = async (file, onUploadStart) => {
    const { uploadUrl, publicUrl } = await getS3VideoUploadUrl(
      file.name,
      file.type || "video/mp4"
    );

    if (onUploadStart) onUploadStart();

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "video/mp4" },
      body: file,
    });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);

    return publicUrl;
  };

  const calculateDiscount = () => {
    const price = parseFloat(formData.selling_price);
    const old = parseFloat(formData.mrp_price);
    
    if (old > price) {
      setFormData(prev => ({
        ...prev,
        discount_percent: Math.round(((old - price) / old) * 100),
      }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const selectedColorIds = Object.entries(formData.color_stocks || {})
      .filter(([, qty]) => parseInt(qty, 10) > 0)
      .map(([colorId]) => parseInt(colorId, 10));

    const missingImagesForColors = selectedColorIds.filter((colorId) => {
      const existingCount = (formData.images || []).filter(img => img.color_id === colorId).length;
      const newCount = (newColorImageFiles?.[colorId] || []).length;
      return existingCount + newCount < 1;
    });

    if (missingImagesForColors.length > 0) {
      showModal("warning", "Missing images", "Each selected color must have at least 1 image.");
      setSubmitting(false);
      return;
    }

    if (!Array.isArray(formData.payment_options) || formData.payment_options.length === 0) {
      showModal("warning", "Payment option required", "Choose at least one payment option: Prepaid or COD.");
      setSubmitting(false);
      return;
    }

    if (!Array.isArray(formData.service_options) || formData.service_options.length === 0) {
      showModal("warning", "Return / exchange option required", "Choose at least one product service option: Return or Exchange.");
      setSubmitting(false);
      return;
    }

    const coverColorId = formData.cover_color_id || selectedColorIds[0];

    try {
      // Existing saved images
      const allImages = (formData.images || []).map((img, index) => ({
        color_id: parseInt(img.color_id, 10),
        url: img.url || img.image_url,
        display_order: index,
        is_cover: String(img.color_id) === String(coverColorId),
      }));

      // Upload new images directly to Cloudinary (browser → Cloudinary, EC2 not involved)
      const hasNewImages = Object.values(newColorImageFiles).some((files) => files.length > 0);
      if (hasNewImages) {
        const imgSig = await getUploadSignature("image");
        const imageUploadTasks = [];
        for (const [colorId, files] of Object.entries(newColorImageFiles)) {
          for (const file of files) {
            imageUploadTasks.push(
              uploadToCloudinary(file, imgSig).then((url) => ({ color_id: parseInt(colorId, 10), url }))
            );
          }
        }
        const uploadedImages = await Promise.all(imageUploadTasks);
        allImages.push(...uploadedImages);
      }

      // Existing saved videos
      const allVideos = [...(formData.videos || [])];

      // Upload new videos directly to S3
      const allNewVideos = Object.entries(newColorVideoFiles).flatMap(([colorId, files]) =>
        files.map((file) => ({ colorId: parseInt(colorId, 10), file }))
      );
      if (allNewVideos.length > 0) {
        for (let i = 0; i < allNewVideos.length; i++) {
          const { colorId, file } = allNewVideos[i];
          setVideoStatus(`Uploading video ${i + 1} of ${allNewVideos.length}…`);
          const url = await uploadVideoToS3(file);
          allVideos.push({ color_id: colorId, url });
        }
        setVideoStatus("");
      }

      const payloadData = {
        ...formData,
        slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        selling_price: parseFloat(formData.selling_price) || 0,
        mrp_price: formData.mrp_price ? parseFloat(formData.mrp_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 0,
        color_stocks: formData.color_stocks || {},
        images: allImages,
        videos: allVideos,
        cover_color_id: coverColorId,
        material_id: formData.material_id || null,
        variety_id: formData.variety_id || null,
        occasion_ids: Array.isArray(formData.occasion_ids) ? formData.occasion_ids.map(Number).filter(Boolean) : [],
        special_collection: Boolean(formData.special_collection),
        payment_options: formData.payment_options || [],
        service_options: formData.service_options || [],
        care_instructions: formData.care_instructions || "",
        key_highlights: Array.isArray(formData.key_highlights)
          ? formData.key_highlights.map((h) => String(h || "").trim()).filter(Boolean)
          : [],
      };

      const token = localStorage.getItem("accessToken");
      const url = editingProduct
        ? `${API_ENDPOINTS.products}/${editingProduct.id}/with-images`
        : `${API_ENDPOINTS.products}/with-images`;
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadData),
      });

      if (res.ok) {
        if (tableReady) {
          await fetchProducts(1, pageSize);
          setCurrentPage(1);
        }
        setIsModalOpen(false);
        showModal("success", "Success", editingProduct ? "Product updated successfully." : "Product created successfully.");
      } else {
        const err = await res.json();
        console.error("Product save failed:", err);
        showModal("error", "Save failed", err.message || "Unable to save product right now. Please check inputs and try again.");
      }
    } catch (err) {
      console.error("Product save error:", err);
      showModal("error", "Upload failed", err.message || "File upload failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
      setVideoStatus("");
    }
  };

  const handleDelete = async (id) => {
    showModal(
      "danger",
      "Delete product?",
      "Are you sure you want to delete this product? This action cannot be undone.",
      async () => {
        closeModal();
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API_ENDPOINTS.products}/${id}`, { 
            method: "DELETE",
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            if (tableReady) await fetchProducts(currentPage, pageSize);
            showModal("success", "Deleted", "Product deleted successfully.");
          } else {
            const err = await res.json();
            showModal("error", "Delete failed", err.message || "Unable to delete product.");
          }
        } catch (err) {
          console.error(err);
          showModal("error", "Network error", "Unable to delete product right now.");
        }
      },
      closeModal,
    );
  };

  const getModalIcon = (type) => {
    if (type === "success") return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (type === "error") return <AlertCircle className="w-6 h-6 text-red-500" />;
    if (type === "danger") return <AlertTriangle className="w-6 h-6 text-red-600" />;
    return <AlertTriangle className="w-6 h-6 text-amber-500" />;
  };

  const getStockBadge = (p) => {
    if (p.stock_quantity <= 0) return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">OUT OF STOCK</span>;
    if (p.stock_quantity <= (p.low_stock_threshold || 5)) return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" />LOW ({p.stock_quantity})</span>;
    return <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">IN STOCK ({p.stock_quantity})</span>;
  };

  const applyFilters = async () => {
    setCurrentPage(1);
    await fetchProducts(1, pageSize);
  };

  const handlePageChange = async (nextPage) => {
    setCurrentPage(nextPage);
    await fetchProducts(nextPage, pageSize);
  };

  const handlePageSizeChange = async (nextSize) => {
    const parsed = parseInt(nextSize, 10) || 10;
    setPageSize(parsed);
    setCurrentPage(1);
    await fetchProducts(1, parsed);
  };

  const updateAvailability = async (product, nextStatus) => {
    try {
      const payload = {
        ...product,
        status: nextStatus,
        // Avoid sending nested include objects (Color/Occasion etc.) to backend.
        Color: undefined,
        Material: undefined,
        Variety: undefined,
        Occasion: undefined,
      };

      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_ENDPOINTS.products}/${product.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message || "Failed");
      }
      await fetchProducts(currentPage, pageSize);
    } catch (error) {
      console.error("Availability update failed:", error);
      showModal("error", "Update failed", "Could not update active status.");
    }
  };

  const requestAvailabilityChange = (product) => {
    const nextStatus = product.status === "active" ? "inactive" : "active";
    const title = "Confirm";
    const message = nextStatus === "active"
      ? "Are you sure you want to set this product as Active?"
      : "Are you sure you want to set this product as Inactive?";

    showModal("warning", title, message, async () => {
      closeModal();
      await updateAvailability(product, nextStatus);
    }, closeModal);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[#800020]">Products</h1><p className="text-sm text-gray-500 mt-1">Manage Banarasi saree collection</p></div>
        <button onClick={() => openModal()} className="px-6 py-2.5 bg-[#800020] text-white text-sm font-bold rounded-lg uppercase tracking-wider flex items-center gap-2 hover:bg-[#6b001a] transition-colors shadow-lg">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-[#800020]/10 rounded-lg"><Package className="w-5 h-5 text-[#800020]" /></div><div><p className="text-[10px] text-gray-500 uppercase font-bold">Total Products</p><p className="text-xl font-bold text-[#4A3F35]">{summary.totalProducts}</p></div></div></div>
        <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-lg"><Sparkles className="w-5 h-5 text-green-600" /></div><div><p className="text-[10px] text-gray-500 uppercase font-bold">In Stock</p><p className="text-xl font-bold text-[#4A3F35]">{summary.inStock}</p></div></div></div>
        <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-amber-50 rounded-lg"><Star className="w-5 h-5 text-amber-600" /></div><div><p className="text-[10px] text-gray-500 uppercase font-bold">Low Stock</p><p className="text-xl font-bold text-[#4A3F35]">{summary.lowStock}</p></div></div></div>
        <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div><div><p className="text-[10px] text-gray-500 uppercase font-bold">Out Of Stock</p><p className="text-xl font-bold text-[#4A3F35]">{summary.outOfStock}</p></div></div></div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#D4AF37]/20 shadow-sm space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#800020]" /></div>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showFilters ? "bg-[#800020] text-white border-[#800020]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}><Filter className="w-4 h-4" /> Filters</button>
          <button onClick={applyFilters} className="px-4 py-2 rounded-lg bg-[#800020] text-white text-sm font-semibold">Apply</button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-gray-100">
            <select value={filters.material} onChange={(e) => setFilters({ ...filters, material: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><option value="">All Materials</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <select value={filters.variety} onChange={(e) => setFilters({ ...filters, variety: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><option value="">All Varieties</option>{varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
            <select value={filters.color} onChange={(e) => setFilters({ ...filters, color: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><option value="">All Colors</option>{colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={filters.stockStatus} onChange={(e) => setFilters({ ...filters, stockStatus: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><option value="">Stock Status</option><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="out_of_stock">Out</option></select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"><option value="">Active / Inactive</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#D4AF37]/20 shadow-sm overflow-hidden">
        {!tableReady && !loading ? (
          <div className="p-10 text-center text-gray-500 text-sm">Apply filters to load product table.</div>
        ) : (
        loading ? (
          <div className="p-12 text-center"><div className="w-12 h-12 border-4 border-[#D4AF37]/20 border-t-[#800020] rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-500">Loading...</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#FAF8F6]"><tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {products.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-12 text-center"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No products found</p></td></tr>
                  ) : products.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-semibold">{(paginationMeta.currentPage - 1) * paginationMeta.pageSize + idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setImagePreviewUrl(p.images?.find(img => img.is_cover)?.url || p.images?.[0]?.url)}>
                            <img src={imgUrl(p.images?.find(img => img.is_cover)?.url || p.images?.[0]?.url)} alt={p.name} className="w-12 h-12 object-cover rounded-lg" />
                          </button>
                          <div>
                            <p className="font-medium text-[#4A3F35] text-sm">{p.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">SKU: {p.sku}</p>
                            <div className="flex gap-1 mt-1">
                              {p.is_new_arrival && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded">NEW</span>}
                              {p.special_collection && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">SPECIAL COLLECTION</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-bold text-[#800020]">₹{parseFloat(p.selling_price).toLocaleString()}</span>{p.mrp_price && <span className="text-xs text-gray-400 line-through block">₹{parseFloat(p.mrp_price).toLocaleString()}</span>}</td>
                      <td className="px-4 py-3">{getStockBadge(p)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => requestAvailabilityChange(p)}
                          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            p.status === "active" ? "bg-green-100" : "bg-gray-100"
                          }`}
                          title={p.status === "active" ? "Active (click to deactivate)" : "Inactive (click to activate)"}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                              p.status === "active" ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openModal(p)} className="p-1.5 text-gray-400 hover:text-[#D4AF37] hover:bg-amber-50 rounded"><Pencil className="w-4 h-4" /></button><button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Total {paginationMeta.totalItems} | Page {paginationMeta.currentPage}/{paginationMeta.totalPages} | Current page rows {paginationMeta.currentPageCount}</p>
              <div className="flex gap-2 items-center">
                <select value={pageSize} onChange={(e) => handlePageSizeChange(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 border border-gray-200 rounded-lg disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => handlePageChange(Math.min(paginationMeta.totalPages, currentPage + 1))} disabled={currentPage === paginationMeta.totalPages} className="p-2 border border-gray-200 rounded-lg disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )
        )}
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formData={formData}
        onInputChange={handleInputChange}
        onOccasionToggle={handleOccasionToggle}
        onMultiSelectChange={handleMultiSelectChange}
        onColorStockChange={handleColorStockChange}
        onColorImageUpload={handleColorImageUpload}
        onRemoveSavedColorImage={handleRemoveSavedColorImage}
        onRemoveNewColorImage={handleRemoveNewColorImage}
        onCoverImageSelect={handleCoverImageSelect}
        newColorImageFiles={newColorImageFiles}
        newColorVideoFiles={newColorVideoFiles}
        onColorVideoUpload={handleColorVideoUpload}
        onRemoveNewColorVideo={handleRemoveNewColorVideo}
        onRemoveSavedColorVideo={handleRemoveSavedColorVideo}
        onReorderSavedImage={handleReorderSavedImage}
        onReorderNewImage={handleReorderNewImage}
        onReorderSavedVideo={handleReorderSavedVideo}
        onReorderNewVideo={handleReorderNewVideo}
        onSave={handleSave}
        onCalculateDiscount={calculateDiscount}
        onCreateColor={handleCreateColor}
        onKeyHighlightChange={handleKeyHighlightChange}
        onAddKeyHighlight={handleAddKeyHighlight}
        onRemoveKeyHighlight={handleRemoveKeyHighlight}
        submitting={submitting}
        videoStatus={videoStatus}
        editingProduct={editingProduct}
        materials={materials}
        varieties={varieties}
        colors={colors}
        occasions={occasions}
      />

      {modal.show && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal}></div>
          <div className="relative z-10 bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getModalIcon(modal.type)}
                <h3 className="text-base font-bold text-gray-800">{modal.title}</h3>
              </div>
              <button type="button" onClick={closeModal} className="p-1 rounded text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 whitespace-pre-line">{modal.message}</p>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              {modal.onCancel && (
                <button type="button" onClick={modal.onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600">
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={modal.onConfirm || closeModal}
                className={`px-4 py-2 rounded-lg text-white ${
                  modal.type === "danger" ? "bg-red-600" : "bg-[#800020]"
                }`}
              >
                {modal.onConfirm ? "Confirm" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {imagePreviewUrl && (
        <div className="fixed inset-0 z-[140] bg-black/80 flex items-center justify-center p-4" onClick={() => setImagePreviewUrl("")}>
          <div className="bg-white rounded-xl p-3 max-w-5xl w-full max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <img src={imgUrl(imagePreviewUrl)} alt="Preview" className="w-full h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
