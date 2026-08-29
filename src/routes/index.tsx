import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND_NAME } from "@/config/brand";
import {
  CalendarDays,
  MapPin,
  Boxes,
  Plug,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  CircleDot,
} from "lucide-react";

const TITLE = `${BRAND_NAME} — gestão operacional para food service`;
const DESCRIPTION =
  "Organize pessoas, ponto, escalas, estoque e vendas com a mesma clareza no salão, na cozinha e no escritório — em uma ou várias unidades.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MARQUEE = [
  "ESCALAS",
  "PONTO",
  "ESTOQUE",
  "VENDAS",
  "EQUIPE",
  "OPERAÇÃO",
  "MULTIUNIDADE",
];

const CONTRASTS = [
  ["Escalas espalhadas", "Turnos organizados"],
  ["Ponto difícil de conferir", "Registros revisáveis"],
  ["Estoque sem contexto", "Itens, validade e perdas visíveis"],
  ["Cada unidade de um jeito", "Visão consolidada"],
];

const STEPS = [
  ["01", "Planeje a equipe", "Monte a semana, distribua blocos e publique a escala."],
  ["02", "Acompanhe o ponto", "Registros do celular com raio por unidade e revisão."],
  ["03", "Controle itens e estoque", "Fotos, mínimo, validade, perdas e movimentações."],
  ["04", "Entenda o que aconteceu", "Histórico auditável e indicadores por unidade."],
];

function Marquee() {
  const row = (
    <span className="flex shrink-0 items-center">
      {MARQUEE.concat(MARQUEE).map((w, i) => (
        <span key={`${w}-${i}`} className="gh-mono px-6 py-4 text-sm font-bold">
          {w} <span aria-hidden>•</span>
        </span>
      ))}
    </span>
  );
  return (
    <div
      className="gh-marquee border-y-2 border-[#09090b] bg-[#09090b] text-[#d2e823]"
      role="presentation"
    >
      <div className="gh-marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="gh-box gh-box-lg relative overflow-hidden p-4" aria-hidden>
      <div className="mb-3 flex items-center gap-2 border-b-2 border-[#09090b] pb-3">
        <span className="size-3 rounded-full border-2 border-[#09090b] bg-[#f26b38]" />
        <span className="size-3 rounded-full border-2 border-[#09090b] bg-[#d2e823]" />
        <span className="gh-mono ml-2 text-[10px] text-[#5e5a50]">painel · visão de operação</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Unidades ativas", "3"],
          ["Na escala hoje", "18"],
          ["Pontos do dia", "42"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border-2 border-[#09090b] bg-[#f8f4e8] p-2">
            <p className="gh-mono text-[9px] text-[#5e5a50]">{k}</p>
            <p className="gh-display text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border-2 border-[#09090b] p-3">
        <p className="gh-mono mb-2 text-[10px] text-[#5e5a50]">escalas do dia</p>
        <div className="space-y-1.5">
          {[
            ["Salão", 20, 45, "#d2e823"],
            ["Cozinha", 10, 60, "#09090b"],
            ["Balcão", 45, 35, "#f26b38"],
          ].map(([label, start, width, color]) => (
            <div key={String(label)} className="flex items-center gap-2">
              <span className="w-16 text-[11px]">{label}</span>
              <span className="relative h-3 flex-1 rounded border-2 border-[#09090b] bg-[#fffdf6]">
                <span
                  className="absolute inset-y-0 rounded-sm"
                  style={{
                    left: `${start as number}%`,
                    width: `${width as number}%`,
                    background: color as string,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border-2 border-[#09090b] p-3">
          <p className="gh-mono text-[10px] text-[#5e5a50]">estoque mínimo</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#f26b38]">
            <CircleDot className="size-3" /> 4 itens abaixo do mínimo
          </p>
          <p className="mt-1 text-[11px] text-[#5e5a50]">Embalagens · Insumos · Limpeza</p>
        </div>
        <div className="rounded-lg border-2 border-[#09090b] bg-[#09090b] p-3 text-[#f8f4e8]">
          <p className="gh-mono text-[10px] text-[#d2e823]">vendas · demonstrativo</p>
          <div className="mt-2 flex h-10 items-end gap-1">
            {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-[#d2e823]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: CalendarDays,
    label: "ESCALAS E TURNOS",
    text: "Modele semanas, distribua blocos por dia e organize até os turnos que atravessam a meia-noite.",
    big: true,
  },
  {
    icon: MapPin,
    label: "PONTO COM GEOLOCALIZAÇÃO",
    text: "Registro pelo celular, raio por unidade e revisão auditável para acompanhar a jornada com mais segurança.",
    dark: true,
  },
  {
    icon: Boxes,
    label: "ESTOQUE VISUAL",
    text: "Fotos, estoque mínimo, validade, perdas e movimentações em uma visão simples de consultar.",
  },
  {
    icon: Plug,
    label: "VENDAS CONECTÁVEIS",
    text: "Prepare a camada de dados para API, webhook, CSV ou banco autorizado.",
  },
  {
    icon: Smartphone,
    label: "PORTAL DO COLABORADOR",
    text: "Acesso por CPF e PIN, direto no navegador e sem exigir instalação de aplicativo.",
  },
  {
    icon: ShieldCheck,
    label: "PRIVACIDADE POR PADRÃO",
    text: "Dados separados por empresa e unidade, trilha de auditoria e localização protegida.",
    dark: true,
  },
];

function Landing() {
  return (
    <div className="gh min-h-screen">
      <div className="relative z-[1]">
        <header className="sticky top-4 z-50 mx-4 mb-6">
          <nav
            className="mx-auto flex max-w-6xl items-center gap-3 rounded-xl border-2 border-[#09090b] bg-[#f8f4e8]/90 px-4 py-3 backdrop-blur-xl"
            aria-label="Principal"
          >
            <Link to="/" className="gh-display flex min-w-0 items-center gap-2 text-sm sm:text-base">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border-2 border-[#09090b] bg-[#d2e823] text-xs">
                ◍
              </span>
              <span className="truncate uppercase">Golden Hour Hub</span>
            </Link>

            <div className="gh-mono mx-auto hidden gap-6 text-xs lg:flex">
              <a href="#recursos" className="hover:text-[#f26b38]">Recursos</a>
              <a href="#como-funciona" className="hover:text-[#f26b38]">Como funciona</a>
              <a href="#para-quem" className="hover:text-[#f26b38]">Para quem é</a>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
              <Link
                to="/portal/login"
                className="gh-mono hidden text-xs underline-offset-4 hover:underline sm:inline"
              >
                Portal do colaborador
              </Link>
              <Link to="/auth" className="gh-btn gh-press px-3 py-2 text-xs sm:text-sm">
                Entrar no painel
              </Link>
            </div>
          </nav>
        </header>

        <main>
          {/* HERO */}
          <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-14 pt-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="gh-mono inline-block rounded-md border-2 border-[#09090b] bg-[#d2e823] px-3 py-1 text-[11px] font-bold">
                Feito para food service
              </span>
              <h1 className="gh-display gh-glitch mt-5 text-[2.6rem] uppercase sm:text-6xl xl:text-7xl">
                Tudo que mantém sua operação de pé. Em um só lugar.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[#5e5a50]">
                Organize pessoas, ponto, escalas, estoque e vendas com a mesma clareza no salão, na
                cozinha e no escritório — em uma ou várias unidades.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/auth" className="gh-btn gh-btn-primary gh-press">
                  Começar agora <ArrowRight className="size-4" aria-hidden />
                </Link>
                <a href="#como-funciona" className="gh-btn gh-press">
                  Ver como funciona
                </a>
                <span className="gh-tilt gh-mono inline-block rounded-md border-2 border-[#09090b] bg-[#d2e823] px-2 py-1 text-[10px] font-bold">
                  Do salão ao estoque
                </span>
              </div>
              <p className="gh-mono mt-5 text-[11px] text-[#5e5a50]">
                Menos planilhas. Menos retrabalho. Mais controle da operação.
              </p>
            </div>

            <div className="relative lg:col-span-5">
              <DashboardMockup />
              <div className="gh-box gh-box-lg gh-acid gh-float absolute -bottom-6 -left-2 max-w-[15rem] p-3 sm:-left-6">
                <p className="gh-mono text-[10px] font-bold">Operação alinhada</p>
                <p className="mt-1 text-sm font-medium">
                  Pessoas, turnos e estoque no mesmo ritmo.
                </p>
              </div>
            </div>
          </section>

          <Marquee />

          {/* SEM REMENDOS */}
          <section className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="gh-display gh-glitch text-3xl uppercase sm:text-4xl">
                  Quando a operação cresce, a improvisação fica cara.
                </h2>
                <p className="mt-4 text-[#5e5a50]">
                  Pare de juntar informações de planilhas, mensagens e sistemas desconectados. O
                  Golden Hour Hub dá contexto para cada decisão — da escala da equipe à reposição do
                  estoque.
                </p>
              </div>
              <ul className="space-y-3">
                {CONTRASTS.map(([antes, depois]) => (
                  <li
                    key={antes}
                    className="gh-box grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 p-3"
                  >
                    <span className="gh-mono min-w-0 text-[10px] text-[#5e5a50] line-through">
                      {antes}
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 text-sm font-bold">{depois}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* RECURSOS */}
          <section id="recursos" className="mx-auto max-w-6xl px-6 py-8">
            <h2 className="gh-display gh-glitch text-3xl uppercase sm:text-4xl">Recursos</h2>
            <p className="mt-3 max-w-2xl text-[#5e5a50]">
              Cada módulo cobre um pedaço real da rotina — e todos falam a mesma língua.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article
                  key={f.label}
                  className={[
                    "gh-box gh-card-hover relative overflow-hidden p-5",
                    f.big ? "sm:col-span-2 sm:row-span-2" : "",
                    f.dark ? "gh-dark" : "",
                  ].join(" ")}
                >
                  {!f.dark ? (
                    <span className="gh-dots pointer-events-none absolute inset-0" aria-hidden />
                  ) : null}
                  <div className="relative">
                    <span
                      className={[
                        "grid size-10 place-items-center rounded-lg border-2 border-[#09090b]",
                        f.dark ? "bg-[#d2e823] text-[#09090b]" : "bg-[#d2e823]",
                      ].join(" ")}
                    >
                      <f.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="gh-mono mt-4 text-xs font-bold">{f.label}</h3>
                    <p
                      className={[
                        "mt-2 text-sm",
                        f.dark ? "text-[#f8f4e8]/80" : "text-[#5e5a50]",
                        f.big ? "sm:text-base" : "",
                      ].join(" ")}
                    >
                      {f.text}
                    </p>

                    {f.big ? (
                      <div className="mt-6 grid grid-cols-7 gap-1.5" aria-hidden>
                        {Array.from({ length: 21 }).map((_, i) => (
                          <span
                            key={i}
                            className="h-8 rounded border-2 border-[#09090b]"
                            style={{
                              background:
                                i % 7 === 6 ? "#09090b" : i % 3 === 0 ? "#d2e823" : "#fffdf6",
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* FLUXO */}
          <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="gh-display gh-glitch text-3xl uppercase sm:text-4xl">
              Da abertura ao fechamento, uma visão só.
            </h2>
            <p className="mt-3 max-w-2xl text-[#5e5a50]">
              O painel acompanha o turno inteiro sem obrigar o gestor a trocar de contexto o tempo
              todo.
            </p>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {STEPS.map(([n, title, text], i) => (
                <li
                  key={n}
                  className={[
                    "gh-box p-5",
                    i === 0 ? "gh-acid" : "",
                  ].join(" ")}
                >
                  <span className="gh-display text-3xl">{n}</span>
                  <h3 className="mt-2 text-base font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-[#5e5a50]">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* MULTIUNIDADE */}
          <section id="para-quem" className="border-y-2 border-[#09090b] bg-[#d2e823]">
            <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-16 lg:grid-cols-2">
              <div>
                <h2 className="gh-display gh-glitch text-3xl uppercase sm:text-4xl">
                  Uma unidade ou uma rede inteira. A clareza acompanha.
                </h2>
                <p className="mt-4 max-w-xl">
                  Configure empresas, unidades, permissões e rotinas em uma estrutura preparada para
                  crescer com a sua operação. Restaurantes, bares, cafeterias, padarias e cozinhas
                  profissionais.
                </p>
              </div>
              <div className="gh-box gh-box-lg p-5" aria-hidden>
                <p className="gh-mono text-[10px] text-[#5e5a50]">estrutura</p>
                <div className="mt-3 grid gap-3">
                  <div className="mx-auto rounded-lg border-2 border-[#09090b] bg-[#09090b] px-4 py-2 text-center text-xs font-bold text-[#d2e823]">
                    VISÃO CENTRAL
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Unidade A", "Unidade B", "Unidade C"].map((u) => (
                      <div
                        key={u}
                        className="rounded-lg border-2 border-[#09090b] bg-[#fffdf6] px-2 py-3 text-center text-[11px] font-bold"
                      >
                        {u}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA FINAL */}
          <section className="mx-auto max-w-6xl px-6 py-16">
            <div className="gh-box gh-box-lg p-8 sm:p-12">
              <h2 className="gh-display gh-glitch max-w-3xl text-3xl uppercase sm:text-5xl">
                Sua operação já está acontecendo. Organize o próximo turno.
              </h2>
              <p className="mt-4 max-w-xl text-[#5e5a50]">
                Comece com uma visão mais clara de pessoas, ponto, escalas, estoque e vendas.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link to="/auth" className="gh-btn gh-btn-primary gh-press">
                  Começar agora <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  to="/portal/login"
                  className="gh-mono text-xs underline underline-offset-4 hover:text-[#f26b38]"
                >
                  Sou colaborador
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t-2 border-[#09090b] bg-[#09090b] text-[#f8f4e8]">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3">
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Produto</h2>
              <ul className="space-y-2 text-sm">
                <li><a href="#recursos" className="hover:text-[#d2e823]">Recursos</a></li>
                <li><a href="#como-funciona" className="hover:text-[#d2e823]">Como funciona</a></li>
                <li><Link to="/auth" className="hover:text-[#d2e823]">Entrar no painel</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Acesso</h2>
              <ul className="space-y-2 text-sm">
                <li><Link to="/portal/login" className="hover:text-[#d2e823]">Portal do colaborador</Link></li>
                <li><Link to="/auth" className="hover:text-[#d2e823]">Começar agora</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Informações</h2>
              <p className="text-sm text-[#f8f4e8]/70">
                Marca, logo e cores são configuráveis em um único arquivo de configuração.
              </p>
            </div>
          </div>
          <p className="gh-mono border-t-2 border-[#f8f4e8]/20 px-6 py-6 text-center text-[10px]">
            Golden Hour Hub · gestão operacional para food service.
          </p>
        </footer>
      </div>
    </div>
  );
}
