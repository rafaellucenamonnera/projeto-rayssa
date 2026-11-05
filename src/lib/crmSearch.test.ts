import { describe, it, expect } from "vitest";
import { matchesCrmSearch, formatCnpj } from "./crmSearch";

const card = { full_name: "Farmácia São João", contratante_monnera: "Rede Popular", focal_name: "Maria da Silva", cnpj: "12345678000190", phone: "(11) 98765-4321", codigo_monnera: "AB12CD34" };

describe("matchesCrmSearch", () => {
  it("CNPJ formatado e só dígitos", () => {
    expect(matchesCrmSearch(card, "12.345.678/0001-90")).toBe(true);
    expect(matchesCrmSearch(card, "12345678")).toBe(true);
  });
  it("telefone", () => expect(matchesCrmSearch(card, "98765-4321")).toBe(true));
  it("sem acento", () => expect(matchesCrmSearch(card, "farmacia sao joao")).toBe(true));
  it("ordem das palavras", () => expect(matchesCrmSearch(card, "silva maria")).toBe(true));
  it("erro de 1 letra", () => expect(matchesCrmSearch(card, "farmasia")).toBe(true));
  it("contratante e código", () => {
    expect(matchesCrmSearch(card, "popular")).toBe(true);
    expect(matchesCrmSearch(card, "ab12cd34")).toBe(true);
  });
  it("sem resultado", () => expect(matchesCrmSearch(card, "drogasil")).toBe(false));
  it("formata CNPJ", () => expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90"));
});
