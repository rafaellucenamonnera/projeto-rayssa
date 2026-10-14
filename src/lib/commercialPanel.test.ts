import { describe, expect, it } from "vitest";
import { missingQualification, validateNewCommercialCard, COMMERCIAL_STAGE_MQL, COMMERCIAL_STAGE_PROSPECTS, COMMERCIAL_STAGE_PERDIDOS } from "./commercialPanel";

describe("missingQualification", () => {
  it("Lista Prospects aceita card sem qualificação", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_PROSPECTS)).toEqual([]);
  });
  it("MQL exige Mercado, Tipo e Impacto", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_MQL)).toEqual(["Mercado", "Tipo", "Impacto"]);
  });
  it("colunas seguintes também exigem", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", canal: "eventos" }, "reuniao_agendada")).toEqual(["Impacto"]);
  });
  it("card qualificado pode avançar", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", impacto: "alto", canal: "eventos" }, COMMERCIAL_STAGE_MQL)).toEqual([]);
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
