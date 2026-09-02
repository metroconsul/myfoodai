import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { bootstrapCompany } from "@/lib/admin.functions";
import { BRAND_NAME } from "@/config/brand";
import { resumePendingCheckout } from "@/lib/pending-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const UNIT_TYPES = [
  { value: "restaurante", label: "Restaurante" },
  { value: "bar", label: "Bar" },
  { value: "cafeteria", label: "Cafeteria" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "padaria", label: "Padaria" },
  { value: "cozinha", label: "Cozinha profissional" },
  { value: "varejo", label: "Varejo" },
  { value: "outro", label: "Outro" },
] as const;

type UnitType = (typeof UNIT_TYPES)[number]["value"];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: `Configuração inicial — ${BRAND_NAME}` },
      { name: "description", content: "Crie sua empresa e a primeira unidade operacional." },
      { property: "og:title", content: `Configuração inicial — ${BRAND_NAME}` },
      { property: "og:description", content: "Crie sua empresa e a primeira unidade." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapCompany);
  const [companyName, setCompanyName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("restaurante");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await bootstrap({ data: { companyName, unitName, unitType, city } });
      toast.success("Empresa criada. Bem-vindo!");
      if (await resumePendingCheckout()) return;
      navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-lg surface-card p-7 animate-rise">
        <h1 className="text-2xl font-semibold">Vamos configurar sua operação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comece com a empresa e a primeira unidade. Você pode adicionar mais depois.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unitName">Nome da primeira unidade</Label>
            <Input
              id="unitName"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unitType">Tipo de operação</Label>
            <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
              <SelectTrigger id="unitType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade (opcional)</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          </div>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={loading}>
          {loading ? "Criando…" : "Criar empresa e unidade"}
        </Button>
      </form>
    </div>
  );
}
