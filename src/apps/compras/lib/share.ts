import { buildPdf, type PdfLine } from "@/lib/simple-pdf";
import { whatsappLink } from "./rules";

/** Ações de navegador para a lista: baixar o PDF e enviar (compartilhar no celular; no computador, baixa + WhatsApp). */

export function downloadPdf(bytes: Uint8Array<ArrayBuffer>, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function makePdf(lines: PdfLine[]) {
  return buildPdf(lines, "Lista gerada pelo MyFoods Compras");
}

/**
 * Envia a lista: onde o navegador permite compartilhar arquivos (celular), abre o "Compartilhar" com o PDF
 * (WhatsApp, e-mail…). Senão, baixa o PDF e abre o WhatsApp de quem faz as compras com o texto da lista.
 */
export async function sendList(o: { bytes: Uint8Array<ArrayBuffer>; name: string; title: string; text: string; phone?: string | null | undefined }) {
  const file = new File([o.bytes], o.name, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: o.title, text: o.text });
      return "shared" as const;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "canceled" as const;
    }
  }
  downloadPdf(o.bytes, o.name);
  window.open(whatsappLink(o.phone, o.text), "_blank", "noopener,noreferrer");
  return "downloaded" as const;
}
