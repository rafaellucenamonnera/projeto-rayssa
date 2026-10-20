import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysWithoutUpdate, staleLevel } from "@/lib/commercialPanel";
import { COMMERCIAL_SYNC_INTERVAL_MS, useCommercialCardSync } from "./useCommercialCardSync";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ in: read }) }) }) },
}));

describe("commercial card synchronization", () => {
  beforeEach(() => { vi.useFakeTimers(); read.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it("reads the saved activity timestamp immediately after a comment without a page reload", async () => {
    const now = Date.now();
    const card = { id: "card-1", status_lead: "novo_lead", ultima_atualizacao_at: new Date(now - 3 * 86400000).toISOString() };
    expect(staleLevel(daysWithoutUpdate(card.ultima_atualizacao_at, card.status_lead, now))).toBe("red");
    read.mockResolvedValue({ data: [{ ...card, ultima_atualizacao_at: new Date(now).toISOString() }], error: null });
    const onCards = vi.fn();
    const { result } = renderHook(() => useCommercialCardSync(true, "comercial", [card.id], onCards));
    await act(async () => { await result.current(card.id); });
    const saved = onCards.mock.calls[0][0][0];
    expect(staleLevel(daysWithoutUpdate(saved.ultima_atualizacao_at, saved.status_lead, now))).toBeNull();
  });

  it.each(["emitida", "aberta", "aceita"])("refreshes persisted proposal status %s automatically", async (status) => {
    read.mockResolvedValue({ data: [{ id: "card-1", proposta_status: status }], error: null });
    const onCards = vi.fn();
    const { unmount } = renderHook(() => useCommercialCardSync(true, "comercial", ["card-1"], onCards));
    await act(async () => { await vi.advanceTimersByTimeAsync(COMMERCIAL_SYNC_INTERVAL_MS); });
    expect(onCards).toHaveBeenCalledWith([{ id: "card-1", proposta_status: status }]);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(COMMERCIAL_SYNC_INTERVAL_MS); });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps existing cards when a background read fails", async () => {
    read.mockResolvedValue({ data: null, error: { message: "network" } });
    const onCards = vi.fn();
    const { result } = renderHook(() => useCommercialCardSync(true, "comercial", ["card-1"], onCards));
    await act(async () => { await result.current("card-1"); });
    expect(onCards).not.toHaveBeenCalled();
  });

  it("does not let an older response overwrite a newer saved card", async () => {
    let resolveOld: (value: unknown) => void = () => undefined;
    read.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: "card-1", proposta_status: "aceita" }], error: null });
    const onCards = vi.fn();
    const { result } = renderHook(() => useCommercialCardSync(true, "comercial", ["card-1"], onCards));
    await act(async () => {
      const older = result.current("card-1");
      await result.current("card-1");
      resolveOld({ data: [{ id: "card-1", proposta_status: "aberta" }], error: null });
      await older;
    });
    expect(onCards).toHaveBeenCalledTimes(1);
    expect(onCards).toHaveBeenCalledWith([{ id: "card-1", proposta_status: "aceita" }]);
  });
});