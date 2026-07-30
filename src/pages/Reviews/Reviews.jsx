import { useState, useEffect } from 'react';
import { Trash2, CheckCircle, Star, MessageSquare, BadgeCheck, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../../config/api';
import './Reviews.css';

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('admin_token') || localStorage.getItem('token')}`,
});

export default function Reviews() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'approved'

  useEffect(() => {
    fetchFeedbacks();
  }, [activeTab]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      setError('');
      // Both tabs read the admin listing. The public `/approved` endpoint returns general site
      // testimonials only (it feeds the home page), so reading it here made an approved product
      // review disappear from this table the moment it was approved — visible while pending,
      // then unreachable for editing, unverifying, or removal.
      const endpoint = `${API_ENDPOINTS.feedback}/all?approved=${activeTab === 'approved'}`;

      const response = await fetch(endpoint, { headers: authHeader() });
      // A missing route falls through to the SPA handler, which answers 200 with an HTML
      // document. Parsing that as JSON throws, and the old catch only logged — so a backend
      // that had never loaded this route was indistinguishable from "no feedback exists".
      const body = await response.text();
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error(
          response.ok
            ? 'The server answered with a page instead of data — the backend is probably running older code. Restart it and try again.'
            : `Request failed (${response.status}).`,
        );
      }
      if (!response.ok || !data.success) throw new Error(data?.message || 'Failed to load feedback.');
      setFeedbacks(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
      setFeedbacks([]);
      setError(err.message || 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerified = async (item) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.feedback}/verified/${item.id}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_verified: !item.is_verified }),
      });
      const data = await response.json();
      if (data.success) fetchFeedbacks();
    } catch (error) {
      console.error('Error updating verified badge:', error);
    }
  };

  // Badging reviews one at a time does not scale, and a half-finished pass is worse than
  // either state: a shopper reading two badged reviews and one unbadged infers something about
  // the unbadged one that is not true.
  const handleVerifyAll = async (verified) => {
    if (!window.confirm(
      `${verified ? 'Show' : 'Hide'} the "Verified Buyer" badge on every product review?`,
    )) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.feedback}/verified/bulk`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_verified: verified }),
      });
      const data = await response.json();
      if (data.success) fetchFeedbacks();
    } catch (error) {
      console.error('Error bulk updating verified badges:', error);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.feedback}/approve/${id}`, {
        method: 'PUT',
        headers: authHeader(),
      });
      const data = await response.json();
      if (data.success) {
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Error approving feedback:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.feedback}/${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      const data = await response.json();
      if (data.success) {
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="brand-font text-2xl font-bold text-[#800020]">Feedback Moderation</h2>
          <p className="text-gray-500 text-sm mt-1">Manage customer reviews and storefront testimonials</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Applies to every product review in the catalogue, not just the rows on screen —
              which is the point: the one-at-a-time route is unusable at any real volume. */}
          <button
            onClick={() => handleVerifyAll(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            title="Show the Verified Buyer badge on every product review"
          >
            <BadgeCheck className="w-4 h-4" /> Verify all
          </button>
          <button
            onClick={() => handleVerifyAll(false)}
            className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Hide the Verified Buyer badge on every product review"
          >
            Unverify all
          </button>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'pending' ? 'bg-white text-[#800020] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pending
          </button>
          <button 
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'approved' ? 'bg-white text-[#800020] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Approved
          </button>
        </div>
        </div>
      </div>
      
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Could not load feedback</p>
            <p className="text-red-600/85 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchFeedbacks}
            className="ml-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm border border-[#D4AF37]/10">
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-[#D4AF37]/20 border-t-[#800020] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm font-medium">Loading feedbacks...</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400 border-b border-[#D4AF37]/10">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Review</th>
                <th className="px-6 py-4">Verified</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-white">
              {feedbacks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MessageSquare className="w-12 h-12 text-gray-200" />
                      <p className="text-gray-400 font-medium">No {activeTab} feedback found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                feedbacks.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F6]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-[#4A3F35]">
                          {item.Customer?.name}
                        </p>
                        <p className="text-[10px] text-gray-400">{item.Customer?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex text-[#D4AF37] gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < item.rating ? 'fill-current' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-[180px]">
                      <p className="font-bold text-[#4A3F35]">{item.Product?.name || "Store feedback"}</p>
                      {Array.isArray(item.images) && item.images.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {item.images.slice(0, 3).map((image, index) => (
                            <img key={`${image.url}-${index}`} src={image.url} alt="" className="w-9 h-9 rounded object-cover border" />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs italic leading-relaxed">
                      {item.title && <p className="not-italic font-bold text-[#4A3F35] mb-1">{item.title}</p>}
                      "{item.comment}"
                    </td>
                    {/* Whether the storefront shows "Verified Buyer" on this review. Every row
                        here IS from a delivered order, so it starts on — this is for the
                        exceptions. A general store testimonial has no purchase behind it, so
                        there is nothing to verify and no toggle. */}
                    <td className="px-6 py-4">
                      {item.product_id ? (
                        <button
                          onClick={() => handleToggleVerified(item)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                            item.is_verified
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                          }`}
                          title={item.is_verified ? 'Hide the badge on this review' : 'Show the badge on this review'}
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                          {item.is_verified ? 'Verified' : 'Off'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-300 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-[10px]">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {activeTab === 'pending' && (
                        <button 
                          onClick={() => handleApprove(item.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
