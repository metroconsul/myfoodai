import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND_NAME, BRAND_TAGLINE } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Boxes, ShoppingBag, Smartphone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND_NAME} — Gestão de pessoas, ponto, escalas e estoque` },
      {
        name: "description",
        content:
          "Plataforma para restaurantes, bares, cafeterias, padarias e cozinhas: escalas, ponto com geolocalização, estoque com fotos e indicadores de vendas em uma só operação.",
      },
      { property: "og:title", content: `${BRAND_NAME} — Operação de food service em um só lugar` },
      {
        property: "og:description",
        content:
          "Escalas, cartão de ponto, estoque visual e vendas para negócios de alimentação com uma ou várias unidades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: CalendarDays, title: "Escalas e turnos", text: "Modelos semanais, múltiplos blocos por dia e turnos que atravessam a meia-noite." },
  { icon: Clock, title: "Ponto com geolocalização", text: "Registro pelo celular, política de raio por unidade e revisão auditável." },
  { icon: Boxes, title: "Estoque visual", text: "Cards com foto, estoque mínimo, validade, perdas e movimentações completas." },
  { icon: ShoppingBag, title: "Vendas conectáveis", text: "Camada de adapters pronta para API, webhook, CSV ou banco autorizado." },
  { icon: Smartphone, title: "Portal do colaborador", text: "Acesso por CPF e PIN, sem instalar aplicativo, direto no navegador." },
  { icon: ShieldCheck, title: "Privacidade por padrão", text: "Dados por empresa e unidade, trilha de auditoria e localização protegida." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            {BRAND_NAME.slice(0, 1)}
          </span>
          {BRAND_NAME}
        </span>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Portal do colaborador</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Entrar no painel</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="max-w-3xl animate-rise">
          <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Para restaurantes, bares, cafeterias, padarias e cozinhas
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            {BRAND_TAGLINE}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Pessoas, ponto, escalas, itens operacionais, estoque e vendas — uma ou várias unidades,
            com a mesma clareza no salão, na cozinha e no escritório.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sou colaborador</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="surface-card hover-lift p-5 animate-rise">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {BRAND_NAME} · configure marca, logo e cores em um único lugar.
      </footer>
    </div>
  );
}
