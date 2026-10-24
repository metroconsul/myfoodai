import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, LayoutDashboard, MessageCircle, Users } from "lucide-react";
import { APPS, appAccess, type AppAccess, type AppManifest } from "@/apps/registry";
import { useWorkspace } from "@/hooks/use-workspace";
import { contactHref } from "@/config/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({ meta: [{ title: "Central de aplicativos — Grupo MyFoods" }] }),
  component: PainelHome,
});

const STATUS_LABEL: Record<AppAccess, string> = {
  open: "Contratado",
  no_role: "Contratado",
  not_contracted: "Não contratado",
  soon: "Em breve",
};

const TONE: Record<AppManifest["tone"], string> = {
  acid: "bg-accent text-accent-foreground",
  ember: "bg-[#f26b38] text-[#09090b]",
  ink: "bg-foreground text-background",
  paper: "bg-secondary text-foreground",
};

function PainelHome() {
  const { profile, company, roles, isPlatformAdmin, isAdmin, hasFeature } = useWorkspace();
  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const ctx = { hasFeature, roles, isPlatformAdmin };

  return (
    <div>
      <p className="meta-mono">Central de aplicativos</p>
      <h1 className="display-type mt-2 text-3xl uppercase sm:text-4xl">
        {firstName ? `Olá, ${firstName}.` : "Olá!"}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Estes são os aplicativos do Grupo MyFoods para {company?.name ?? "a sua empresa"}. Abra o que
        você precisa agora.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map((app) => (
          <AppCard key={app.id} app={app} access={appAccess(app, ctx)} />
        ))}
      </ul>

      <section className="mt-12" aria-labelledby="empresa-title">
        <h2 id="empresa-title" className="display-type text-xl uppercase">
          Sua empresa
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <Shortcut to="/app" icon={LayoutDashboard} label="Visão geral da operação" />
          <Shortcut to="/app/employees" icon={Users} label="Colaboradores" />
          {isAdmin || isPlatformAdmin ? (
            <Shortcut to="/app/units" icon={Building2} label="Unidades" />
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function AppCard({ app, access }: { app: AppManifest; access: AppAccess }) {
  const Icon = app.icon;
  const muted = access === "soon" || access === "not_contracted";
  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-[12px] border-2 border-foreground bg-card shadow-[4px_4px_0_var(--ink)]",
        access === "soon" && "border-dashed",
      )}
      data-app={app.id}
      data-access={access}
    >
      <div className={cn("flex items-start justify-between gap-3 border-b-2 border-foreground p-4", TONE[app.tone])}>
        <span className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[8px] border-2 border-foreground bg-card text-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="display-type text-base uppercase leading-tight">{app.name}</span>
        </span>
        <span
          className={cn(
            "meta-mono shrink-0 whitespace-nowrap rounded-[6px] border-2 border-foreground px-2 py-0.5 text-[10px] font-bold",
            muted ? "border-dashed bg-card text-foreground" : "bg-accent text-accent-foreground",
          )}
        >
          {STATUS_LABEL[access]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm">{app.description}</p>
        <div className="mt-auto pt-4">
          {access === "open" ? (
            <Link
              to={app.entry}
              className="inline-flex items-center gap-2 rounded-[8px] border-2 border-foreground bg-accent px-3 py-2 text-sm font-semibold shadow-[2px_2px_0_var(--ink)]"
            >
              Acessar <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : access === "no_role" ? (
            <p className="meta-mono text-[11px]">Seu perfil não tem acesso. Fale com o administrador da empresa.</p>
          ) : access === "not_contracted" ? (
            <a
              href={contactHref(`Olá! Quero contratar o ${app.name} para a minha empresa.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[8px] border-2 border-foreground bg-card px-3 py-2 text-sm font-semibold"
            >
              <MessageCircle className="size-4" aria-hidden /> Fale com a MyFoods
            </a>
          ) : (
            <p className="meta-mono text-[11px]">Em desenvolvimento. Sem data de lançamento definida.</p>
          )}
        </div>
      </div>
    </li>
  );
}

function Shortcut({ to, icon: Icon, label }: { to: string; icon: typeof Users; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 rounded-[10px] border-2 border-foreground bg-card px-4 py-3 text-sm font-semibold hover:bg-accent"
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
