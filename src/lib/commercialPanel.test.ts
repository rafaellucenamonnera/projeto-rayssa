import { describe, expect, it } from "vitest";
import { daysWithoutUpdate, staleLevel, missingQualification, validateNewCommercialCard, COMMERCIAL_STAGE_MQL, COMMERCIAL_STAGE_PROSPECTS, COMMERCIAL_STAGE_PERDIDOS } from "./commercialPanel";

describe("missingQualification", () => {
  it("Lista Prospects aceita card sem qualificação", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_PROSPECTS)).toEqual([]);
  });
  it("MQL exige Mercado, Tipo e Impacto", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_MQL)).toEqual(["Mercado", "Tipo", "Impacto"]);
  });
  it("colunas seguintes também exigem", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", canal: "eventos" }, "reuniao_agendada")).toEqual(["Impacto", "Temperatura"]);
  });
  it("card qualificado pode avançar", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", impacto: "alto", canal: "eventos" }, COMMERCIAL_STAGE_MQL)).toEqual([]);
  });
  it("Temperatura obrigatória a partir de Lead (em contato)", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", impacto: "alto", canal: "eventos" }, "novo_lead")).toEqual(["Temperatura"]);
  });
  it("Perdidos não exige", () => {
    expect(missingQualification({}, COMMERCIAL_STAGE_PERDIDOS)).toEqual([]);
  });
  it("Canal é obrigatório já em Lista Prospects", () => {
    expect(missingQualification({}, COMMERCIAL_STAGE_PROSPECTS)).toEqual(["Canal"]);
  });
});

describe("validateNewCommercialCard", () => {
  const base = { razao_social: "ACME", canal: "eventos", contatos: [{ nome: "Ana", telefone: "" }] };
  it("card completo passa", () => expect(validateNewCommercialCard(base)).toEqual([]));
  it("Canal obrigatório", () => expect(validateNewCommercialCard({ ...base, canal: "" })).toEqual(["Canal"]));
  it("Parceiros exige o embaixador", () =>
    expect(validateNewCommercialCard({ ...base, canal: "parceiros" })).toEqual(["Embaixador Monnera que indicou"]));
});

describe("dias sem atualização", () => {
  const now = new Date("2026-10-14T12:00:00Z").getTime();
  const ago = (d: number) => new Date(now - d * 86400000).toISOString();
  it("2 dias = amarelo", () => expect(staleLevel(daysWithoutUpdate(ago(2), "novo_lead", now))).toBe("yellow"));
  it("3 dias = vermelho", () => expect(staleLevel(daysWithoutUpdate(ago(3), "novo_lead", now))).toBe("red"));
  it("atualizado hoje sem linha", () => expect(staleLevel(daysWithoutUpdate(ago(0), "novo_lead", now))).toBe(null));
  it("Contrato Assinado em diante não conta", () => {
    expect(daysWithoutUpdate(ago(9), "contrato_assinado", now)).toBe(null);
    expect(daysWithoutUpdate(ago(9), "etapa_comercial_kickoff", now)).toBe(null);
  });
  it("vale de MQL até Contrato Enviado, não em Lista Prospects", () => {
    expect(daysWithoutUpdate(ago(3), "etapa_comercial_mql", now)).toBe(3);
    expect(daysWithoutUpdate(ago(3), "contrato_enviado", now)).toBe(3);
    expect(daysWithoutUpdate(ago(3), "etapa_comercial_prospects", now)).toBe(null);
  });
});
