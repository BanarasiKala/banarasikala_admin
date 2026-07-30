import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, BadgeCheck, Users as UsersIcon, AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import { API_ENDPOINTS } from '../../config/api';
import './Users.css';

/**
 * User Directory.
 *
 * What this screen controls is the "Verified Buyer" badge: whether a person's reviews carry it
 * on the storefront. Deliberately NOT the same thing as email_verified / phone_verified, which
 * are about being able to reach someone. This is about vouching for them publicly, so it is a
 * decision rather than a fact, and it belongs to an admin.
 *
 * The badge on any given review is the AND of this switch and that review's own switch in
 * Feedback Moderation — either one turns it off. Resolved server-side; see FeedbackController.
 *
 * This page was previously two hardcoded rows of fake customers with no API behind it.
 */

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('admin_token') || localStorage.getItem('token') || ''}`,
});

const jsonHeaders = () => ({ ...authHeader(), 'Content-Type': 'application/json' });

const initials = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const joined = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Users() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_ENDPOINTS.customers}/admin/list`, { headers: authHeader() });
      // A route the running backend has not loaded falls through to the SPA handler, which
      // answers 200 with an HTML document. Parsing that as JSON throws, and a bare catch would
      // make "the backend is stale" look identical to "there are no customers".
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
      if (!response.ok || !data.success) throw new Error(data?.message || 'Failed to load customers.');
      setCustomers(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error loading customers:', err);
      setCustomers([]);
      setError(err.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleVerified = async (customer) => {
    setBusyId(customer.id);
    // Flipped locally first: this switch is the whole point of the screen, and waiting a round
    // trip to see it move makes the click feel like it missed. Reverted below if the save fails.
    const next = !customer.is_verified;
    setCustomers((rows) => rows.map((row) => (row.id === customer.id ? { ...row, is_verified: next } : row)));
    try {
      const response = await fetch(`${API_ENDPOINTS.customers}/admin/verified/${customer.id}`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ is_verified: next }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.message || 'Failed to update.');
    } catch (err) {
      setCustomers((rows) => rows.map((row) => (row.id === customer.id ? { ...row, is_verified: !next } : row)));
      setError(err.message || 'Failed to update the customer.');
    } finally {
      setBusyId(null);
    }
  };

  const setAllVerified = async (verified) => {
    if (!window.confirm(`${verified ? 'Show' : 'Hide'} the "Verified Buyer" badge for every customer?`)) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.customers}/admin/verified/bulk`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({ is_verified: verified }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.message || 'Failed to update.');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to update customers.');
    }
  };

  // Filtered here rather than round-tripping on every keystroke. The endpoint takes a ?search
  // too, for when the directory outgrows the page of 200 it returns.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) => [customer.name, customer.email, customer.phone]
      .some((field) => String(field || '').toLowerCase().includes(needle)));
  }, [customers, search]);

  const verifiedCount = useMemo(() => customers.filter((c) => c.is_verified).length, [customers]);

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="brand-font text-xl font-bold text-[#800020]">User Directory</h2>
          <p className="text-gray-500 text-sm mt-1">
            {verifiedCount} of {customers.length} shown with the Verified Buyer badge
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone…"
              className="pl-10 pr-4 py-2 bg-white border border-[#D4AF37]/20 rounded-lg text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>
          <button
            onClick={() => setAllVerified(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <BadgeCheck className="w-4 h-4" /> Verify all
          </button>
          <button
            onClick={() => setAllVerified(false)}
            className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Unverify all
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Could not load the directory</p>
            <p className="text-red-600/85 mt-0.5">{error}</p>
          </div>
          <button
            onClick={load}
            className="ml-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#800020]" />
            <p className="text-sm font-medium">Loading customers…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 text-center">Reviews</th>
                  <th className="px-6 py-3 text-right">Verified Buyer</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-white">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <UsersIcon className="w-12 h-12 text-gray-200" />
                        <p className="text-gray-400 font-medium">
                          {search ? `No customer matches “${search}”` : 'No customers yet'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visible.map((customer) => (
                    <tr key={customer.id} className="hover:bg-[#FAF8F6]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {customer.avatar_url ? (
                            <img src={customer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center font-bold text-[#D4AF37]">
                              {initials(customer.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[#4A3F35] truncate">{customer.name || '—'}</p>
                            <p className="text-[10px] text-gray-400 font-mono">#{customer.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <p className="truncate max-w-[220px]">{customer.email || '—'}</p>
                        {customer.phone && <p className="text-[10px] text-gray-400 mt-0.5">{customer.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-[10px]">{joined(customer.createdAt)}</td>
                      <td className="px-6 py-4 text-center">
                        {/* Someone with no reviews has nothing for the switch to affect, so the
                            count is dimmed rather than shown as a confident zero. */}
                        <span className={`inline-flex items-center gap-1 font-bold ${customer.review_count ? 'text-[#4A3F35]' : 'text-gray-300'}`}>
                          <MessageSquare className="w-3 h-3" /> {customer.review_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleVerified(customer)}
                          disabled={busyId === customer.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${
                            customer.is_verified
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                          }`}
                          title={customer.is_verified
                            ? 'Hide the badge on every review by this customer'
                            : 'Show the badge on every review by this customer'}
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                          {customer.is_verified ? 'Verified' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
