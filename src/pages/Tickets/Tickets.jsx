import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquareText,
  Send,
  Loader2,
  ArrowLeft,
  CircleDot,
  CheckCircle2,
  Check,
  CheckCheck,
  Lock,
  Clock,
  Package,
  Mail,
  Phone,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import useSupportStream, { useTypingPing } from "../../hooks/useSupportStream";

/**
 * WhatsApp-style delivery state for one of OUR (support's) messages.
 *
 *   ✓        sent      — saved on the server
 *   ✓✓ grey  delivered — reached the customer's browser
 *   ✓✓ blue  read      — the customer opened the thread past this message
 *
 * Read is derived from the customer's watermark rather than stored per message: one
 * timestamp answers it for the whole thread and can only move forward.
 */
const MessageTicks = ({ message, readAt }) => {
  const read = readAt && new Date(readAt) >= new Date(message.createdAt);
  const delivered = Boolean(message.delivered_at);
  const label = read ? "Read" : delivered ? "Delivered" : "Sent";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex items-center leading-none ${read ? "text-[#1da1f2]" : "text-[#4A3F35]/40"}`}
    >
      {read || delivered ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
    </span>
  );
};

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const FILTERS = [
  { id: "open", label: "Needs Action" },
  { id: "all", label: "All" },
  ...STATUSES.map((status) => ({ id: status, label: status })),
];

const STATUS_STYLE = {
  Open: { chip: "bg-amber-50 text-amber-700 border-amber-200", Icon: CircleDot },
  "In Progress": { chip: "bg-blue-50 text-blue-700 border-blue-200", Icon: Clock },
  Resolved: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  Closed: { chip: "bg-gray-100 text-gray-600 border-gray-200", Icon: Lock },
};

const styleOf = (status) => STATUS_STYLE[status] || STATUS_STYLE.Open;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token") || localStorage.getItem("accessToken") || localStorage.getItem("token")}`,
});

const formatStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const StatusChip = ({ status }) => {
  const { chip, Icon } = styleOf(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${chip}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState("");
  // Live state: ephemeral typing flag for the open thread, the customer's read watermark,
  // and a transient toast when a brand-new ticket arrives while the inbox is on screen.
  const [customerTyping, setCustomerTyping] = useState(false);
  const [customerReadAt, setCustomerReadAt] = useState(null);
  const [toast, setToast] = useState(null);
  const threadEndRef = useRef(null);

  // The fetchers never touch state before their first await — the "loading" flips live in the
  // click handlers below. That keeps the effects free of synchronous state updates.
  const fetchTickets = async () => {
    try {
      const query = filter === "open"
        ? "?open=true"
        : filter === "all"
          ? ""
          : `?status=${encodeURIComponent(filter)}`;
      const response = await fetch(`${API_ENDPOINTS.support}/tickets${query}`, { headers: authHeaders() });
      const data = await response.json();
      setTickets(Array.isArray(data) ? data : []);
      setError(Array.isArray(data) ? "" : (data?.message || "Unable to load tickets."));
    } catch {
      setTickets([]);
      setError("Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  const fetchThread = async (id) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.support}/tickets/${id}`, { headers: authHeaders() });
      const data = await response.json();
      setThread(response.ok ? data : null);
      // Seed the read watermark here rather than in an effect keyed on `thread` — that
      // would be a synchronous setState reacting to state we just set. Stream `read`
      // events update it from here on.
      setCustomerReadAt(response.ok ? (data?.customer_read_at || null) : null);
      if (!response.ok) setError(data?.message || "Unable to open this ticket.");
    } catch {
      setThread(null);
      setError("Unable to open this ticket.");
    } finally {
      setThreadLoading(false);
    }
  };

  const selectFilter = (id) => {
    setFilter(id);
    setLoading(true);
    setActiveId(null);
    setThread(null);
  };

  const openTicket = (id) => {
    setActiveId(id);
    setThread(null);
    setThreadLoading(true);
    setReply("");
    setCustomerTyping(false);
    // Opening clears the unread badge locally and tells the customer we've seen it.
    setTickets((rows) => rows.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)));
    fetch(`${API_ENDPOINTS.support}/tickets/${id}/read`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };

  const closeThread = () => {
    setActiveId(null);
    setThread(null);
    setReply("");
    setCustomerTyping(false);
  };

  // ── Realtime ──────────────────────────────────────────────────────────────────────
  // Two streams, deliberately: the inbox firehose is always on so new tickets and unread
  // counts stay live even with no thread open, and a per-ticket stream carries the
  // typing/read/message detail for the thread actually on screen.

  // The inbox handler needs to know which thread is open (so it doesn't badge the one
  // being read). A ref rather than a dependency: closing over activeId directly would
  // resubscribe the firehose on every thread switch, and events land in that gap.
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useSupportStream(`${API_ENDPOINTS.support}/stream/admin`, (event) => {
    switch (event.type) {
      case "ticket_created":
        setTickets((rows) => (rows.some((t) => t.id === event.ticket.id)
          ? rows
          : [event.ticket, ...rows]));
        setToast(`New ticket ${event.ticket.ticket_number} — ${event.ticket.category}`);
        break;
      case "message":
        // Bump the row to the top (the list is sorted by last activity) and badge it,
        // unless it's the thread already open in front of us.
        setTickets((rows) => {
          const row = rows.find((t) => t.id === event.ticket_id);
          if (!row) return rows;
          const bumped = {
            ...row,
            message_count: (row.message_count || 0) + 1,
            awaiting_reply: event.message.sender === "customer",
            unread_count: event.message.sender === "customer" && event.ticket_id !== activeIdRef.current
              ? (row.unread_count || 0) + 1
              : row.unread_count || 0,
          };
          return [bumped, ...rows.filter((t) => t.id !== event.ticket_id)];
        });
        break;
      case "status":
        setTickets((rows) => rows.map((t) => (
          t.id === event.ticket_id ? { ...t, status: event.status } : t
        )));
        break;
      default:
        break;
    }
  });

  useSupportStream(
    activeId ? `${API_ENDPOINTS.support}/tickets/${activeId}/stream` : null,
    (event) => {
      switch (event.type) {
        case "message":
          setThread((current) => {
            if (!current) return current;
            const messages = current.messages || [];
            // The stream echoes to everyone including the sender — skip what we already have.
            if (messages.some((m) => String(m.id) === String(event.message.id))) return current;
            return { ...current, messages: [...messages, event.message] };
          });
          // A customer message arriving in the thread we're reading is read on arrival.
          if (event.message.sender === "customer") {
            fetch(`${API_ENDPOINTS.support}/tickets/${activeId}/read`, {
              method: "POST",
              headers: authHeaders(),
            }).catch(() => {});
          }
          break;
        case "typing":
          if (event.side === "customer") setCustomerTyping(Boolean(event.typing));
          break;
        case "read":
          if (event.side === "customer") setCustomerReadAt(event.read_at);
          break;
        case "delivered":
          // ✓ -> ✓✓ on the messages that just reached the customer's browser.
          setThread((current) => {
            if (!current) return current;
            const ids = new Set((event.ids || []).map(String));
            return {
              ...current,
              messages: (current.messages || []).map((m) => (
                ids.has(String(m.id)) ? { ...m, delivered_at: event.delivered_at } : m
              )),
            };
          });
          break;
        default:
          break;
      }
    },
  );

  const pingTyping = useTypingPing(activeId);

  // Auto-dismiss the new-ticket toast.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  /* eslint-disable react-hooks/set-state-in-effect --
     Both fetchers reach their first await before touching state, so nothing here re-renders
     during the effect's synchronous pass; the rule just can't see across the await. */
  useEffect(() => { fetchTickets(); }, [filter]);
  useEffect(() => {
    if (activeId) fetchThread(activeId);
  }, [activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Also on the typing bubble appearing — it adds height below the last message and would
  // otherwise be clipped below the fold.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages?.length, customerTyping]);

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !thread || sending) return;

    setSending(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.support}/tickets/${thread.id}/messages`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "Unable to send the reply.");
        return;
      }
      setReply("");
      // The server promotes an Open ticket to In Progress on the first admin reply — reload
      // the thread so the status shown here is the status that was actually saved.
      await fetchThread(thread.id);
      fetchTickets();
    } catch {
      setError("Unable to send the reply.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    if (!thread || status === thread.status) return;
    setStatusSaving(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.support}/tickets/${thread.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "Unable to update the status.");
        return;
      }
      await fetchThread(thread.id);
      fetchTickets();
    } catch {
      setError("Unable to update the status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const awaitingCount = useMemo(
    () => tickets.filter((ticket) => ticket.awaiting_reply && ticket.status !== "Closed").length,
    [tickets],
  );

  const activeRow = useMemo(
    () => tickets.find((ticket) => String(ticket.id) === String(activeId)) || null,
    [tickets, activeId],
  );

  return (
    <div className="space-y-4">
      {/* New-ticket toast. Fires from the inbox stream, so it appears whether or not a
          thread is open — the point is to notice a ticket arriving while you're reading
          another one. Auto-dismisses after 6s; clicking opens the ticket. */}
      {toast && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#800020] text-white shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-top-2"
        >
          <MessageSquareText className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-1 text-white/70 hover:text-white"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brand-font text-2xl font-bold text-[#800020] flex items-center gap-2">
            <MessageSquareText className="w-6 h-6" />
            Support Tickets
          </h1>
          <p className="text-xs text-[#4A3F35]/60 font-semibold mt-0.5">
            {awaitingCount > 0
              ? `${awaitingCount} ticket${awaitingCount === 1 ? "" : "s"} waiting on your reply`
              : "No tickets are waiting on a reply"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => selectFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                filter === item.id
                  ? "bg-[#800020] text-white border-[#800020]"
                  : "bg-white text-[#4A3F35]/70 border-[#D4AF37]/25 hover:border-[#800020]/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-4 items-start">
        {/* Queue */}
        <div className={`${activeId ? "hidden lg:block" : "block"} space-y-2`}>
          {loading ? (
            <div className="p-10 bg-white rounded-xl border border-[#D4AF37]/20 flex flex-col items-center gap-2 text-[#4A3F35]/60">
              <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
              <span className="text-xs font-semibold">Loading tickets…</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-10 bg-white rounded-xl border border-[#D4AF37]/20 flex flex-col items-center gap-2 text-center">
              <MessageSquareText className="w-8 h-8 text-[#800020]/40" />
              <span className="text-sm font-bold text-[#4A3F35]">No tickets here</span>
              <span className="text-xs text-[#4A3F35]/60 font-semibold">Nothing matches this filter right now.</span>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket.id)}
                className={`w-full text-left p-3.5 bg-white rounded-xl border transition-all ${
                  String(ticket.id) === String(activeId)
                    ? "border-[#800020] shadow-md"
                    : "border-[#D4AF37]/20 hover:border-[#800020]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#4A3F35]">{ticket.ticket_number}</span>
                  <StatusChip status={ticket.status} />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-[#4A3F35]">{ticket.name}</p>
                <p className="text-[11px] font-semibold text-[#4A3F35]/60">{ticket.category}</p>
                <p className="mt-1 text-[11px] text-[#4A3F35]/60 line-clamp-2 leading-relaxed">{ticket.message}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold text-[#4A3F35]/50">
                  <span className="inline-flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    #{ticket.order_number || ticket.order_id} · {ticket.message_count} msg
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {/* Unread = customer messages newer than this admin's read watermark.
                        Distinct from "Reply needed", which is about whose turn it is: a
                        ticket can need a reply without being unread (already read, not yet
                        answered). */}
                    {ticket.unread_count > 0 && (
                      <span
                        className="min-w-[16px] px-1 py-0.5 rounded-full bg-[#087a55] text-white text-center"
                        title={`${ticket.unread_count} unread`}
                      >
                        {ticket.unread_count > 9 ? "9+" : ticket.unread_count}
                      </span>
                    )}
                    {ticket.awaiting_reply && ticket.status !== "Closed" && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#800020] text-white">Reply needed</span>
                    )}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className={`${activeId ? "block" : "hidden lg:block"} bg-white rounded-xl border border-[#D4AF37]/20 overflow-hidden`}>
          {threadLoading ? (
            <div className="p-16 flex flex-col items-center gap-2 text-[#4A3F35]/60">
              <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
              <span className="text-xs font-semibold">Opening conversation…</span>
            </div>
          ) : !thread ? (
            <div className="p-16 flex flex-col items-center gap-2 text-center">
              <MessageSquareText className="w-9 h-9 text-[#800020]/30" />
              <span className="text-sm font-bold text-[#4A3F35]">Select a ticket</span>
              <span className="text-xs text-[#4A3F35]/60 font-semibold">
                Pick a ticket from the queue to read the conversation and reply.
              </span>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-[#D4AF37]/15 bg-[#FAF8F6] flex flex-wrap items-center gap-3">
                <button
                  onClick={closeThread}
                  className="lg:hidden p-1.5 rounded-lg border border-[#D4AF37]/25 text-[#800020]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#4A3F35]">{thread.ticket_number}</span>
                    <StatusChip status={thread.status} />
                  </div>
                  <p className="text-[11px] font-semibold text-[#4A3F35]/60 mt-0.5">
                    {thread.category} · Order #{thread.order_number || thread.order_id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F35]/50">Status</span>
                  <select
                    value={thread.status}
                    disabled={statusSaving}
                    onChange={(event) => changeStatus(event.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D4AF37]/30 bg-white text-xs font-bold text-[#4A3F35] outline-none focus:border-[#800020] disabled:opacity-60"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeRow && (
                <div className="px-4 py-2.5 border-b border-[#D4AF37]/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[#4A3F35]/70">
                  <span>{activeRow.name}</span>
                  {activeRow.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" />{activeRow.email}
                    </span>
                  )}
                  {activeRow.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />{activeRow.phone}
                    </span>
                  )}
                </div>
              )}

              <div className="p-4 space-y-3 max-h-[52vh] overflow-y-auto custom-scrollbar bg-[#FCFBFA]">
                {(thread.messages || []).map((message) => {
                  const isAdmin = message.sender === "admin";
                  return (
                    <div key={message.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-xl border ${
                          isAdmin
                            ? "bg-[#800020]/5 border-[#800020]/20 rounded-br-sm"
                            : "bg-white border-[#D4AF37]/25 rounded-bl-sm"
                        }`}
                      >
                        <span className="block text-[10px] font-bold text-[#800020]">
                          {isAdmin ? (message.sender_name || "Support") : (message.sender_name || "Customer")}
                        </span>
                        <p className="mt-0.5 text-[13px] text-[#4A3F35] leading-relaxed whitespace-pre-wrap break-words">
                          {message.message}
                        </p>
                        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-[#4A3F35]/40">
                          {formatStamp(message.createdAt)}
                          {isAdmin && <MessageTicks message={message} readAt={customerReadAt} />}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {customerTyping && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl rounded-bl-sm border bg-white border-[#D4AF37]/25">
                      <span className="block text-[10px] font-bold text-[#800020]">
                        {activeRow?.name || "Customer"}
                      </span>
                      <span className="mt-1 flex items-center gap-1 h-[18px]" aria-live="polite">
                        <i className="w-1.5 h-1.5 rounded-full bg-[#4A3F35]/40 animate-bounce" />
                        <i className="w-1.5 h-1.5 rounded-full bg-[#4A3F35]/40 animate-bounce [animation-delay:150ms]" />
                        <i className="w-1.5 h-1.5 rounded-full bg-[#4A3F35]/40 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>

              {thread.can_reply ? (
                <form onSubmit={sendReply} className="p-3 border-t border-[#D4AF37]/15 flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={reply}
                    maxLength={2000}
                    onChange={(event) => { setReply(event.target.value); pingTyping(); }}
                    placeholder="Reply to the customer…"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#D4AF37]/30 text-[13px] text-[#4A3F35] outline-none focus:border-[#800020] resize-y"
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? "Sending" : "Send"}
                  </button>
                </form>
              ) : (
                <div className="p-3.5 border-t border-[#D4AF37]/15 bg-gray-50 flex items-center gap-2 text-xs font-semibold text-[#4A3F35]/60">
                  <Lock className="w-4 h-4" />
                  This ticket is closed. Reopen it by moving the status back to In Progress.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
