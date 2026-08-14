import type { ToolContext } from "@lovable.dev/mcp-js";

export function requireAuth(ctx: ToolContext): string {
  if (!ctx.isAuthenticated()) throw new Error("Não autenticado");
  const userId = ctx.getUserId();
  if (!userId) throw new Error("Não foi possível identificar o usuário");
  return userId;
}

export function ok(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function onlyDigits(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length ? digits : null;
}

export const CROSS_PANEL_ID = "painel_msj9fyji";
