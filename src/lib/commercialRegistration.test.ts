import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(`${process.cwd()}/drizzle/migrations/0011_commercial_card_registration.sql`, "utf8");
const completion = readFileSync(`${process.cwd()}/drizzle/migrations/0013_registration_without_store_records.sql`, "utf8");
const issuance = migration.split("CREATE OR REPLACE FUNCTION public.ensure_lead_completion_token")[1].split("CREATE OR REPLACE FUNCTION public.complete_lead_by_token")[0];

describe("client registration persistence rules", () => {
  it("does not create commercial cards for submitted stores", () => {
    expect(completion).not.toMatch(/INSERT\s+INTO\s+public\.leads/i);
    expect(completion).not.toMatch(/INSERT\s+INTO\s+public\.lojas/i);
    expect(completion).toContain("quantidade_lojas=v_qtd");
  });
  it("preserves the card stage when completing registration", () => {
    expect(completion).not.toMatch(/status(?:_lead)?\s*=/i);
    expect(completion).toContain("WHERE id=v_lead_id");
  });
  it("offers token issuance without requiring a Kanban stage", () => {
    expect(issuance).not.toContain("status_lead");
    expect(issuance).toContain("IF auth.uid() IS NULL");
  });
  it("retains registration data separately from the main card", () => {
    expect(completion).toContain("cadastro_cliente_data=v_data");
    expect(completion).toContain("cadastro_cliente_recebido_at=now()");
  });
});