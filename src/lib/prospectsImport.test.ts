import { describe, expect, it } from "vitest";
import { parseProspectRows } from "./prospectsImport";

const ctx = { parceiros: [{ id: "p1", nome: "Ana Souza" }], vendedores: [{ user_id: "u1", nome: "Carlos" }] };
const row = (o: Record<string, string> = {}) => ({
  "Empresa (Razão Social) *": "ACME", "Canal *": "Prospecção", "Contato - Nome *": "João", ...o,
});

describe("importação Lista Prospects", () => {
  it("linha mínima válida", () => {
    const r = parseProspectRows([row()], ctx);
    expect(r.errors).toEqual([]);
    expect(r.ok[0].canal).toBe("prospeccao");
  });
  it("Canal obrigatório", () => {
    expect(parseProspectRows([row({ "Canal *": "" })], ctx).errors[0].erros).toContain("Canal obrigatório");
  });
  it("Parceiros exige embaixador", () => {
    expect(parseProspectRows([row({ "Canal *": "Parceiros" })], ctx).errors[0].erros)
      .toContain("Canal Parceiros exige o Embaixador Monnera que indicou");
  });
  it("CNPJ com tamanho errado é recusado", () => {
    expect(parseProspectRows([row({ CNPJ: "123" })], ctx).errors[0].erros).toContain("CNPJ precisa ter 14 números");
  });
  it("vendedor pelo nome", () => {
    expect(parseProspectRows([row({ "Vendedor Responsável": "carlos" })], ctx).ok[0].responsible_user_id).toBe("u1");
  });
  it("linhas vazias são ignoradas", () => {
    expect(parseProspectRows([{}], ctx)).toEqual({ ok: [], errors: [] });
  });
});
