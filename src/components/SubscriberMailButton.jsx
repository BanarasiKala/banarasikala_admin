import { useState } from "react";
import { Mail, Loader2, Send, AlertTriangle, Users, History } from "lucide-react";
import API_ENDPOINTS from "../config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/**
 * "Email this to the newsletter list" — used from both the Coupons and Products tables.
 *
 * Shared rather than duplicated per screen because the parts that matter are the same
 * everywhere: state how many people this reaches BEFORE sending, state how many times this
 * exact thing has already been mailed about, and make the send a deliberate second action.
 * The send count is the point — without it there is nothing stopping the same coupon going
 * out to the same list three times.
 *
 * @param {'coupon'|'product'} sourceType
 * @param {number} sourceId
 * @param {string} [kind]        For products: 'exclusive' | 'new_arrival'.
 * @param {string} label         What this send is, in words, for the confirm dialog.
 * @param {object} stats         { total, sentTo, lastSentAt } for this source, or undefined.
 * @param {number} activeSubscribers
 * @param {() => void} onSent    Refresh the parent's summary once a send starts.
 */
export default function SubscriberMailButton({
  sourceType,
  sourceId,
  kind = null,
  label,
  title,
  icon: IconComponent = Mail,
  stats,
  activeSubscribers = 0,
  onSent,
  className = "",
  hoverClass = "hover:text-emerald-600 hover:bg-emerald-50",
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Counts this specific kind of mail, not every mail about this entity — a product can be
  // sent as both an exclusive pick and a new arrival, and those are different questions.
  const timesSent = kind ? Number(stats?.byTemplate?.[kind] || 0) : Number(stats?.total || 0);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const url = `${API_ENDPOINTS.newsletter}/campaigns/${sourceType}/${sourceId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(kind ? { kind } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not start the campaign.");
      setResult({ ok: true, text: data.message });
      onSent?.();
    } catch (error) {
      setResult({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(null); }}
        title={title}
        className={`relative p-1.5 text-gray-400 rounded ${hoverClass} ${className}`}
      >
        <IconComponent className="w-4 h-4" />
        {/* The badge is the whole point of the count — it has to be visible without opening
            anything, otherwise nobody checks before sending again. */}
        {timesSent > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[#800020] text-white text-[9px] font-bold leading-none">
            {timesSent > 9 ? "9+" : timesSent}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#4A3F35]">{label}</h2>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-4 h-4 text-[#800020]" />
                Goes to <strong>{activeSubscribers}</strong> active subscriber{activeSubscribers === 1 ? "" : "s"}.
              </div>
              <div className="flex items-start gap-2 text-gray-700">
                <History className="w-4 h-4 mt-0.5 text-gray-400" />
                {timesSent === 0 ? (
                  <span>Not emailed to the list yet.</span>
                ) : (
                  <span>
                    Already sent <strong>{timesSent}</strong> time{timesSent === 1 ? "" : "s"}
                    {stats?.lastSentAt && <> — last on {new Date(stats.lastSentAt).toLocaleDateString("en-IN")}</>}.
                    {" "}Sending again mails the same people a second time.
                  </span>
                )}
              </div>
            </div>

            {timesSent > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                This has gone out before. Repeat sends are the fastest way to lose subscribers.
              </div>
            )}

            {result && (
              <div className={`px-3 py-2 rounded-lg text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                {result.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {result?.ok ? "Close" : "Cancel"}
              </button>
              {!result?.ok && (
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || activeSubscribers === 0}
                  className="px-4 py-2 rounded-lg bg-[#800020] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {activeSubscribers === 0 ? "No subscribers" : `Send to ${activeSubscribers}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
