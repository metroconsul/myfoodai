import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, Plus, Send, Trash2, X } from "lucide-react";
import { EmptyState, LoadingState, SectionCard, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { dateTimeFmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ldb, type ListStatus, type ShoppingListItem } from "../lib/db";
import { listsKey, useBuyer, useList, useSuggestions } from "../lib/queries";
import { useComprasRoles } from "../lib/roles";
import { STATUS_LABEL, fileName, listMessage, pdfLines, sortItems, splitEntry } from "../lib/rules";
import { downloadPdf, makePdf, sendList } from "../lib/share";

/** Uma lista: anotar o que falta (nome + quantidade), marcar o que foi comprado, exportar em PDF e enviar. */
export function ListaPage({ id }: { id: string }) {
  const { company, activeUnit, activeUnitId } = useWorkspace();
  const { canManage } = useComprasRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const data = useList(id);
  const suggestions = useSuggestions(activeUnitId);
  const buyer = useBuyer(data.data?.list?.unit_id ?? activeUnitId);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: listsKey });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");

  const add = useMutation({
    mutationFn: async (v: { name: string; quantity: string | null }) => {
      const position = Math.max(-1, ...(data.data?.items ?? []).map((i) => i.position)) + 1;
      const { error } = await ldb.from("shopping_list_items").insert({ list_id: id, name: v.name, quantity: v.quantity, position });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setName("");
      setQuantity("");
      nameRef.current?.focus();
      void refresh();
    },
    onError: fail,
  });

  const updateItem = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Pick<ShoppingListItem, "name" | "quantity" | "checked">> }) => {
      const { error } = await ldb.from("shopping_list_items").update(v.patch).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await ldb.from("shopping_list_items").delete().eq("id", itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const updateList = useMutation({
    mutationFn: async (patch: { title?: string; status?: ListStatus }) => {
      const { error } = await ldb.from("shopping_lists").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void refresh(),
    onError: fail,
  });

  const removeList = useMutation({
    mutationFn: async () => {
      const { error } = await ldb.from("shopping_lists").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lista apagada.");
      void refresh();
      void navigate({ to: "/compras" });
    },
    onError: fail,
  });

  if (data.isLoading) return <LoadingState />;
  const list = data.data?.list;
  if (!list) return <EmptyState title="Lista não encontrada nesta loja" />;
  const items = sortItems(data.data?.items ?? []);
  const missing = items.filter((i) => !i.checked);
  const unitName = activeUnit?.name ?? "Loja";

  function submit() {
    const q = quantity.trim();
    const v = q ? { name: name.trim(), quantity: q } : splitEntry(name);
    if (!v.name) return;
    add.mutate(v);
  }

  function pdfBytes() {
    return makePdf(pdfLines({ title: list!.title, company: company?.name ?? "", unit: unitName, items }));
  }

  async function send() {
    if (missing.length === 0) {
      toast.info("Não há nada a comprar nesta lista.");
      return;
    }
    const result = await sendList({
      bytes: pdfBytes(),
      name: fileName(list!.title),
      title: list!.title,
      text: listMessage({ title: list!.title, unit: unitName, buyer: buyer.data?.name, items }),
      phone: buyer.data?.phone,
    });
    if (result === "canceled") return;
    if (list!.status === "aberta") updateList.mutate({ status: "enviada" });
    toast.success(result === "shared" ? "Lista enviada." : "PDF baixado e WhatsApp aberto com a lista.");
  }

  return (
    <>
      <Link to="/compras" className="inline-flex items-center gap-1 text-sm font-semibold underline">
        <ArrowLeft className="size-4" aria-hidden /> Listas
      </Link>

      <div className="space-y-1">
        <TitleInput value={list.title} onSave={(title) => updateList.mutate({ title })} />
        <p className="meta-mono flex flex-wrap items-center gap-2">
          <StatusBadge tone={list.status === "aberta" ? "neutral" : list.status === "enviada" ? "info" : "ok"}>{STATUS_LABEL[list.status]}</StatusBadge>
          {missing.length} a comprar · {items.length} no total · atualizada {dateTimeFmt(list.updated_at)}
          {list.sent_at ? ` · enviada ${dateTimeFmt(list.sent_at)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void send()} disabled={items.length === 0}>
          <Send className="mr-2 size-4" aria-hidden /> {buyer.data?.name ? `Enviar para ${buyer.data.name}` : "Enviar lista"}
        </Button>
        <Button variant="outline" disabled={items.length === 0} onClick={() => downloadPdf(pdfBytes(), fileName(list.title))}>
          <Download className="mr-2 size-4" aria-hidden /> Baixar PDF
        </Button>
        {list.status !== "concluida" ? (
          <Button variant="ghost" onClick={() => updateList.mutate({ status: "concluida" })}>
            <Check className="mr-2 size-4" aria-hidden /> Concluir
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => updateList.mutate({ status: "aberta" })}>
            Reabrir
          </Button>
        )}
        {canManage ? (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              if (window.confirm(`Apagar a lista “${list.title}”?`)) removeList.mutate();
            }}
          >
            <Trash2 className="mr-2 size-4" aria-hidden /> Apagar
          </Button>
        ) : null}
      </div>
      {!buyer.data && canManage ? (
        <p className="text-sm text-muted-foreground">
          Dica: cadastre{" "}
          <Link to="/compras/comprador" className="font-semibold underline">
            quem faz as compras
          </Link>{" "}
          para o envio já ir direto para essa pessoa.
        </p>
      ) : null}

      <SectionCard>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="min-w-48 flex-1">
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="ingredientes-sugeridos"
              placeholder="Ingrediente que falta (ex.: Leite)"
              aria-label="Ingrediente"
              autoFocus
            />
            <datalist id="ingredientes-sugeridos">
              {(suggestions.data ?? []).slice(0, 200).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantidade (ex.: 6 L)" aria-label="Quantidade" className="w-40" maxLength={40} />
          <Button type="submit" disabled={!name.trim() || add.isPending}>
            <Plus className="mr-2 size-4" aria-hidden /> Adicionar
          </Button>
        </form>

        {items.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Lista vazia" description="Anote acima o que está faltando. Dá para digitar tudo junto: “Leite 6 L”." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/15">
            {items.map((i) => (
              <ItemRow
                key={i.id}
                item={i}
                onToggle={() => updateItem.mutate({ id: i.id, patch: { checked: !i.checked } })}
                onSave={(patch) => updateItem.mutate({ id: i.id, patch })}
                onRemove={() => removeItem.mutate(i.id)}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== value) onSave(t);
        else setText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label="Título da lista"
      className="display-type w-full bg-transparent text-2xl outline-none focus:underline"
      maxLength={80}
    />
  );
}

function ItemRow({
  item,
  onToggle,
  onSave,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onSave: (patch: { name?: string; quantity?: string | null }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity ?? "");
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setQty(item.quantity ?? ""), [item.quantity]);

  return (
    <li className="flex items-center gap-2 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.checked ? `Desmarcar ${item.name}` : `Marcar ${item.name} como comprado`}
        onClick={onToggle}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground",
          item.checked ? "bg-accent" : "bg-card",
        )}
      >
        {item.checked ? <Check className="size-4" /> : null}
      </button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const t = name.trim();
          if (t && t !== item.name) onSave({ name: t });
          else setName(item.name);
        }}
        aria-label="Ingrediente"
        maxLength={120}
        className={cn("min-w-0 flex-1 bg-transparent py-1 font-medium outline-none focus:underline", item.checked && "text-muted-foreground line-through")}
      />
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={() => {
          const t = qty.trim();
          if (t !== (item.quantity ?? "")) onSave({ quantity: t || null });
        }}
        placeholder="qtd."
        aria-label="Quantidade"
        maxLength={40}
        className={cn("w-28 bg-transparent py-1 text-right text-sm outline-none focus:underline", item.checked && "text-muted-foreground line-through")}
      />
      <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.name}`} onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </li>
  );
}
