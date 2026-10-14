import { describe, expect, it } from "vitest";
import { missingQualification, COMMERCIAL_STAGE_MQL, COMMERCIAL_STAGE_PROSPECTS, COMMERCIAL_STAGE_PERDIDOS } from "./commercialPanel";

describe("missingQualification", () => {
  it("Lista Prospects aceita card sem qualificação", () => {
    expect(missingQualification({}, COMMERCIAL_STAGE_PROSPECTS)).toEqual([]);
  });
  it("MQL exige Mercado, Tipo e Impacto", () => {
    expect(missingQualification({}, COMMERCIAL_STAGE_MQL)).toEqual(["Mercado", "Tipo", "Impacto"]);
  });
  it("colunas seguintes também exigem", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo" }, "reuniao_agendada")).toEqual(["Impacto"]);
  });
  it("card qualificado pode avançar", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", impacto: "alto" }, COMMERCIAL_STAGE_MQL)).toEqual([]);
  });
  it("Perdidos não exige", () => {
    expect(missingQualification({}, COMMERCIAL_STAGE_PERDIDOS)).toEqual([]);
  });
});
