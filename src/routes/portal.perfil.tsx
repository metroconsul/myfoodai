import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { FileText } from "lucide-react";
import { portalMe, portalDeliveries, portalLogout } from "@/lib/portal.functions";
import { usePortalSession } from "@/hooks/use-portal-session";
import { BRAND_NAME } from "@/config/brand";
import { dateFmt } from "@/lib/format";
import {
  PortalButton,
  PortalCard,
  PortalChip,
  PortalEmpty,
  PortalLabel,
  PortalSection,
  PortalTile,
} from "@/components/portal-ui";

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
      <PortalCard className="p-6">
        <PortalLabel>Meu perfil</PortalLabel>
        <p className="display-type mt-1 text-2xl">{profile?.employee?.name ?? "—"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.unit?.name ?? "Sem unidade vinculada"}
        </p>
        {profile?.employee?.code ? (
          <div className="mt-3">
            <PortalChip tone="acid">Matrícula {profile.employee.code}</PortalChip>
          </div>
        ) : null}
        <PortalButton
          variant="dark"
          block
          className="mt-5"
          onClick={() => navigate({ to: "/portal/cartao-ponto" })}
        >
          <FileText className="size-4" aria-hidden />
          Ver cartão de ponto
        </PortalButton>
      </PortalCard>

      <PortalSection
        title="Itens recebidos"
        action={
          <Link to="/portal" className="text-sm font-bold underline underline-offset-4">
            Início
          </Link>
        }
      >
        {deliveries.length === 0 ? (
          <PortalEmpty
            title="Nenhum item registrado"
            description="Uniformes e EPIs entregues aparecem aqui."
          />
        ) : (
          <ul className="space-y-3">
            {deliveries.map((d) => (
              <li key={d.id}>
                <PortalTile className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {(d.catalog_items as { name: string } | null)?.name ?? "Item"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(d.quantity)} un · {dateFmt(d.delivered_at)}
                      {d.size ? ` · tam. ${d.size}` : ""}
                    </p>
                  </div>
                  {d.returned_at ? <PortalChip tone="card">Devolvido</PortalChip> : null}
                </PortalTile>
              </li>
            ))}
          </ul>
        )}
      </PortalSection>

      <PortalButton variant="secondary" block onClick={() => void signOut()}>
        Sair do portal
      </PortalButton>
    </div>
  );
}
