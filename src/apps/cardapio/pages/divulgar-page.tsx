import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, MessageCircle } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildQrSheetPdf } from "@/lib/simple-pdf";
import { qrModules, qrSvg } from "../lib/qr";
import { useStore } from "../lib/queries";
import { useCardapioRoles } from "../lib/roles";
import { storeLink } from "../lib/rules";

function download(bytes: Uint8Array<ArrayBuffer>, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Link da loja para mandar ao cliente e QR codes para imprimir (um geral e um por mesa). */
export function DivulgarPage() {
  const { activeUnitId } = useWorkspace();
  const { canManage } = useCardapioRoles();
  const store = useStore(activeUnitId);
  const [tables, setTables] = useState("10");
  const [first, setFirst] = useState("1");
  const origin = typeof window !== "undefined" ? window.location.origin : "https://myfoodsai.com";
  const link = store.data ? storeLink(origin, store.data.slug) : "";
  const svg = useMemo(() => (link ? qrSvg(link) : ""), [link]);

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (store.isLoading) return <LoadingState />;
  if (!store.data) {
    return (
      <EmptyState
        title="Configure o cardápio primeiro"
        description="Defina o endereço do cardápio para gerar o link e os QR codes."
        action={
          canManage ? (
            <Button asChild>
              <Link to="/cardapio/configuracoes">Configurar</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  const s = store.data;
  const count = Math.min(Math.max(parseInt(tables, 10) || 0, 0), 60);
  const start = Math.max(parseInt(first, 10) || 1, 1);
  const message = `Faça seu pedido pelo nosso cardápio: ${link}`;

  return (
    <>
      <PageHeader title="Link e QR code" description="Mande o link para o cliente ou imprima os QR codes das mesas." />
      <SectionCard title="Link do cardápio">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[8px] bg-secondary px-3 py-2 text-sm">{link}</code>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => toast.success("Link copiado."));
            }}
          >
            <Copy className="mr-2 size-4" aria-hidden /> Copiar
          </Button>
          <Button variant="outline" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 size-4" aria-hidden /> Abrir
            </a>
          </Button>
          <Button asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 size-4" aria-hidden /> Enviar pelo WhatsApp
            </a>
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Pelo link, o cliente escolhe “estou na mesa” ou “vou retirar”.</p>
        {!s.is_open ? <p className="mt-2 text-sm font-semibold text-destructive">A loja está fechada para pedidos: o cliente vê o cardápio, mas não consegue pedir.</p> : null}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="QR code geral">
          <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: svg }} />
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={() => download(buildQrSheetPdf([{ label: s.display_name, sublabel: "Aponte a câmera e faça seu pedido", modules: qrModules(link) }]), `qr-${s.slug}.pdf`)}
          >
            <Download className="mr-2 size-4" aria-hidden /> Baixar PDF
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">Para o balcão, a vitrine ou as redes sociais.</p>
        </SectionCard>

        <SectionCard title="QR code das mesas">
          <p className="mb-3 text-sm text-muted-foreground">Cada mesa tem o seu: o pedido já chega com o número da mesa e entra na conta dela.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-n">Quantas mesas</Label>
              <Input id="qr-n" inputMode="numeric" value={tables} onChange={(e) => setTables(e.target.value)} className="w-24" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-first">Começando na mesa</Label>
              <Input id="qr-first" inputMode="numeric" value={first} onChange={(e) => setFirst(e.target.value)} className="w-24" />
            </div>
          </div>
          <Button
            className="mt-3 w-full"
            disabled={count === 0}
            onClick={() =>
              download(
                buildQrSheetPdf(
                  Array.from({ length: count }, (_, i) => {
                    const mesa = String(start + i);
                    return { label: `Mesa ${mesa}`, sublabel: `${s.display_name} · aponte a câmera e faça seu pedido`, modules: qrModules(storeLink(origin, s.slug, mesa)) };
                  }),
                  `${s.display_name} · QR codes das mesas`,
                ),
                `qr-mesas-${s.slug}.pdf`,
              )
            }
          >
            <Download className="mr-2 size-4" aria-hidden /> Baixar PDF ({count} {count === 1 ? "mesa" : "mesas"}, 6 por folha)
          </Button>
        </SectionCard>
      </div>
    </>
  );
}
