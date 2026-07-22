import { useEffect, useRef } from "react";
import API_ENDPOINTS from "../config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("admin_token") || localStorage.getItem("accessToken") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/**
 * Live support events over SSE (admin side).
 *
 * Mirrors the customer hook in banarasikala_client/src/hooks/useSupportStream.js — same
 * protocol, different HTTP client (this app uses fetch + absolute URLs, not axios).
 *
 * Why the token dance: EventSource cannot send an Authorization header. We POST
 * /support/stream-token with the admin's Bearer token to mint a 60-second single-use
 * token, and put that in the stream URL — so the real credential never enters a URL or an
 * access log. Because the token is single-use, EventSource's own auto-reconnect can't work
 * (it would replay a spent token), so reconnection is handled here with backoff.
 *
 * @param {string|null} path    Absolute stream URL, or null to stay disconnected.
 * @param {function}    onEvent Receives each parsed payload.
 */
export default function useSupportStream(path, onEvent) {
  // Latest-handler ref, assigned in an effect rather than during render: the caller
  // typically passes an inline arrow, and reading it directly in the effect below would
  // tear down and rebuild the stream on every render.
  const handlerRef = useRef(onEvent);
  useEffect(() => { handlerRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!path) return undefined;

    let source = null;
    let retryTimer = null;
    let attempts = 0;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      try {
        const response = await fetch(`${API_ENDPOINTS.support}/stream-token`, {
          method: "POST",
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error("stream token rejected");
        const data = await response.json();
        if (cancelled || !data?.token) return;

        source = new EventSource(
          `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(data.token)}`,
        );

        source.onopen = () => { attempts = 0; };

        source.onmessage = (event) => {
          try {
            handlerRef.current?.(JSON.parse(event.data));
          } catch {
            // A malformed frame must not kill the stream.
          }
        };

        source.onerror = () => {
          source?.close();
          source = null;
          if (cancelled) return;
          const delay = Math.min(30000, 1000 * 2 ** attempts++);
          retryTimer = setTimeout(connect, delay);
        };
      } catch {
        if (cancelled) return;
        const delay = Math.min(30000, 1000 * 2 ** attempts++);
        retryTimer = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [path]);
}

/** Throttled "support is typing" ping — the server re-arms a 6s TTL on each call. */
export function useTypingPing(conversationId) {
  const lastSent = useRef(0);
  return () => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastSent.current < 3000) return;
    lastSent.current = now;
    fetch(`${API_ENDPOINTS.support}/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  };
}
