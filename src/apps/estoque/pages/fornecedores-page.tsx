import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, LoadingState, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { estoqueKey, useSuppliers } from "../lib/queries";

/** Fornecedores (simples). Aparecem ao registrar uma entrada; o futuro MyFoods Compras usa o mesmo cadastro. */
export function FornecedoresPage() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", email: "" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...estoqueKey, "suppliers"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({
        company_id: company!.id,
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: "", contact_name: "", phone: "", email: "" });
      toast.success("Fornecedor cadastrado.");
      void refresh();
    },
    onError: () => toast.error("Não foi possível cadastrar."),
  });
  const toggle = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase.from("suppliers").update({ active: v.active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: () => toast.error("Não foi possível atualizar."),
  });

  return (
    <>
      <PageHeader title="Fornecedores" description="De quem a empresa compra. Usado nas entradas de estoque." />
      <SectionCard title="Novo fornecedor">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name.trim()) add.mutate();
          }}
        >
          {(
            [
              ["name", "Nome", "Ex.: Laticínios Vale"],
              ["contact_name", "Contato", "Opcional"],
              ["phone", "Telefone", "Opcional"],
              ["email", "E-mail", "Opcional"],
            ] as const
          ).map(([k, label, ph]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`sp-${k}`}>{label}</Label>
              <Input id={`sp-${k}`} value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-48" />
            </div>
          ))}
          <Button type="submit" disabled={!form.name.trim() || add.isPending}>
            Adicionar
          </Button>
        </form>
      </SectionCard>
      <SectionCard title="Cadastrados">
        {suppliers.isLoading ? (
          <LoadingState />
        ) : (suppliers.data ?? []).length === 0 ? (
          <EmptyState title="Nenhum fornecedor" />
        ) : (
          <ul className="divide-y divide-foreground/15">
            {(suppliers.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  <span className="meta-mono">{[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") || "sem contato"}</span>
                </span>
                <Switch checked={s.active} onCheckedChange={(active) => toggle.mutate({ id: s.id, active })} aria-label={`${s.name} ${s.active ? "ativo" : "inativo"}`} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
