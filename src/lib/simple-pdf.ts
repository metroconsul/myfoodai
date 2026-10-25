/**
 * Gerador de PDF mínimo, sem dependências: texto em Helvetica (com acentos via WinAnsi), linhas com caixinha
 * de marcar e paginação automática em A4. Feito para listas (ex.: lista de compras).
 */

export type PdfLine =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "item"; text: string; detail?: string | null; checked?: boolean }
  | { kind: "gap" };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;

// Caracteres fora do Latin-1 que existem no WinAnsi (aspas, travessão, marcador, euro).
const WIN_ANSI_EXTRA: Record<string, number> = { "€": 0x80, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };

/** Texto → bytes WinAnsi dentro de uma string literal de PDF (escapa parênteses e barra). */
export function pdfText(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    let b: number;
    if (code >= 0x20 && code < 0x7f) b = code;
    else if (code >= 0xa0 && code <= 0xff) b = code;
    else if (WIN_ANSI_EXTRA[ch] !== undefined) b = WIN_ANSI_EXTRA[ch]!;
    else if (ch === "\t") b = 0x20;
    else b = 0x3f; // "?"
    const c = String.fromCharCode(b);
    out += c === "(" || c === ")" || c === "\\" ? `\\${c}` : c;
  }
  return out;
}

/** Corta um texto longo em linhas que cabem na largura (estimativa pela largura média da Helvetica). */
export function wrap(text: string, size: number, width: number): string[] {
  const max = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Monta o PDF e devolve os bytes. */
export function buildPdf(lines: PdfLine[], footer?: string): Uint8Array<ArrayBuffer> {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    if (ops.length) pages.push(ops.join("\n"));
    ops = [];
    y = PAGE_H - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN + 20) newPage();
  };
  const text = (font: "F1" | "F2", size: number, x: number, yy: number, s: string, gray = false) => {
    ops.push(`${gray ? "0.55 g" : "0 g"} BT /${font} ${size} Tf ${x} ${yy.toFixed(1)} Td (${pdfText(s)}) Tj ET`);
  };

  for (const l of lines) {
    if (l.kind === "gap") {
      y -= 10;
      continue;
    }
    if (l.kind === "title") {
      for (const part of wrap(l.text, 20, PAGE_W - 2 * MARGIN)) {
        ensure(26);
        text("F2", 20, MARGIN, y - 20, part);
        y -= 26;
      }
      continue;
    }
    if (l.kind === "subtitle") {
      for (const part of wrap(l.text, 10, PAGE_W - 2 * MARGIN)) {
        ensure(15);
        text("F1", 10, MARGIN, y - 10, part, true);
        y -= 15;
      }
      continue;
    }
    // Item: caixinha + nome em negrito + quantidade à direita (comprados em cinza, com a caixinha marcada).
    const detailW = l.detail ? Math.min(160, l.detail.length * 12 * 0.52 + 10) : 0;
    const parts = wrap(l.text, 12, PAGE_W - 2 * MARGIN - 24 - detailW);
    const h = parts.length * 16 + 6;
    ensure(h);
    const top = y - 14;
    ops.push(`${l.checked ? "0.55 G" : "0 G"} 1 w ${MARGIN} ${(top - 1).toFixed(1)} 11 11 re S`);
    if (l.checked) ops.push(`0.55 G 1.5 w ${MARGIN + 2} ${(top + 4).toFixed(1)} m ${MARGIN + 5} ${(top + 1).toFixed(1)} l ${MARGIN + 10} ${(top + 9).toFixed(1)} l S`);
    parts.forEach((p, i) => text("F2", 12, MARGIN + 20, top - i * 16, p, Boolean(l.checked)));
    if (l.detail) text("F1", 12, PAGE_W - MARGIN - detailW + 10, top, l.detail, Boolean(l.checked));
    y -= h;
    ops.push(`0.85 G 0.5 w ${MARGIN} ${(y + 2).toFixed(1)} m ${PAGE_W - MARGIN} ${(y + 2).toFixed(1)} l S`);
  }
  newPage();
  if (pages.length === 0) pages.push("");

  // Objetos: 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold, depois (página, conteúdo) por página.
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => {
    const footerOps = footer
      ? `\n0.55 g BT /F1 9 Tf ${MARGIN} 30 Td (${pdfText(`${footer} · página ${i + 1} de ${pages.length}`)}) Tj ET`
      : "";
    const stream = content + footerOps;
    objs[pageIds[i]!] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R >>`;
    objs[pageIds[i]! + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
