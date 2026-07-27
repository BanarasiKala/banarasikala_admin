import { useCallback, useEffect, useState } from "react";
import { Mail, Send, Users, Loader2, CheckCircle2, AlertTriangle, TestTube2 } from "lucide-react";
import API_ENDPOINTS from "../../config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

const EMPTY = { subject: "", heading: "", intro: "", body: "", ctaLabel: "", ctaUrl: "" };

const STATUS_STYLE = {
  Sent: "bg-emerald-50 text-emerald-700",
  Sending: "bg-amber-50 text-amber-700",
  Failed: "bg-red-50 text-red-700",
  Draft: "bg-gray-100 text-gray-600",
};

/**
 * Compose and send a newsletter to active subscribers.
 *
 * A send cannot be undone, so the screen is built around that: the recipient count is stated
 * up front, a test send to one address is offered first, and the final button asks for typed
 * confirmation rather than being a single click next to the other controls.
 */
export default function Newsletter() {
  const [form, setForm] = useState(EMPTY);
  const [campaigns, setCampaigns] = useState([]);
  const [activeSubscribers, setActiveSubscribers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.newsletter}/campaigns`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load campaigns.");
      setCampaigns(Array.isArray(data.data) ? data.data : []);
      setActiveSubscribers(Number(data.activeSubscribers) || 0);
    } catch (error) {
      setFeedback({ kind: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // While a campaign is mid-flight the row is updated batch by batch, so poll to show real
  // progress rather than a spinner that tells the admin nothing. Keyed on the boolean, not on
  // `campaigns`, so each refresh does not tear down and rebuild the interval.
  const isSending = campaigns.some((c) => c.status === "Sending");
  useEffect(() => {
    if (!isSending) return undefined;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [isSending, load]);

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setFeedback(null); };

  const post = async (path, payload) => {
    const res = await fetch(`${API_ENDPOINTS.newsletter}/campaigns/${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed.");
    return data;
  };

  const sendTest = async () => {
    setBusy("test"); setFeedback(null);
    try {
      const data = await post("test", { ...form, testEmail });
      setFeedback({ kind: "ok", text: data.message });
    } catch (error) {
      setFeedback({ kind: "error", text: error.message });
    } finally {
      setBusy("");
    }
  };

  const sendAll = async () => {
    setBusy("send"); setFeedback(null);
    try {
      const data = await post("send", form);
      setFeedback({ kind: "ok", text: data.message });
      setConfirmOpen(false);
      setConfirmText("");
      setForm(EMPTY);
      await load();
    } catch (error) {
      setFeedback({ kind: "error", text: error.message });
    } finally {
      setBusy("");
    }
  };

  const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#800020]";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#4A3F35] flex items-center gap-2">
            <Mail className="w-5 h-5" /> Newsletter
          </h1>
          <p className="mt-1 text-xs text-[#4A3F35]/60">
            Compose and send to everyone subscribed through the storefront footer.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
          <Users className="w-4 h-4 text-[#800020]" />
          <span className="text-sm font-semibold text-[#4A3F35]">{activeSubscribers}</span>
          <span className="text-xs text-gray-500">active subscriber{activeSubscribers === 1 ? "" : "s"}</span>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${feedback.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {feedback.kind === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Subject line</label>
            <input className={inputCls} value={form.subject} onChange={set("subject")} placeholder="New arrivals just landed" />
          </div>
          <div>
            <label className={labelCls}>Heading (inside the email)</label>
            <input className={inputCls} value={form.heading} onChange={set("heading")} placeholder="Fresh off the loom" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Intro</label>
          <textarea className={inputCls} rows={3} value={form.intro} onChange={set("intro")} placeholder="The opening line, shown under the heading." />
        </div>

        <div>
          <label className={labelCls}>Body (optional — blank line starts a new paragraph)</label>
          <textarea className={inputCls} rows={6} value={form.body} onChange={set("body")} placeholder="Anything further you want to say." />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Button label (optional)</label>
            <input className={inputCls} value={form.ctaLabel} onChange={set("ctaLabel")} placeholder="Shop the collection" />
          </div>
          <div>
            <label className={labelCls}>Button link</label>
            <input className={inputCls} value={form.ctaUrl} onChange={set("ctaUrl")} placeholder="https://banarasikala.com/collection" />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className={labelCls}>Send a test to yourself first</label>
            <input className={inputCls} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@banarasikala.com" />
          </div>
          <button
            type="button"
            onClick={sendTest}
            disabled={busy !== ""}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
            Send test
          </button>
          <button
            type="button"
            onClick={() => { setConfirmOpen(true); setConfirmText(""); }}
            disabled={busy !== "" || activeSubscribers === 0}
            className="px-4 py-2.5 rounded-lg bg-[#800020] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> Send to {activeSubscribers} subscriber{activeSubscribers === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-[#4A3F35]">Recent campaigns</div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No campaigns sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Subject</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Progress</th>
                  <th className="px-5 py-3 text-left">Sent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-5 py-3 text-[#4A3F35]">{c.subject}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLE[c.status] || STATUS_STYLE.Draft}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.sent_count}/{c.recipient_count}
                      {c.failed_count > 0 && <span className="text-red-600"> · {c.failed_count} failed</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {c.finished_at ? new Date(c.finished_at).toLocaleString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Typed confirmation, not a single click. Sending is irreversible and goes to real
          customers, so it should be harder than every other button on the page. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#4A3F35] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#800020]" /> Send to {activeSubscribers} subscriber{activeSubscribers === 1 ? "" : "s"}?
            </h2>
            <p className="text-sm text-gray-600">
              This sends immediately and cannot be undone. Every recipient gets an unsubscribe
              link. Type <strong>SEND</strong> to confirm.
            </p>
            <input
              className={inputCls}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SEND"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAll}
                disabled={confirmText.trim().toUpperCase() !== "SEND" || busy !== ""}
                className="px-4 py-2 rounded-lg bg-[#800020] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
