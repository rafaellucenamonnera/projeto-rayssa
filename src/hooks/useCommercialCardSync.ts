import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const COMMERCIAL_SYNC_INTERVAL_MS = 15_000;

type Card = { id: string; [key: string]: unknown };

/** Read persisted values, including timestamps set by database triggers. */
export function useCommercialCardSync(
  enabled: boolean,
  panelId: string,
  cardIds: string[],
  onCards: (cards: Card[]) => void,
) {
  const onCardsRef = useRef(onCards);
  onCardsRef.current = onCards;
  const idsKey = [...new Set(cardIds)].sort().join(",");
  const generationRef = useRef(0);
  const requestsRef = useRef(new Map<string, number>());

  const refreshCards = useCallback(async (ids: string[]) => {
    if (!enabled || !ids.length) return;
    const generation = generationRef.current;
    const versions = new Map(ids.map((id) => {
      const version = (requestsRef.current.get(id) ?? 0) + 1;
      requestsRef.current.set(id, version);
      return [id, version] as const;
    }));
    try {
      for (let offset = 0; offset < ids.length; offset += 200) {
        const { data, error } = await supabase.from("leads").select("*")
          .eq("panel_id", panelId).in("id", ids.slice(offset, offset + 200));
        if (generation !== generationRef.current) return;
        if (error) continue; // Keep the last known data on transient failures.
        const fresh = (data ?? []).filter((card) => requestsRef.current.get(card.id) === versions.get(card.id));
        if (fresh.length) onCardsRef.current(fresh);
      }
    } catch {
      // Background synchronization must never block editing or clear cards.
    }
  }, [enabled, panelId]);

  useEffect(() => {
    generationRef.current += 1;
    if (!enabled) return;
    let polling = false;
    const sync = async () => {
      if (document.visibilityState === "hidden" || polling) return;
      polling = true;
      try { await refreshCards(idsKey ? idsKey.split(",") : []); }
      finally { polling = false; }
    };
    const interval = window.setInterval(() => void sync(), COMMERCIAL_SYNC_INTERVAL_MS);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      generationRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled, idsKey, refreshCards]);

  return useCallback((id: string) => refreshCards([id]), [refreshCards]);
}