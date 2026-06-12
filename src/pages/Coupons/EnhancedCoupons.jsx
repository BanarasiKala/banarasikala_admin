import { useState, useEffect } from "react";
import { 
  Plus, Pencil, Trash2, Tag, Percent,
  IndianRupee, CheckCircle2,
  Info, ChevronRight, Settings, Target,
  ExternalLink, Search, AlertTriangle, AlertCircle
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";

const INITIAL_FORM = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_percent: "",
  discount_amount: "",
  min_purchase_amount: "0",
  max_discount_amount: "",
  usage_limit: "",
  usage_limit_per_user: "1",
  applicable_product_id: [],
  applicable_variety_id: [],
  applicable_color_id: [],
  applicable_material_id: [],
  applicable_occasion_id: [],
  min_delivery_km: "",
  valid_from: "",
  valid_until: "",
  is_active: true,
  display_on_homepage: false,
  banner_text: "",
};

export default function EnhancedCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [colors, setColors] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingCoupon, setViewingCoupon] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(1); // 1, 2, 3
  const [mappingType, setMappingType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, inactive

  // Single modal system for all messages (success/error/confirm)
  const [modal, setModal] = useState({
    show: false,
    type: "info", // 'success' | 'error' | 'confirm' | 'warning' | 'danger'
    title: "",
    message: "",
    onConfirm: null,
    onCancel: null,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const endpoints = [
        API_ENDPOINTS.coupons,
        API_ENDPOINTS.products,
        API_ENDPOINTS.varieties,
        API_ENDPOINTS.colors,
        API_ENDPOINTS.occasions,
        API_ENDPOINTS.materials
      ];
      
      const token = localStorage.getItem("accessToken");
      const responses = await Promise.all(endpoints.map(url => fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })));
      const data = await Promise.all(responses.map(res => res.json()));
      
      setCoupons(Array.isArray(data[0]) ? data[0] : []);
      setProducts(Array.isArray(data[1]) ? data[1] : data[1]?.items || data[1]?.rows || []);
      setVarieties(Array.isArray(data[2]) ? data[2] : []);
      setColors(Array.isArray(data[3]) ? data[3] : []);
      setOccasions(Array.isArray(data[4]) ? data[4] : []);
      setMaterials(Array.isArray(data[5]) ? data[5] : []);
    } catch {
      showModal("error", "Error", "Failed to load data from server");
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type, title, message, onConfirm = null, onCancel = null) => {
    setModal({ show: true, type, title, message, onConfirm, onCancel });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, show: false }));
  };

  const openModal = (coupon = null) => {
    setCurrentStep(1);
    if (coupon) {
      setEditingCoupon(coupon);
      let mType = "all";
      if (coupon.applicable_product_id?.length > 0) mType = "product";
      else if (coupon.applicable_variety_id?.length > 0) mType = "variety";
      else if (coupon.applicable_color_id?.length > 0) mType = "color";
      else if (coupon.applicable_material_id?.length > 0) mType = "material";
      else if (coupon.applicable_occasion_id?.length > 0) mType = "occasion";
      setMappingType(mType);

      setFormData({
        ...INITIAL_FORM, 
        ...coupon,
        valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString().split('T')[0] : "",
        valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString().split('T')[0] : "",
        applicable_product_id: coupon.applicable_product_id || [],
        applicable_variety_id: coupon.applicable_variety_id || [],
        applicable_color_id: coupon.applicable_color_id || [],
        applicable_material_id: coupon.applicable_material_id || [],
        applicable_occasion_id: coupon.applicable_occasion_id || [],
        min_delivery_km: coupon.min_delivery_km || "",
      });
    } else { 
      setEditingCoupon(null); 
      setFormData(INITIAL_FORM);
      setMappingType("all");
    }
    setIsModalOpen(true);
  };

  const validateStep = () => {
    if (currentStep === 1) {
      if (!formData.code) { showModal("warning", "Missing Information", "Please enter a Coupon Code"); return false; }
      const val = formData.discount_type === "percentage" ? formData.discount_percent : formData.discount_amount;
      if (!val || val <= 0) { showModal("warning", "Invalid Value", "Please enter a valid Discount Value"); return false; }
      return true;
    }
    if (currentStep === 2) {
      if (mappingType === "product") {
        if (formData.applicable_product_id.length === 0) {
          showModal("warning", "Target Required", "Please select at least one Product");
          return false;
        }
      }
      if (mappingType === "variety" && (!formData.applicable_variety_id || formData.applicable_variety_id.length === 0)) { showModal("warning", "Target Required", "Please select at least one Variety"); return false; }
      if (mappingType === "color" && (!formData.applicable_color_id || formData.applicable_color_id.length === 0)) { showModal("warning", "Target Required", "Please select at least one Color"); return false; }
      if (mappingType === "material" && (!formData.applicable_material_id || formData.applicable_material_id.length === 0)) { showModal("warning", "Target Required", "Please select at least one Material"); return false; }
      if (mappingType === "occasion" && (!formData.applicable_occasion_id || formData.applicable_occasion_id.length === 0)) { showModal("warning", "Target Required", "Please select at least one Occasion"); return false; }
      return true;
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) setCurrentStep(prev => prev + 1); };
  const prevStep = () => setCurrentStep(prev => prev - 1);

  const openViewModal = (coupon) => { setViewingCoupon(coupon); setIsViewModalOpen(true); };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep()) return;

    let finalProductIds = formData.applicable_product_id;
    if (mappingType === "product" && finalProductIds.length === 0) {
      // If no specific products ticked, use all filtered products
      finalProductIds = availableProducts.map(p => p.id);
    }

    const payload = {
      ...formData,
      discount_percent: formData.discount_type === "percentage" ? parseInt(formData.discount_percent) || null : null,
      discount_amount: formData.discount_type === "fixed_amount" ? parseFloat(formData.discount_amount) || null : null,
      min_purchase_amount: parseFloat(formData.min_purchase_amount) || 0,
      max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
      usage_limit_per_user: parseInt(formData.usage_limit_per_user) || 1,
      min_delivery_km: formData.min_delivery_km ? parseInt(formData.min_delivery_km) : null,
      applicable_product_id: mappingType === "product" ? finalProductIds : [],
      applicable_variety_id: mappingType === "variety" ? formData.applicable_variety_id : [],
      applicable_color_id: mappingType === "color" ? formData.applicable_color_id : [],
      applicable_material_id: mappingType === "material" ? formData.applicable_material_id : [],
      applicable_occasion_id: mappingType === "occasion" ? formData.applicable_occasion_id : [],
    };

    try {
      const url = editingCoupon ? `${API_ENDPOINTS.coupons}/${editingCoupon.id}` : API_ENDPOINTS.coupons;
      const method = editingCoupon ? "PUT" : "POST";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(url, { 
        method, 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }, 
        body: JSON.stringify(payload) 
      });
      if (res.ok) { 
        await fetchData(); 
        setIsModalOpen(false); 
        showModal("success", "Success", editingCoupon ? "Coupon updated successfully!" : "Coupon created successfully!");
      } else {
        const err = await res.json();
        showModal("error", "Error", err.message || "Failed to save coupon");
      }
    } catch {
      showModal("error", "Error", "Network error. Please try again.");
    }
  };

  const isExpired = (coupon) => coupon.valid_until && new Date(coupon.valid_until) < new Date();

  const handleToggleConfirm = (coupon) => {
    const action = coupon.is_active ? "inactive" : "active";
    showModal(
      "confirm",
      "Confirm Action",
      `Are you sure you want to make coupon "${coupon.code}" ${action}?`,
      async () => {
        closeModal();
        if (action === "active" && isExpired(coupon)) {
          showModal("error", "Expired", "Cannot activate: This coupon has already expired!");
          return;
        }
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API_ENDPOINTS.coupons}/${coupon.id}`, {
            method: "PUT", 
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: action === "active" }),
          });
          if (res.ok) {
            await fetchData();
            showModal("success", "Status Updated", `Coupon is now ${action}.`);
          }
        } catch {
          showModal("error", "Error", "Failed to update status");
        }
      }
    );
  };

  const deleteCoupon = async (id) => {
    const coupon = coupons.find(c => c.id === id);
    showModal(
      "danger",
      "Delete Coupon?",
      `Are you sure you want to delete "${coupon?.code}"?\nThis action cannot be undone.`,
      async () => {
        closeModal();
        try {
          const token = localStorage.getItem("accessToken");
          const res = await fetch(`${API_ENDPOINTS.coupons}/${id}`, { 
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (res.ok) {
            await fetchData();
            showModal("success", "Deleted", "Coupon removed successfully.");
          }
        } catch {
          showModal("error", "Error", "Failed to delete coupon");
        }
      }
    );
  };

  const filteredCoupons = coupons.filter(c => {
    // Search Filter
    const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    // Status Filter
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;

    return true;
  });

  const generateCode = () => {
    const prefixes = ["VNS", "SAREE", "BNS"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 899);
    setFormData(prev => ({ ...prev, code: `${prefix}${num}` }));
  };

  const formatDateWords = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const toggleSelection = (id, field) => {
    const current = formData[field] || [];
    const updated = current.includes(id) 
      ? current.filter(item => item !== id) 
      : [...current, id];
    setFormData({ ...formData, [field]: updated });
  };

  // Product targeting filters
  const [selectedVars, setSelectedVars] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedMats, setSelectedMats] = useState([]);

  // Filtered lists based on selections
  const availableProducts = products.filter(p => {
    if (selectedVars.length > 0 && !selectedVars.includes(p.variety_id)) return false;
    if (
      selectedColors.length > 0 &&
      !selectedColors.some((colorId) => Number(p.color_stocks?.[String(colorId)] || 0) > 0)
    ) return false;
    if (selectedMats.length > 0 && !selectedMats.includes(p.material_id)) return false;
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case "error": return <AlertCircle className="w-6 h-6 text-red-500" />;
      case "danger": return <AlertTriangle className="w-6 h-6 text-red-600" />;
      default: return <Info className="w-6 h-6 text-[#800020]" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-[#4A3F35] flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#800020]" />
            Coupon Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Configure and manage shop-wide discount coupons.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800020]/10 focus:border-[#800020] outline-none text-sm w-full md:w-64"
            />
          </div>

          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium outline-none bg-white focus:border-[#800020]"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button 
            onClick={() => openModal()} 
            className="px-6 py-2.5 bg-[#800020] text-white font-bold rounded-xl flex items-center gap-2 hover:bg-[#6b001a] transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5" /> Create Coupon
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#800020]/20 border-t-[#800020] rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium italic">Fetching latest coupons from server...</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <Tag className="w-16 h-16 text-gray-100" />
            <div>
              <h3 className="text-lg font-bold text-gray-700">No coupons found</h3>
              <p className="text-gray-500">Create your first offer to see it listed here.</p>
            </div>
            <button onClick={() => openModal()} className="mt-2 text-[#800020] font-bold hover:underline">Create a coupon now</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Coupon Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Discount Value</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Expiry Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredCoupons.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#800020]/5 px-3 py-1.5 rounded-lg border border-[#800020]/10">
                          <span className="font-mono font-bold text-[#800020] text-base">{c.code}</span>
                        </div>
                        <span className="text-gray-600 font-medium">{c.description || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleToggleConfirm(c)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${c.is_active ? 'bg-green-600' : 'bg-gray-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${c.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <span className={`block text-[10px] font-bold mt-1 uppercase ${c.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">
                        {c.discount_type === "percentage" ? `${c.discount_percent}% OFF` : `₹${c.discount_amount} OFF`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      {formatDateWords(c.valid_until)}
                      {isExpired(c) && <span className="ml-2 text-red-500 text-[10px] font-bold uppercase">(Expired)</span>}
                      {c.display_on_homepage && <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Home</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openViewModal(c)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details"><ExternalLink className="w-4 h-4" /></button>
                        <button onClick={() => openModal(c)} className="p-2 text-gray-400 hover:text-[#800020] hover:bg-[#800020]/5 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UNIFIED MODAL SYSTEM (SWAL Style) */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3F35]/80 backdrop-blur-sm" onClick={() => (modal.type === "success" || modal.type === "error") && closeModal()}></div>
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-200">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
              modal.type === 'success' ? 'bg-green-50' : 
              modal.type === 'error' ? 'bg-red-50' : 
              modal.type === 'danger' ? 'bg-red-50' : 'bg-[#800020]/5'
            }`}>
              {getIcon(modal.type)}
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{modal.title}</h3>
            <p className="text-gray-500 mt-2 whitespace-pre-line leading-relaxed">{modal.message}</p>
            
            <div className="flex gap-3 mt-8">
              {(modal.type === "confirm" || modal.type === "danger") ? (
                <>
                  <button onClick={modal.onCancel || closeModal} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200">Cancel</button>
                  <button onClick={modal.onConfirm} className={`flex-1 py-3 text-white font-bold rounded-2xl shadow-lg ${modal.type === 'danger' ? 'bg-red-600 shadow-red-100' : 'bg-[#800020] shadow-[#800020]/20'}`}>
                    {modal.type === 'danger' ? 'Delete' : 'Confirm'}
                  </button>
                </>
              ) : (
                <button onClick={closeModal} className={`w-full py-3 text-white font-bold rounded-2xl shadow-lg ${modal.type === 'success' ? 'bg-green-600 shadow-green-100' : 'bg-red-600 shadow-red-100'}`}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isViewModalOpen && viewingCoupon && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3F35]/70 backdrop-blur-md" onClick={() => setIsViewModalOpen(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#4A3F35]">Coupon Summary</h2>
              <div className="bg-[#800020]/10 text-[#800020] px-4 py-2 rounded-xl font-mono font-bold">{viewingCoupon.code}</div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Discount</p>
                  <p className="text-lg font-bold text-green-600">
                    {viewingCoupon.discount_type === "percentage" ? `${viewingCoupon.discount_percent}%` : `₹${viewingCoupon.discount_amount}`} Off
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Redemptions</p>
                  <p className="text-lg font-bold text-gray-700">{viewingCoupon.usage_count || 0} / {viewingCoupon.usage_limit || "Unlimited"}</p>
                </div>
              </div>

              <div className="p-4 bg-[#800020]/5 rounded-2xl space-y-2">
                <p className="text-[10px] text-[#800020]/50 uppercase font-bold">Applicability (Target Items)</p>
                <div className="text-sm font-medium text-gray-700">
                  {viewingCoupon.applicable_product_id?.length > 0 ? `${viewingCoupon.applicable_product_id.length} Specific Products Selected` :
                   viewingCoupon.applicable_variety_id?.length > 0 ? `${viewingCoupon.applicable_variety_id.length} Varieties Selected` :
                   viewingCoupon.applicable_color_id?.length > 0 ? `${viewingCoupon.applicable_color_id.length} Colors Selected` :
                   viewingCoupon.applicable_occasion_id?.length > 0 ? `${viewingCoupon.applicable_occasion_id.length} Occasions Selected` :
                   "Store-wide (All products)"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 mb-1">Start Date</p>
                  <p className="font-bold text-gray-700">{formatDateWords(viewingCoupon.valid_from)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Expiry Date</p>
                  <p className="font-bold text-gray-700">{formatDateWords(viewingCoupon.valid_until)}</p>
                </div>
              </div>
            </div>

            <button onClick={() => setIsViewModalOpen(false)} className="w-full mt-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200">Close View</button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#4A3F35]/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl relative z-10 max-h-[95vh] overflow-hidden flex flex-col">
            
            <div className="px-8 py-6 bg-gradient-to-r from-[#800020] to-[#a0152d] text-white">
              <h2 className="text-xl font-bold">{editingCoupon ? "Update Coupon Details" : "Create New Coupon"}</h2>
              <div className="flex items-center gap-4 mt-3">
                {[1, 2, 3].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === step ? 'bg-white text-[#800020]' : 'bg-white/20 text-white/60'}`}>{step}</div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${currentStep === step ? 'text-white' : 'text-white/40'}`}>
                      {step === 1 ? 'Offer Details' : step === 2 ? 'Select Targets' : 'Final Limits'}
                    </span>
                    {step < 3 && <div className="w-8 h-[1px] bg-white/20"></div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coupon Code *</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={formData.code} 
                          onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                          required 
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none" 
                          placeholder="e.g., WELCOME10"
                        />
                        <button type="button" onClick={generateCode} className="px-4 py-3 bg-[#800020]/5 text-[#800020] rounded-xl text-xs font-bold hover:bg-[#800020]/10 border border-[#800020]/10">Auto-Generate</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Public Offer Message</label>
                      <input 
                        type="text" 
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none" 
                        placeholder="e.g., Festive Special Discount"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Discount Type</label>
                      <select 
                        value={formData.discount_type} 
                        onChange={(e) => setFormData({...formData, discount_type: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white outline-none font-medium"
                      >
                        <option value="percentage">Percentage OFF (%)</option>
                        <option value="fixed_amount">Fixed Amount OFF (₹)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Discount Value *</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={formData.discount_type === "percentage" ? formData.discount_percent : formData.discount_amount} 
                          onChange={(e) => setFormData({...formData, [formData.discount_type === "percentage" ? "discount_percent" : "discount_amount"]: e.target.value})} 
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl pl-10 focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none font-bold text-green-600"
                        />
                        {formData.discount_type === "percentage" ? <Percent className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" /> : <IndianRupee className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Start Date</label>
                      <input 
                        type="date" 
                        value={formData.valid_from} 
                        onChange={(e) => setFormData({...formData, valid_from: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expiry Date</label>
                      <input 
                        type="date" 
                        value={formData.valid_until} 
                        onChange={(e) => setFormData({...formData, valid_until: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none" 
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-[#800020]/5 rounded-3xl border border-[#800020]/10 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-[#800020]" />
                        <span className="font-bold text-[#800020] text-sm">Visible on Home Screen (Myntra Style)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.display_on_homepage} 
                          onChange={(e) => setFormData({...formData, display_on_homepage: e.target.checked})} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#800020]"></div>
                      </label>
                    </div>
                    {formData.display_on_homepage && (
                      <div className="animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Banner Message (e.g. FLAT 20% OFF)</label>
                        <input 
                          type="text" 
                          value={formData.banner_text} 
                          onChange={(e) => setFormData({...formData, banner_text: e.target.value})} 
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl mt-1 outline-none focus:border-[#800020] bg-white" 
                          placeholder="What users will see on the banner"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Target Level (Choose One):</label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {[
                        { id: "all", label: "Store-wide (All Items)", icon: Tag },
                        { id: "product", label: "Specific Products", icon: Target },
                        { id: "variety", label: "Filtered Varieties", icon: Settings },
                        { id: "color", label: "Specific Colors", icon: Settings },
                        { id: "material", label: "By Fabric/Material", icon: Settings },
                        { id: "occasion", label: "Specific Occasions", icon: Settings }
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setMappingType(item.id);
                            setSelectedVars([]);
                            setSelectedColors([]);
                            setSelectedMats([]);
                            setFormData({
                              ...formData,
                              applicable_product_id: [],
                              applicable_variety_id: [],
                              applicable_color_id: [],
                              applicable_occasion_id: []
                            });
                          }}
                          className={`flex items-center gap-2 p-3 border rounded-xl transition-all text-xs font-bold ${mappingType === item.id ? 'border-[#800020] bg-[#800020]/5 text-[#800020]' : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="animate-in fade-in duration-300 pt-6 border-t border-gray-100 min-h-[350px]">
                    
                    {/* HIERARCHICAL SELECTION WORKFLOW */}
                    {(mappingType === "product" || mappingType === "variety") && (
                      <div className="space-y-6">
                        <div className="space-y-3 bg-gray-50 p-5 rounded-3xl border border-gray-100 animate-in slide-in-from-top-4">
                          <label className="text-[10px] font-bold text-[#800020] uppercase tracking-widest">Select Varieties</label>
                          {varieties.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No varieties found.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {varieties.map(v => (
                                <label key={v.id} className="flex items-center gap-2 p-2.5 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-[#800020]/30 transition-all">
                                  <input
                                    type="checkbox"
                                    checked={selectedVars.includes(v.id)}
                                    onChange={() => {
                                      const updated = selectedVars.includes(v.id) ? selectedVars.filter(id => id !== v.id) : [...selectedVars, v.id];
                                      setSelectedVars(updated);
                                      if (mappingType === "variety") setFormData({ ...formData, applicable_variety_id: updated });
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 text-[#800020]"
                                  />
                                  <span className="text-xs font-bold text-gray-700">{v.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        {mappingType === "product" && (
                          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4">
                            <div className="space-y-3 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                              <label className="text-[10px] font-bold text-[#800020] uppercase tracking-widest text-center block">Filter by Color</label>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {colors.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedColors(selectedColors.includes(c.id) ? selectedColors.filter(id => id !== c.id) : [...selectedColors, c.id])}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColors.includes(c.id) ? 'border-[#800020] scale-110 shadow-lg' : 'border-white'}`}
                                    style={{ backgroundColor: c.hex_code }}
                                    title={c.name}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                              <label className="text-[10px] font-bold text-[#800020] uppercase tracking-widest text-center block">Filter by Material</label>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {materials.map(m => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setSelectedMats(selectedMats.includes(m.id) ? selectedMats.filter(id => id !== m.id) : [...selectedMats, m.id])}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${selectedMats.includes(m.id) ? 'bg-[#800020] text-white border-[#800020]' : 'bg-white text-gray-500 border-gray-100'}`}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {mappingType === "product" && (
                          <div className="space-y-3 bg-white p-6 rounded-3xl border-2 border-[#800020]/10 animate-in slide-in-from-top-4 shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] font-bold text-[#800020] uppercase tracking-widest">Select Products ({availableProducts.length} Found) *</label>
                              <button type="button" onClick={() => setFormData({...formData, applicable_product_id: availableProducts.map(p => p.id)})} className="text-[10px] font-bold text-[#800020] hover:underline">Select All Filtered</button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {availableProducts.map(p => (
                                <label key={p.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-2xl hover:bg-[#800020]/5 cursor-pointer transition-all group">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={formData.applicable_product_id.includes(p.id)}
                                      onChange={() => toggleSelection(p.id, "applicable_product_id")}
                                      className="w-5 h-5 rounded-lg border-gray-300 text-[#800020]"
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-gray-700 group-hover:text-[#800020]">{p.name}</span>
                                      <div className="flex gap-2 text-[9px] font-bold uppercase text-gray-400">
                                        <span>{varieties.find(v => v.id === p.variety_id)?.name || "No variety"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-300 font-bold">{materials.find(m => m.id === p.material_id)?.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {mappingType === "color" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Colors (Multiple Allowed)</label>
                        <div className="grid grid-cols-3 gap-3">
                          {colors.map(c => (
                            <label key={c.id} className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-all hover:border-[#800020]/30">
                              <div className="w-8 h-8 rounded-full border border-gray-200 shadow-inner" style={{ backgroundColor: c.hex_code || '#ccc' }}></div>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  checked={(formData.applicable_color_id || []).includes(c.id)}
                                  onChange={() => toggleSelection(c.id, "applicable_color_id")}
                                  className="w-4 h-4 rounded border-gray-300 text-[#800020]"
                                />
                                <span className="text-[10px] font-bold text-gray-700">{c.name}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {mappingType === "material" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Fabrics/Materials (Multiple Allowed)</label>
                        <div className="grid grid-cols-2 gap-3">
                          {materials.map(m => (
                            <label key={m.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={(formData.applicable_material_id || []).includes(m.id)}
                                onChange={() => toggleSelection(m.id, "applicable_material_id")}
                                className="w-4 h-4 rounded border-gray-300 text-[#800020]"
                              />
                              <span className="text-sm font-bold text-gray-700">{m.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {mappingType === "occasion" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Occasions (Multiple Allowed)</label>
                        <div className="grid grid-cols-2 gap-3">
                          {occasions.map(o => (
                            <label key={o.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={(formData.applicable_occasion_id || []).includes(o.id)}
                                onChange={() => toggleSelection(o.id, "applicable_occasion_id")}
                                className="w-4 h-4 rounded border-gray-300 text-[#800020]"
                              />
                              <span className="text-sm font-bold text-gray-700">{o.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {mappingType === "all" && (
                      <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium italic">Store-wide: This coupon will apply to every single item in your collection.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Minimum Purchase Amount (₹)</label>
                      <input 
                        type="number" 
                        value={formData.min_purchase_amount} 
                        onChange={(e) => setFormData({...formData, min_purchase_amount: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[#800020]" 
                        placeholder="e.g. 1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Max Discount Limit (₹)</label>
                      <input 
                        type="number" 
                        value={formData.max_discount_amount} 
                        onChange={(e) => setFormData({...formData, max_discount_amount: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[#800020]" 
                        placeholder="Cap for percentage"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Redemption Limit</label>
                      <input 
                        type="number" 
                        value={formData.usage_limit} 
                        onChange={(e) => setFormData({...formData, usage_limit: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[#800020]" 
                        placeholder="Unlimited if empty"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usage Per Customer</label>
                      <input 
                        type="number" 
                        value={formData.usage_limit_per_user} 
                        onChange={(e) => setFormData({...formData, usage_limit_per_user: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-[#800020]" 
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-6 border-t border-gray-100 flex justify-between bg-gray-50/30">
              <button 
                type="button" 
                onClick={currentStep === 1 ? () => setIsModalOpen(false) : prevStep} 
                className="px-6 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all"
              >
                {currentStep === 1 ? 'Cancel' : 'Go Back'}
              </button>
              {currentStep < 3 ? (
                <button 
                  type="button"
                  onClick={nextStep}
                  className="px-10 py-2.5 bg-[#800020] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  Continue to {currentStep === 1 ? 'Select Targets' : 'Final Limits'} <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={handleSave}
                  className="px-10 py-2.5 bg-gradient-to-r from-[#800020] to-[#a0152d] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  {editingCoupon ? "Save All Changes" : "Create & Activate Coupon"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

