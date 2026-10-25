import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { ldb } from "../lib/db";
import { listsKey, useBuyer } from "../lib/queries";
import { useComprasRoles } from "../lib/roles";

/** Quem faz as compras desta loja: o "Enviar lista" já vai para o WhatsApp dessa pessoa. */
export function CompradorPage() {
  const { activeUnitId, activeUnit } = useWorkspace();
  const { canManage } = useComprasRoles();
  const queryClient = useQueryClient();
  const buyer = useBuyer(activeUnitId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    setName(buyer.data?.name ?? "");
    setPhone(buyer.data?.phone ?? "");
  }, [buyer.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await ldb
        .from("shopping_buyers")
        .upsert({ unit_id: activeUnitId!, name: name.trim(), phone: phone.trim() || null }, { onConflict: "unit_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Salvo. O envio das listas já vai para essa pessoa.");
      void queryClient.invalidateQueries({ queryKey: listsKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma loja" />;
  if (!canManage) return <EmptyState title="Só dono, administrador ou gerente alteram quem faz as compras." />;
  if (buyer.isLoading) return <LoadingState />;
  const digits = phone.replace(/\D/g, "");

  return (
    <>
      <PageHeader title="Quem faz as compras" description={`Para onde vão as listas da ${activeUnit?.name ?? "loja"}.`} />
      <SectionCard>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="buyer-name">Nome</Label>
            <Input id="buyer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João" className="w-56" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-phone">WhatsApp</Label>
            <Input id="buyer-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(12) 99999-0000" className="w-48" />
          </div>
          <Button type="submit" disabled={!name.trim() || save.isPending}>
            Salvar
          </Button>
        </form>
        {phone && digits.length < 10 ? <p className="mt-2 text-sm text-destructive">Confira o número: use DDD + telefone.</p> : null}
      </SectionCard>
    </>
  );
}
