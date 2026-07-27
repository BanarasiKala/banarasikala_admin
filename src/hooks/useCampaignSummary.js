import { useCallback, useEffect, useState } from "react";
import API_ENDPOINTS from "../config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("admin_token") || localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

/**
 * How many times each coupon/product has already been emailed to the newsletter list, plus the
 * current subscriber count. Both the Coupons and Products tables need exactly this, so the
 * fetch lives here rather than being written twice.
 *
 * Failures are swallowed to an empty summary on purpose: not knowing the send history must
 * never stop the page it is decorating from rendering.
 */
export default function useCampaignSummary(sourceType) {
  const [summary, setSummary] = useState({});
  const [activeSubscribers, setActiveSubscribers] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sourceType });
      const res = await fetch(`${API_ENDPOINTS.newsletter}/campaigns/summary?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.summary || {});
      setActiveSubscribers(Number(data.activeSubscribers) || 0);
    } catch {
      // Leave the previous values in place.
    }
  }, [sourceType]);

  useEffect(() => { refresh(); }, [refresh]);

  return { summary, activeSubscribers, refresh };
}
