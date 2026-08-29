import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { BRAND_NAME } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const TYPES: Enums<"unit_type">[] = [
  "restaurante",
  "bar",
  "cafeteria",
  "lanchonete",
  "padaria",
  "cozinha",
  "varejo",
  "outro",
];

export const Route = createFileRoute("/_authenticated/app/units")({
  head: () => ({
    meta: [
      { title: `Unidades — ${BRAND_NAME}` },
      { name: "description", content: "Cadastro de unidades, endereço e raio permitido para o ponto." },
      { property: "og:title", content: `Unidades — ${BRAND_NAME}` },
      { property: "og:description", content: "Gestão de unidades e geocerca do ponto." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnitsPage,
});

function UnitsPage() {
  const { company, refresh } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "restaurante" as Enums<"unit_type">,
    address: "",
    city: "",
    latitude: "",
    longitude: "",
    radius: "150",
  });

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const createUnit = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Empresa não encontrada.");
      const { error } = await supabase.from("units").insert({
        company_id: company.id,
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        point_radius_meters: Number(form.radius) || 150,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unidade criada.");
      setOpen(false);
      setForm({ ...form, name: "", address: "", city: "", latitude: "", longitude: "" });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar unidade."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("units").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      refresh();
    },
  });

  return (
    <>
      <PageHeader
        title="Unidades"
        description="Cada unidade tem endereço, coordenadas e raio permitido para o registro de ponto."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nova unidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova unidade</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createUnit.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as Enums<"unit_type"> })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="radius">Raio do ponto (m)</Label>
                    <Input
                      id="radius"
                      type="number"
                      min={20}
                      max={5000}
                      value={form.radius}
                      onChange={(e) => setForm({ ...form, radius: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lat">Latitude</Label>
                    <Input
                      id="lat"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lng">Longitude</Label>
                    <Input
                      id="lng"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createUnit.isPending}>
                  Salvar unidade
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <SectionCard>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : units.length === 0 ? (
          <EmptyState title="Nenhuma unidade cadastrada" description="Crie a primeira unidade da operação." />
        ) : (
          <ul className="divide-y divide-border">
            {units.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.type} · {u.city ?? "sem cidade"} · raio {u.point_radius_meters}m
                    {u.latitude && u.longitude ? " · com coordenadas" : " · sem coordenadas"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={u.active ? "ok" : "neutral"}>{u.active ? "Ativa" : "Inativa"}</StatusBadge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                  >
                    {u.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
