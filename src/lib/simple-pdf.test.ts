import { describe, expect, it } from "vitest";
import { buildPdf, pdfText, wrap } from "./simple-pdf";

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("simple-pdf", () => {
  it("codifica acentos em WinAnsi e escapa parênteses", () => {
    expect(pdfText("Açúcar (1 kg) — ok")).toBe("A\xE7\xFAcar \\(1 kg\\) \x97 ok");
    expect(pdfText("😀")).toBe("?");
  });

  it("quebra texto longo em linhas", () => {
    expect(wrap("um dois três quatro cinco seis", 12, 80).length).toBeGreaterThan(1);
    expect(wrap("", 12, 200)).toEqual([""]);
  });

  it("gera um PDF válido com xref correto e paginação", () => {
    const lines = [{ kind: "title" as const, text: "Compras de segunda" }, ...Array.from({ length: 80 }, (_, i) => ({ kind: "item" as const, text: `Item ${i}`, detail: "2 kg", checked: i % 2 === 0 }))];
    const s = latin1(buildPdf(lines, "Ramos Food"));
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    const pages = Number(/\/Count (\d+)/.exec(s)![1]);
    expect(pages).toBeGreaterThan(1);
    // Cada deslocamento do xref aponta para o início do objeto correspondente.
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
    const entries = s.slice(xrefAt).split("\n").slice(3, 3 + 4 + pages * 2);
    entries.forEach((e, i) => expect(s.slice(Number(e.slice(0, 10))).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
    expect(s).toContain("página 1 de");
  });
});
