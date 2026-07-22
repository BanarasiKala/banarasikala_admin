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
  Mail,
  Phone,
  Package,
  MessageCircleQuestion,
} from "lucide-react";
import { API_ENDPOINTS } from "../../config/api";
import useSupportStream, { useTypingPing } from "../../hooks/useSupportStream";
import ImageLightbox from "../../components/ImageLightbox";

/**
 * Support — one customer per row, one strand per order inside.
 *
 * The queue lists PEOPLE, so an agent sees the whole relationship rather than the same person
 * three times. The work happens per STRAND: each order carries its own status, so the damaged
 * saree can be resolved while the parcel that never arrived stays open.
 *
 * Reading defaults to everything, in order, with a divider wherever the order changes — the
 * view a ticket queue could never give. The chips narrow it to one strand when an agent wants
 * to answer just that.
 */

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

const jsonHeaders = () => ({ ...authHeaders(), "Content-Type": "application/json" });

const formatStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const dayKey = (value) => new Date(value).toDateString();

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const topicLabel = (topic) => (topic?.order
  ? `#${topic.order.number || topic.order_id}`
  : "General");

/**
 * Delivery state for one of OUR (support's) messages.
 *
 *   ✓        sent      — saved on the server
 *   ✓✓ grey  delivered — reached the customer's browser
 *   ✓✓ blue  read      — the customer opened the chat past this message
 *
 * Read comes from the customer's watermark rather than a per-message flag: one timestamp
 * answers it for the whole conversation and can only move forward.
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

/**
 * Read watermarks only ever move forward.
 *
 * The thread is refetched after a reply, and that GET is issued BEFORE the customer's read
 * POST lands yet resolves AFTER the `read` event that POST raised — so assigning its payload
 * hands back the pre-read value and the tick drops from blue to grey a beat after turning
 * blue, with nothing left to raise it again.
 */
const laterRead = (current, incoming) => {
  if (!incoming) return current || null;
  if (!current) return incoming;
  return new Date(incoming) > new Date(current) ? incoming : current;
};

// The same rule per message: a delivered stamp already on screen outlives a refetch whose
// snapshot predates it.
const keepReceipts = (previous, incoming = []) => {
  const known = new Map((previous || []).map((m) => [String(m.id), m.delivered_at]));
  return incoming.map((m) => (
    m.delivered_at ? m : { ...m, delivered_at: known.get(String(m.id)) || null }
  ));
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

/** The order a strand is about, as the customer saw it when they wrote in. */
const OrderCard = ({ order }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    {order?.productImage ? (
      <img
        src={order.productImage}
        alt=""
        loading="lazy"
        className="w-10 h-10 rounded-lg object-cover border border-[#D4AF37]/25 shrink-0"
      />
    ) : (
      <span className="w-10 h-10 rounded-lg grid place-items-center bg-[#F5F1ED] text-[#800020]/50 shrink-0">
        {order ? <Package className="w-4 h-4" /> : <MessageCircleQuestion className="w-4 h-4" />}
      </span>
    )}
    <span className="min-w-0">
      <strong className="block text-[12px] font-bold text-[#4A3F35] leading-snug truncate">
        {order ? (order.productName || "Order") : "General question"}
      </strong>
      <small className="block text-[11px] font-semibold text-[#4A3F35]/60">
        {order ? `#${order.number}` : "Not about a specific order"}
        {order?.extraItems > 0 && ` · +${order.extraItems} more`}
      </small>
    </span>
  </div>
);

export default function Support() {
  const [conversations, setConversations] = useState([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  // null = read the whole relationship; a topic id narrows to one strand.
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerTyping, setCustomerTyping] = useState(false);
  const [customerReadAt, setCustomerReadAt] = useState(null);
  const [toast, setToast] = useState(null);
  const threadEndRef = useRef(null);

  // The fetchers never touch state before their first await — the "loading" flips live in the
  // click handlers below. That keeps the effects free of synchronous state updates.
  const fetchConversations = async () => {
    try {
      const query = filter === "open"
        ? "?open=true"
        : filter === "all"
          ? ""
          : `?status=${encodeURIComponent(filter)}`;
      const response = await fetch(`${API_ENDPOINTS.support}/conversations${query}`, { headers: authHeaders() });
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
      setError(Array.isArray(data) ? "" : (data?.message || "Unable to load conversations."));
    } catch {
      setConversations([]);
      setError("Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  // Always fetches the WHOLE relationship. Narrowing to a strand is a filter applied here,
  // not a request — an agent flicking between chips should not wait on the network each time,
  // and the full history is what they came to read anyway.
  const fetchThread = async (id) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.support}/conversations/${id}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) {
        setThread(null);
        setCustomerReadAt(null);
        setError(data?.message || "Unable to open this conversation.");
        return;
      }
      // Receipts are merged forward, not assigned — see laterRead / keepReceipts.
      setThread((current) => ({ ...data, messages: keepReceipts(current?.messages, data.messages) }));
      setCustomerReadAt((current) => laterRead(current, data?.customer_read_at));
    } catch {
      setThread(null);
      setCustomerReadAt(null);
      setError("Unable to open this conversation.");
    } finally {
      setThreadLoading(false);
    }
  };

  const selectFilter = (id) => {
    setFilter(id);
    setLoading(true);
    setActiveId(null);
    setThread(null);
    setActiveTopicId(null);
    setCustomerReadAt(null);
  };

  const openConversation = (id) => {
    setActiveId(id);
    setThread(null);
    setThreadLoading(true);
    setReply("");
    setCustomerTyping(false);
    setActiveTopicId(null);
    // The watermark belongs to the conversation being left. Clearing it is what makes the
    // merge in fetchThread safe.
    setCustomerReadAt(null);
    // Opening clears the unread badge locally and tells the customer we've seen it.
    setConversations((rows) => rows.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
    fetch(`${API_ENDPOINTS.support}/conversations/${id}/read`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };

  const closeThread = () => {
    setActiveId(null);
    setThread(null);
    setReply("");
    setCustomerTyping(false);
    setActiveTopicId(null);
    setCustomerReadAt(null);
  };

  // ── Realtime ──────────────────────────────────────────────────────────────────────
  // Two streams, deliberately: the inbox firehose is always on so new conversations and unread
  // counts stay live with nothing open, and a per-conversation stream carries the
  // typing/read/message detail for the thread actually on screen.

  // The inbox handler needs to know which thread is open (so it doesn't badge the one being
  // read). A ref rather than a dependency: closing over activeId directly would resubscribe
  // the firehose on every switch, and events land in that gap.
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  /**
   * Refetch when an event names a customer the current filter is not showing.
   *
   * The case that matters is the default one. On "Needs Action", a customer whose strands are
   * all Resolved is absent from the list — and when they write back, the strand reopens
   * server-side but no `conversation_started` fires, because the strand is not new. Patching
   * only rows already on screen therefore dropped the event, and support did not see the
   * returning customer until they happened to refresh. That is precisely the customer you
   * least want to miss.
   *
   * Debounced: a burst of messages, or a reopen that also raises a status change, would
   * otherwise fire a list query each.
   */
  const refetchTimer = useRef(null);
  const scheduleRefetch = () => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => fetchConversations(), 400);
  };
  useEffect(() => () => clearTimeout(refetchTimer.current), []);

  useSupportStream(`${API_ENDPOINTS.support}/stream/admin`, (event) => {
    switch (event.type) {
      case "conversation_started":
        setConversations((rows) => {
          const existing = rows.find((c) => c.id === event.conversation.id);
          // A brand-new customer is a new row. An existing one opening a strand on another
          // order is a new chip on the row they already occupy — replacing the row would
          // throw away the strands already on it.
          if (!existing) return [event.conversation, ...rows];
          const topics = existing.topics || [];
          if (topics.some((t) => t.id === event.conversation.topic?.id)) return rows;
          return rows.map((c) => (c.id === existing.id
            ? { ...c, topics: [event.conversation.topic, ...topics] }
            : c));
        });
        setToast(event.conversation.is_new_customer
          ? `New conversation — ${event.conversation.name}`
          : `${event.conversation.name} started a chat on ${topicLabel(event.conversation.topic)}`);
        break;
      case "message":
        // Bump the row to the top (the list sorts by last activity) and badge it, unless it's
        // the thread already open in front of us. A system line changes neither.
        setConversations((rows) => {
          const row = rows.find((c) => c.id === event.conversation_id);
          if (event.message.sender === "system") return rows;
          // Not on screen under this filter — the server decides whether it belongs now.
          if (!row) {
            scheduleRefetch();
            return rows;
          }
          const bumped = {
            ...row,
            message_count: (row.message_count || 0) + 1,
            preview: event.message.body || (event.message.attachments?.length ? "Photo" : ""),
            awaiting_reply: event.message.sender === "customer",
            unread_count: event.message.sender === "customer" && event.conversation_id !== activeIdRef.current
              ? (row.unread_count || 0) + 1
              : row.unread_count || 0,
          };
          return [bumped, ...rows.filter((c) => c.id !== event.conversation_id)];
        });
        break;
      case "status":
        setConversations((rows) => {
          const row = rows.find((c) => c.id === event.conversation_id);
          // A strand changing state can move a customer into or out of the current filter,
          // so anything not already shown is re-asked for rather than ignored.
          if (!row) {
            scheduleRefetch();
            return rows;
          }
          return rows.map((c) => (c.id === event.conversation_id
            ? {
              ...c,
              topics: (c.topics || []).map((t) => (
                t.id === event.topic_id ? { ...t, status: event.status } : t
              )),
            }
            : c));
        });
        break;
      default:
        break;
    }
  });

  useSupportStream(
    activeId ? `${API_ENDPOINTS.support}/stream/conversations/${activeId}` : null,
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
            fetch(`${API_ENDPOINTS.support}/conversations/${activeId}/read`, {
              method: "POST",
              headers: authHeaders(),
            }).catch(() => {});
          }
          break;
        case "typing":
          if (event.side === "customer") setCustomerTyping(Boolean(event.typing));
          break;
        case "read":
          if (event.side === "customer") setCustomerReadAt((c) => laterRead(c, event.read_at));
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
        case "status":
          setThread((current) => (current
            ? {
              ...current,
              topics: (current.topics || []).map((t) => (
                t.id === event.topic_id ? { ...t, status: event.status } : t
              )),
            }
            : current));
          break;
        default:
          break;
      }
    },
  );

  const pingTyping = useTypingPing(activeId);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  /* eslint-disable react-hooks/set-state-in-effect --
     Both fetchers reach their first await before touching state, so nothing here re-renders
     during the effect's synchronous pass; the rule just can't see across the await. */
  useEffect(() => { fetchConversations(); }, [filter]);
  useEffect(() => {
    if (activeId) fetchThread(activeId);
  }, [activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Also on the typing bubble appearing — it adds height below the last message and would
  // otherwise be clipped below the fold.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages?.length, customerTyping, activeTopicId]);

  const topics = useMemo(() => thread?.topics || [], [thread]);

  /**
   * The strand a reply goes into.
   *
   * When a chip is selected that is the answer. Reading everything, it is the strand the last
   * message came from — an agent typing after reading the whole history is answering whatever
   * was said most recently, not whichever strand happens to sort first.
   */
  const replyTopic = useMemo(() => {
    if (activeTopicId) return topics.find((t) => t.id === activeTopicId) || null;
    const messages = thread?.messages || [];
    const last = messages[messages.length - 1];
    return topics.find((t) => t.id === last?.topic_id) || topics[0] || null;
  }, [activeTopicId, topics, thread]);

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text || !thread || sending) return;
    if (!replyTopic) {
      setError("Nothing to reply to in this conversation yet.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.support}/conversations/${thread.id}/messages`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ message: text, topicId: replyTopic.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "Unable to send the reply.");
        return;
      }
      setReply("");
      // The server promotes an Open strand to In Progress on the first reply — reload so the
      // status shown here is the status that was actually saved.
      await fetchThread(thread.id);
      fetchConversations();
    } catch {
      setError("Unable to send the reply.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status) => {
    if (!thread || !replyTopic || status === replyTopic.status) return;
    setStatusSaving(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.support}/conversations/${thread.id}/topics/${replyTopic.id}`,
        { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ status }) },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "Unable to update the status.");
        return;
      }
      // The change writes a system line into the strand, which is the point — the customer
      // watches it appear. Reload so this side sees the same line.
      await fetchThread(thread.id);
      fetchConversations();
    } catch {
      setError("Unable to update the status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const awaitingCount = useMemo(
    () => conversations.filter((c) => c.awaiting_reply
      && (c.topics || []).some((t) => t.status !== "Closed")).length,
    [conversations],
  );

  /**
   * The messages on screen, each with the chrome that precedes it.
   *
   * `separator` is a date change; `strand` is an order change, which only appears when reading
   * everything — it is what stops two orders' messages running together in one scroll. Both
   * are derived rather than tracked with a rolling variable inside the map, because a `let`
   * the render mutates makes the output depend on how many times React chooses to run it.
   */
  const timeline = useMemo(() => {
    const all = thread?.messages || [];
    const messages = activeTopicId ? all.filter((m) => m.topic_id === activeTopicId) : all;
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const sameDay = previous && dayKey(previous.createdAt) === dayKey(message.createdAt);
      const sameStrand = previous && previous.topic_id === message.topic_id;
      return {
        message,
        separator: sameDay ? null : dayLabel(message.createdAt),
        // Suppressed when a chip is active: every message is that strand, so saying so on
        // each one would be noise.
        strand: activeTopicId || sameStrand
          ? null
          : topics.find((t) => t.id === message.topic_id) || null,
      };
    });
  }, [thread, activeTopicId, topics]);

  return (
    <div className="space-y-4">
      {/* Toast from the inbox stream, so it appears whether or not a thread is open — the
          point is to notice someone arriving while you're reading someone else. */}
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
            Support
          </h1>
          <p className="text-xs text-[#4A3F35]/60 font-semibold mt-0.5">
            {awaitingCount > 0
              ? `${awaitingCount} customer${awaitingCount === 1 ? "" : "s"} waiting on your reply`
              : "Nobody is waiting on a reply"}
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 items-start">
        {/* Queue — one row per customer. */}
        <div className={`${activeId ? "hidden lg:block" : "block"} space-y-2`}>
          {loading ? (
            <div className="p-10 bg-white rounded-xl border border-[#D4AF37]/20 flex flex-col items-center gap-2 text-[#4A3F35]/60">
              <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
              <span className="text-xs font-semibold">Loading conversations…</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-10 bg-white rounded-xl border border-[#D4AF37]/20 flex flex-col items-center gap-2 text-center">
              <MessageSquareText className="w-8 h-8 text-[#800020]/40" />
              <span className="text-sm font-bold text-[#4A3F35]">No conversations here</span>
              <span className="text-xs text-[#4A3F35]/60 font-semibold">Nothing matches this filter right now.</span>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => openConversation(conversation.id)}
                className={`w-full text-left p-3.5 bg-white rounded-xl border transition-all ${
                  String(conversation.id) === String(activeId)
                    ? "border-[#800020] shadow-md"
                    : "border-[#D4AF37]/20 hover:border-[#800020]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#4A3F35] truncate">{conversation.name}</span>
                  {conversation.unread_count > 0 && (
                    <span
                      className="shrink-0 min-w-[16px] px-1 py-0.5 rounded-full bg-[#087a55] text-white text-[10px] font-bold text-center"
                      title={`${conversation.unread_count} unread`}
                    >
                      {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-[#4A3F35]/55 truncate">{conversation.email}</p>
                <p className="mt-1 text-[11px] text-[#4A3F35]/60 line-clamp-2 leading-relaxed">
                  {conversation.preview || "—"}
                </p>

                {/* Every strand and its state, so the queue answers "what needs doing" without
                    anyone opening the row. */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(conversation.topics || []).slice(0, 4).map((topic) => {
                    const { chip, Icon } = styleOf(topic.status);
                    return (
                      <span
                        key={topic.id}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-bold ${chip}`}
                        title={`${topicLabel(topic)} — ${topic.status}`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {topicLabel(topic)}
                      </span>
                    );
                  })}
                  {(conversation.topics || []).length > 4 && (
                    <span className="text-[9.5px] font-bold text-[#4A3F35]/45 self-center">
                      +{conversation.topics.length - 4}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold text-[#4A3F35]/50">
                  <span>{formatStamp(conversation.last_message_at)}</span>
                  {conversation.awaiting_reply && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#800020] text-white">Reply needed</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className={`${activeId ? "block" : "hidden lg:block"} bg-white rounded-xl border border-[#D4AF37]/20 overflow-hidden`}>
          {threadLoading && !thread ? (
            <div className="p-16 flex flex-col items-center gap-2 text-[#4A3F35]/60">
              <Loader2 className="w-5 h-5 animate-spin text-[#800020]" />
              <span className="text-xs font-semibold">Opening conversation…</span>
            </div>
          ) : !thread ? (
            <div className="p-16 flex flex-col items-center gap-2 text-center">
              <MessageSquareText className="w-9 h-9 text-[#800020]/30" />
              <span className="text-sm font-bold text-[#4A3F35]">Select a customer</span>
              <span className="text-xs text-[#4A3F35]/60 font-semibold">
                Pick someone from the queue to read everything they have ever said to us.
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
                    <span className="text-sm font-bold text-[#4A3F35]">{thread.name}</span>
                    {customerTyping && (
                      <span className="text-[10px] font-bold text-[#087a55]">typing…</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#4A3F35]/60 mt-0.5">
                    {thread.email && (
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{thread.email}</span>
                    )}
                    {thread.phone && (
                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{thread.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Strand chips. Default is everything in order — the whole relationship, which
                  is the view worth having. A chip narrows to one order when an agent wants to
                  answer just that, and the status control follows whatever is selected. */}
              <div className="px-4 py-2.5 border-b border-[#D4AF37]/10 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTopicId(null)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    activeTopicId === null
                      ? "bg-[#800020] text-white border-[#800020]"
                      : "bg-white text-[#4A3F35]/70 border-[#D4AF37]/25 hover:border-[#800020]/40"
                  }`}
                >
                  All
                </button>
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setActiveTopicId(topic.id)}
                    title={topic.order?.productName || "General question"}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      activeTopicId === topic.id
                        ? "bg-[#800020] text-white border-[#800020]"
                        : "bg-white text-[#4A3F35]/70 border-[#D4AF37]/25 hover:border-[#800020]/40"
                    }`}
                  >
                    {topicLabel(topic)}
                  </button>
                ))}
              </div>

              {/* The strand a reply lands in, and the status control for it. Together they are
                  the answer to "what am I about to affect" — without them, an agent reading
                  the whole history has no way to tell. */}
              {replyTopic && (
                <div className="px-4 py-2.5 border-b border-[#D4AF37]/10 flex flex-wrap items-center justify-between gap-3 bg-[#FCFBFA]">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A3F35]/45 shrink-0">
                      Replying to
                    </span>
                    <OrderCard order={replyTopic.order} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={replyTopic.status} />
                    <select
                      value={replyTopic.status}
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
              )}

              <div className="p-4 space-y-3 max-h-[52vh] overflow-y-auto custom-scrollbar bg-[#FCFBFA]">
                {timeline.map(({ message, separator, strand }) => {
                  const isAdmin = message.sender === "admin";

                  const chrome = (
                    <>
                      {separator && (
                        <div className="flex justify-center mb-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#4A3F35]/8 text-[10px] font-bold text-[#4A3F35]/60">{separator}</span>
                        </div>
                      )}
                      {/* Where the conversation changes order. Without it two strands would
                          run together in the All view and a reply would look like an answer
                          to whatever happened to precede it. */}
                      {strand && (
                        <div className="my-2 px-3 py-2 rounded-lg border border-[#D4AF37]/30 bg-white">
                          <OrderCard order={strand.order} />
                        </div>
                      )}
                    </>
                  );

                  // A status line belongs to neither side, so it sits centred across the
                  // thread — it is the conversation changing state, not someone speaking.
                  if (message.type === "status") {
                    return (
                      <div key={message.id}>
                        {chrome}
                        <div className="flex justify-center">
                          <span className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800 text-center">
                            {message.body}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id}>
                      {chrome}
                      <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
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

                          {/* Photos the customer attached. They open in the in-page viewer: a
                              damaged saree cannot be judged from a thumbnail, and a new tab
                              would take support away from the conversation describing it. */}
                          {message.attachments?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {message.attachments.map((image, imageIndex) => (
                                <button
                                  type="button"
                                  key={image.url}
                                  onClick={() => setLightbox({ images: message.attachments, index: imageIndex })}
                                  aria-label="View photo"
                                  className="block p-0 border border-[#D4AF37]/30 rounded-lg overflow-hidden cursor-zoom-in bg-[#F5F1ED]"
                                >
                                  <img
                                    src={image.url}
                                    alt="Support attachment"
                                    loading="lazy"
                                    /* Natural aspect ratio, capped: a portrait saree shot
                                       cropped to a square loses the defect being reported. */
                                    className="block w-auto h-auto max-w-[180px] max-h-[160px]"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* An image-only message has no text; an empty <p> would leave a
                              stray gap under the photos. */}
                          {message.body && (
                            <p className="mt-0.5 text-[13px] text-[#4A3F35] leading-relaxed whitespace-pre-wrap break-words">
                              {message.body}
                            </p>
                          )}
                          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-[#4A3F35]/40">
                            {formatStamp(message.createdAt)}
                            {isAdmin && <MessageTicks message={message} readAt={customerReadAt} />}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {customerTyping && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl rounded-bl-sm border bg-white border-[#D4AF37]/25">
                      <span className="block text-[10px] font-bold text-[#800020]">
                        {thread.name || "Customer"}
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

              {/* Always available. Closing a strand does not lock it — the customer has no
                  second thread to open, so writing again simply reopens that one. */}
              <form onSubmit={sendReply} className="p-3 border-t border-[#D4AF37]/15 flex items-end gap-2">
                <textarea
                  rows={2}
                  value={reply}
                  maxLength={2000}
                  onChange={(event) => { setReply(event.target.value); pingTyping(); }}
                  placeholder={replyTopic
                    ? `Reply about ${topicLabel(replyTopic)}…`
                    : "Reply to the customer…"}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#D4AF37]/30 text-[13px] text-[#4A3F35] outline-none focus:border-[#800020] resize-y"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim() || !replyTopic}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#800020] text-white text-xs font-bold disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
