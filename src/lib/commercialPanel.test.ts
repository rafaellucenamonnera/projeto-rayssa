import { describe, expect, it } from "vitest";
import { daysWithoutUpdate, staleLevel, missingQualification, validateNewCommercialCard, isCommercialLostStage, validateLostReason, COMMERCIAL_STAGE_MQL, COMMERCIAL_STAGE_PROSPECTS, COMMERCIAL_STAGE_PERDIDOS } from "./commercialPanel";

describe("motivo da perda", () => {
  it("reconhece Perdidos configurado e legado", () => {
    expect(isCommercialLostStage(COMMERCIAL_STAGE_PERDIDOS)).toBe(true);
    expect(isCommercialLostStage("lead_perdido")).toBe(true);
    expect(isCommercialLostStage("outra-coluna", "PERDIDOS")).toBe(true);
    expect(isCommercialLostStage(COMMERCIAL_STAGE_MQL, "MQL")).toBe(false);
  });
  it("exige texto não vazio", () => {
    expect(validateLostReason("")).not.toBeNull();
    expect(validateLostReason("   \n ")).not.toBeNull();
    expect(validateLostReason("Cliente decidiu não prosseguir.")).toBeNull();
  });
  it("mantém o limite existente de 200 caracteres", () => {
    expect(validateLostReason("a".repeat(200))).toBeNull();
    expect(validateLostReason("a".repeat(201))).not.toBeNull();
  });
});

describe("missingQualification", () => {
  it("Lista Prospects aceita card sem qualificação", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_PROSPECTS)).toEqual([]);
  });
  it("MQL exige só Mercado e Tipo", () => {
    expect(missingQualification({ canal: "eventos" }, COMMERCIAL_STAGE_MQL)).toEqual(["Mercado", "Tipo"]);
  });
  it("até Reunião Realizada Impacto e Temperatura são opcionais", () => {
    const q = { mercado: "pet", tipo_negocio: "varejo", canal: "eventos" };
    expect(missingQualification(q, "novo_lead")).toEqual([]);
    expect(missingQualification(q, "reuniao_agendada")).toEqual([]);
    expect(missingQualification(q, "reuniao_realizada")).toEqual([]);
  });
  it("sair de Reunião Realizada exige Impacto, Temperatura, lojas, vendedores e premiação", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", canal: "eventos" }, "proposta_enviada")).toEqual(["Impacto", "Temperatura", "Número de lojas", "Número de vendedores", "Valor pago em premiação"]);
  });
  it("lojas, vendedores e premiação são opcionais até Reunião Realizada", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", canal: "eventos" }, "reuniao_realizada")).toEqual([]);
  });
  it("card completo pode avançar", () => {
    expect(missingQualification({ mercado: "pet", tipo_negocio: "varejo", impacto: "alto", temperatura: "quente", canal: "eventos", quantidade_lojas: 3, numero_vendedores: 10, volume_premiacao_comissao: 0 }, "proposta_enviada")).toEqual([]);
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
