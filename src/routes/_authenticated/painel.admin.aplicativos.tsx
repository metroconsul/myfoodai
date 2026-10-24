import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/use-workspace";
import { FeatureBlocked } from "@/components/feature-blocked";
import { Switch } from "@/components/ui/switch";
import { APPS } from "@/apps/registry";
import { listCompanyApps, setCompanyApp, type APP_CODES } from "@/lib/apps-admin.functions";

export const Route = createFileRoute("/_authenticated/painel/admin/aplicativos")({
  head: () => ({ meta: [{ title: "Aplicativos por empresa — Administração" }] }),
  component: AppsAdmin,
});

type AppCode = (typeof APP_CODES)[number];

function AppsAdmin() {
  const { isPlatformAdmin, planCode } = useWorkspace();
  if (!isPlatformAdmin) {
    return <FeatureBlocked planCode={planCode} title="Área exclusiva da administração" />;
  }
  return <AppsAdminTable />;
}

function AppsAdminTable() {
  const list = useServerFn(listCompanyApps);
  const save = useServerFn(setCompanyApp);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-company-apps"], queryFn: () => list() });

  const toggle = useMutation({
    mutationFn: (v: { companyId: string; app: AppCode; enabled: boolean }) => save({ data: v }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-company-apps"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Aplicativo atualizado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar."),
  });

  return (
    <div>
      <p className="meta-mono">Administração da plataforma</p>
      <h1 className="display-type mt-2 text-2xl uppercase">Aplicativos por empresa</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ative ou desative cada aplicativo para cada empresa. A troca de plano não altera estes acessos.
      </p>

      {isLoading ? <p className="meta-mono mt-6">Carregando…</p> : null}
      {error ? <p className="mt-6 text-sm text-destructive">Não foi possível carregar as empresas.</p> : null}

      {data ? (
        <div className="mt-6 overflow-x-auto rounded-[12px] border-2 border-foreground bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b-2 border-foreground bg-secondary text-left">
              <tr>
                <th className="p-3">Empresa</th>
                {APPS.map((a) => (
                  <th key={a.id} className="p-3 text-center">
                    {a.name.replace("MyFoods ", "")}
                    {a.status === "soon" ? <span className="meta-mono block text-[9px]">em breve</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.id} className="border-b border-foreground/20 last:border-0">
                  <th scope="row" className="p-3 text-left font-medium">
                    {c.name}
                    <span className="meta-mono block text-[10px]">
                      {c.plan_code} · {c.subscription_status}
                    </span>
                  </th>
                  {APPS.map((a) => {
                    const code = a.entitlement as AppCode;
                    return (
                      <td key={a.id} className="p-3 text-center">
                        <Switch
                          checked={c.apps[code]}
                          disabled={toggle.isPending}
                          aria-label={`${a.name} para ${c.name}`}
                          onCheckedChange={(enabled) => toggle.mutate({ companyId: c.id, app: code, enabled })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
