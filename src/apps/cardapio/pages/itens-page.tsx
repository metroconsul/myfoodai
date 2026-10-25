import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Plus } from "lucide-react";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { parseNumber } from "@/lib/parse-number";
import { dmdb, photoUrl, type DmItem } from "../lib/db";
import { compressPhoto } from "../lib/photo";
import { dmKey, useItems } from "../lib/queries";
import { useCardapioRoles } from "../lib/roles";
import { byCategory } from "../lib/rules";

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Itens do cardápio da loja. Equipe: esgotado/disponível. Gestão: criar, editar, foto, tirar do cardápio. */
export function ItensPage() {
  const { activeUnitId } = useWorkspace();
  const { canManage } = useCardapioRoles();
  const queryClient = useQueryClient();
  const items = useItems(activeUnitId);
  const [editing, setEditing] = useState<DmItem | "novo" | null>(null);

  const setAvailable = useMutation({
    mutationFn: async (v: { id: string; available: boolean }) => {
      const { error } = await dmdb.from("dm_items").update({ available: v.available }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: dmKey }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (items.isLoading) return <LoadingState />;
  const list = items.data ?? [];

  return (
    <>
      <PageHeader
        title="Cardápio"
        description="Marque “esgotado” quando acabar: o cliente vê na hora."
        actions={
          canManage ? (
            <Button onClick={() => setEditing("novo")}>
              <Plus className="mr-2 size-4" aria-hidden /> Novo item
            </Button>
          ) : undefined
        }
      />
      {list.length === 0 ? (
        <EmptyState title="Nenhum item no cardápio" description={canManage ? "Cadastre o primeiro em “Novo item”." : "A gestão ainda não montou o cardápio."} />
      ) : (
        byCategory(list).map(([cat, group]) => (
          <SectionCard key={cat} title={cat}>
            <ul className="divide-y divide-foreground/15">
              {group.map((i) => {
                const photo = photoUrl(i.photo_path);
                return (
                  <li key={i.id} className="flex items-center gap-3 py-2">
                    {photo ? <img src={photo} alt="" className="size-12 shrink-0 rounded-[8px] object-cover" /> : <span className="size-12 shrink-0 rounded-[8px] bg-secondary" />}
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                      disabled={!canManage}
                      onClick={() => setEditing(i)}
                      title={canManage ? "Editar" : undefined}
                    >
                      <span className={cn("block font-semibold", !i.active && "text-muted-foreground line-through")}>
                        {i.name} · {brl(Number(i.price))}
                      </span>
                      <span className="meta-mono">{!i.active ? "fora do cardápio" : i.description ? i.description.slice(0, 80) : ""}</span>
                    </button>
                    {i.active ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={i.available} onCheckedChange={(available) => setAvailable.mutate({ id: i.id, available })} />
                        <span className={i.available ? "" : "font-semibold text-destructive"}>{i.available ? "Disponível" : "Esgotado"}</span>
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ))
      )}
      {canManage ? (
        <ItemDialog
          open={editing !== null}
          item={editing === "novo" ? null : editing}
          categories={[...new Set(list.map((i) => i.category).filter((c): c is string => Boolean(c)))]}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ItemDialog({ open, item, categories, onClose }: { open: boolean; item: DmItem | null; categories: string[]; onClose: () => void }) {
  const { company, activeUnitId } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const key = open ? (item?.id ?? "novo") : null;
  if (key !== openKey) {
    setOpenKey(key);
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setCategory(item?.category ?? "");
    setPrice(item ? String(item.price).replace(".", ",") : "");
    setActive(item?.active ?? true);
    setPhoto(null);
    setPreview(photoUrl(item?.photo_path));
  }

  const value = parseNumber(price);
  const valid = name.trim().length > 0 && Number.isFinite(value) && value >= 0 && value < 100000;

  const save = useMutation({
    mutationFn: async () => {
      let photo_path = item?.photo_path ?? null;
      if (photo) {
        const path = `${company!.id}/${activeUnitId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("menu-photos").upload(path, photo, { contentType: "image/jpeg" });
        if (upErr) throw new Error(`Foto: ${upErr.message}`);
        if (photo_path) await supabase.storage.from("menu-photos").remove([photo_path]);
        photo_path = path;
      }
      const fields = { name: name.trim(), description: description.trim() || null, category: category.trim() || null, price: Math.round(value * 100) / 100, active, photo_path };
      const { error } = item
        ? await dmdb.from("dm_items").update(fields).eq("id", item.id)
        : await dmdb.from("dm_items").insert({ ...fields, unit_id: activeUnitId! });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(item ? "Item atualizado." : "Item adicionado ao cardápio.");
      void queryClient.invalidateQueries({ queryKey: dmKey });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3">
          <label className="flex size-24 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[10px] border-2 border-dashed border-foreground text-center text-xs">
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : (
              <>
                <ImagePlus className="mb-1 size-5" aria-hidden /> Foto
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const blob = await compressPhoto(f);
                  setPhoto(blob);
                  setPreview(URL.createObjectURL(blob));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Foto inválida.");
                }
              }}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="it-name">Nome</Label>
              <Input id="it-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Cappuccino" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="it-price">Preço</Label>
                <Input id="it-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="it-cat">Categoria</Label>
                <Input id="it-cat" list="it-categories" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} placeholder="Ex.: Bebidas" />
                <datalist id="it-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="it-desc">Descrição (opcional)</Label>
          <Input id="it-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Ex.: Espresso, leite vaporizado e canela" />
        </div>
        {item ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> No cardápio (desligado: some para o cliente)
          </label>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
