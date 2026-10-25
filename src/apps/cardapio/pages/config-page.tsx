import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { dmdb } from "../lib/db";
import { dmKey, useStore } from "../lib/queries";
import { useCardapioRoles } from "../lib/roles";
import { slugify, validSlug } from "../lib/rules";

/** Configurações do cardápio da loja: endereço (link), nome, aberto/fechado, mesa/retirada, aviso, WhatsApp. */
export function CardapioConfigPage() {
  const { activeUnitId, activeUnit, company, units } = useWorkspace();
  const { canManage } = useCardapioRoles();
  const queryClient = useQueryClient();
  const store = useStore(activeUnitId);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [table, setTable] = useState(true);
  const [pickup, setPickup] = useState(true);
  const [notice, setNotice] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    const s = store.data;
    const suggested = units.length > 1 ? `${company?.name ?? ""} ${activeUnit?.name ?? ""}` : (company?.name ?? "");
    setSlug(s?.slug ?? slugify(suggested));
    setName(s?.display_name ?? (units.length > 1 ? `${company?.name ?? ""} · ${activeUnit?.name ?? ""}` : (company?.name ?? "")));
    setIsOpen(s?.is_open ?? false);
    setTable(s?.accepts_table ?? true);
    setPickup(s?.accepts_pickup ?? true);
    setNotice(s?.notice ?? "");
    setWhatsapp(s?.whatsapp ?? "");
  }, [store.data, company?.name, activeUnit?.name, units.length]);

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        slug,
        display_name: name.trim(),
        is_open: isOpen,
        accepts_table: table,
        accepts_pickup: pickup,
        notice: notice.trim() || null,
        whatsapp: whatsapp.replace(/\D/g, "") || null,
      };
      const { error } = store.data
        ? await dmdb.from("dm_stores").update(fields).eq("unit_id", activeUnitId!)
        : await dmdb.from("dm_stores").insert({ ...fields, unit_id: activeUnitId! });
      if (error) throw new Error(error.message.includes("dm_stores_slug_key") ? "Esse endereço já está em uso. Escolha outro." : error.message);
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      void queryClient.invalidateQueries({ queryKey: dmKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (!canManage) return <EmptyState title="Só dono, administrador ou gerente alteram as configurações." />;
  if (store.isLoading) return <LoadingState />;
  const valid = validSlug(slug) && name.trim().length > 0 && (table || pickup);

  return (
    <>
      <PageHeader title="Configurações do cardápio" description={activeUnit?.name ?? ""} />
      <SectionCard>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cf-slug">Endereço do cardápio</Label>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-muted-foreground">myfoodsai.com/c/</span>
              <Input id="cf-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="w-64" maxLength={40} />
            </div>
            {store.data && slug !== store.data.slug ? (
              <p className="text-sm text-destructive">Atenção: mudar o endereço invalida o link e os QR codes já impressos.</p>
            ) : null}
            {!validSlug(slug) ? <p className="text-sm text-muted-foreground">Use de 3 a 40 letras, números e hífens.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">Nome que o cliente vê</Label>
            <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="max-w-md" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch checked={isOpen} onCheckedChange={setIsOpen} /> Aberto para pedidos
          </label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={table} onCheckedChange={setTable} /> Pedido na mesa (QR code)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={pickup} onCheckedChange={setPickup} /> Retirada no balcão (link)
            </label>
          </div>
          {!table && !pickup ? <p className="text-sm text-destructive">Deixe pelo menos uma forma de pedido ligada.</p> : null}
          <div className="space-y-1.5">
            <Label htmlFor="cf-notice">Aviso no topo do cardápio (opcional)</Label>
            <Input id="cf-notice" value={notice} onChange={(e) => setNotice(e.target.value)} maxLength={200} className="max-w-xl" placeholder="Ex.: Hoje temos pão de queijo saindo do forno às 16h!" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-wpp">WhatsApp da loja (opcional)</Label>
            <Input id="cf-wpp" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} className="w-56" placeholder="(12) 99999-0000" />
          </div>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando…" : store.data ? "Salvar" : "Criar cardápio da loja"}
          </Button>
        </div>
      </SectionCard>
    </>
  );
}
