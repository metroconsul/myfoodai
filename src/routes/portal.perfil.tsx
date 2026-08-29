import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { portalMe, portalDeliveries, portalLogout } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt } from "@/lib/format";
import { EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/perfil")({
  head: () => ({
    meta: [
      { title: `Meu perfil — ${BRAND_NAME}` },
      { name: "description", content: "Seus dados, unidade e itens recebidos." },
      { property: "og:title", content: `Meu perfil — ${BRAND_NAME}` },
      { property: "og:description", content: "Dados do colaborador e itens entregues." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalProfilePage,
});

function PortalProfilePage() {
  const { token, ready, clear } = usePortalSession();
  const me = useServerFn(portalMe);
  const listDeliveries = useServerFn(portalDeliveries);
  const logout = useServerFn(portalLogout);
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !token) navigate({ to: "/portal/login", replace: true });
  }, [ready, token, navigate]);

  const { data } = useQuery({
    queryKey: ["portal-me", token],
    enabled: !!token,
    queryFn: () => me({ data: { token: token! } }),
  });

  const { data: deliveriesData } = useQuery({
    queryKey: ["portal-deliveries", token],
    enabled: !!token,
    queryFn: () => listDeliveries({ data: { token: token! } }),
  });

  const deliveries = deliveriesData && !("error" in deliveriesData) ? deliveriesData.deliveries : [];
  const profile = data && !("error" in data) ? data : null;

  async function signOut() {
    if (token) await logout({ data: { token } });
    clear();
    navigate({ to: "/portal/login", replace: true });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>

      <section className="rounded-[12px] border-2 border-foreground bg-card p-4 text-sm">
        <p className="font-medium">{profile?.employee?.name ?? "—"}</p>
        <p className="text-muted-foreground">{profile?.unit?.name ?? "Sem unidade vinculada"}</p>
        {profile?.employee?.code ? (
          <p className="text-muted-foreground">Matrícula {profile.employee?.code}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Itens recebidos
        </h2>
        {deliveries.length === 0 ? (
          <EmptyState title="Nenhum item registrado" description="Uniformes e EPIs entregues aparecem aqui." />
        ) : (
          <ul className="divide-y-2 divide-foreground rounded-[12px] border-2 border-foreground bg-card overflow-hidden">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span>
                  <span className="block font-medium">
                    {(d.catalog_items as { name: string } | null)?.name ?? "Item"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Number(d.quantity)} un · {dateFmt(d.delivered_at)}
                    {d.size ? ` · tam. ${d.size}` : ""}
                  </span>
                </span>
                {d.returned_at ? (
                  <span className="text-xs text-muted-foreground">Devolvido</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="outline" className="w-full" onClick={() => void signOut()}>
        Sair do portal
      </Button>
    </div>
  );
}
