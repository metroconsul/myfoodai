import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  BRAND_LOGO,
  CONTACT_WHATSAPP_LABEL,
  GROUP_NAME,
  GROUP_TAGLINE,
  SITE_URL,
  contactHref,
} from "@/config/brand";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Boxes,
  Cake,
  Clock,
  Coffee,
  Croissant,
  FileText,
  MessageCircle,
  Puzzle,
  Sandwich,
  ShoppingCart,
  Store,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const TITLE = `${GROUP_NAME} — aplicativos para a gestão de cafeterias e restaurantes`;
const DESCRIPTION =
  "Aplicativos especializados para cafeterias, restaurantes e padarias: ponto, estoque, compras, caixa e documentos. Escolha o que o seu negócio precisa.";
const OG_IMAGE = `${SITE_URL}${BRAND_LOGO}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `${GROUP_NAME} — ${GROUP_TAGLINE}` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:site_name", content: GROUP_NAME },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "500" },
      { property: "og:image:height", content: "500" },
      { property: "og:image:alt", content: `Logotipo ${GROUP_NAME}` },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: `${GROUP_NAME} — ${GROUP_TAGLINE}` },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Landing,
});

type Status = "available" | "soon";

interface AppCard {
  id: string;
  name: string;
  icon: LucideIcon;
  tone: "acid" | "ember" | "ink" | "paper" | "acid2";
  status: Status;
  short: string;
  benefitsTitle: string;
  benefits: string[];
  extraTitle?: string;
  extraBenefits?: string[];
  span: string;
}

/** Status refletem o código real: "available" = telas e dados já implementados; "soon" = ainda não existe. */
const APPS: AppCard[] = [
  {
    id: "ponto",
    name: "MyFoods Ponto",
    icon: Clock,
    tone: "acid",
    status: "available",
    short: "Controle de jornada e gestão de funcionários.",
    benefitsTitle: "O que ele organiza",
    benefits: [
      "Registros de ponto da equipe",
      "Acompanhamento de jornadas e escalas",
      "Cadastro e gestão de funcionários",
      "Foto e localização como evidência da batida",
      "Portal do Colaborador, com acesso por CPF e PIN",
    ],
    span: "lg:col-span-2",
  },
  {
    id: "estoque",
    name: "MyFoods Estoque",
    icon: Boxes,
    tone: "ember",
    status: "available",
    short: "Controle e organização do estoque, por unidade.",
    benefitsTitle: "O que ele organiza",
    benefits: [
      "Cadastro de produtos, com foto",
      "Entradas, saídas e ajustes",
      "Controle de quantidades",
      "Histórico de movimentações",
      "Alertas de estoque mínimo",
    ],
    span: "lg:col-span-2",
  },
  {
    id: "documentos",
    name: "MyFoods Documentos",
    icon: FileText,
    tone: "ink",
    status: "available",
    short: "Organização documental do estabelecimento e dos colaboradores.",
    benefitsTitle: "O que ele organiza",
    benefits: [
      "Holerites, com assinatura e comprovante",
      "Documentos dos colaboradores e exames, incluindo ASO admissional",
      "Entrega e troca de EPIs e uniformes",
      "Pendências documentais à vista",
    ],
    span: "lg:col-span-2",
  },
  {
    id: "compras",
    name: "MyFoods Compras",
    icon: ShoppingCart,
    tone: "paper",
    status: "soon",
    short: "Organização das compras e dos fornecedores.",
    benefitsTitle: "O que ele vai organizar",
    benefits: [
      "Cadastro de fornecedores",
      "Solicitações de compra",
      "Pedidos organizados",
      "Histórico de compras",
      "Acompanhamento de entregas",
    ],
    span: "lg:col-span-3",
  },
  {
    id: "caixa-financeiro",
    name: "MyFoods Caixa & Financeiro",
    icon: Wallet,
    tone: "acid2",
    status: "soon",
    short: "A operação de caixa e o controle financeiro reunidos em um único aplicativo.",
    benefitsTitle: "Caixa — o que vai organizar",
    benefits: [
      "Abertura e fechamento de caixa",
      "Entradas, saídas e movimentações",
      "Conferência de caixa",
    ],
    extraTitle: "Financeiro — o que vai organizar",
    extraBenefits: [
      "Receitas e despesas",
      "Contas a pagar e a receber",
      "Fluxo de caixa e relatórios financeiros",
    ],
    span: "lg:col-span-3",
  },
];

const TONES: Record<AppCard["tone"], { head: string; text: string }> = {
  acid: { head: "bg-[#d2e823]", text: "text-[#09090b]" },
  ember: { head: "bg-[#f26b38]", text: "text-[#09090b]" },
  ink: { head: "bg-[#09090b]", text: "text-[#d2e823]" },
  paper: { head: "bg-[#f8f4e8]", text: "text-[#09090b]" },
  acid2: { head: "bg-[#fffdf6]", text: "text-[#09090b]" },
};

const MARQUEE = ["PONTO", "ESTOQUE", "COMPRAS", "CAIXA & FINANCEIRO", "DOCUMENTOS", "SIMPLES", "ESPECIALIZADO"];

const AUDIENCE: { icon: LucideIcon; name: string; text: string }[] = [
  { icon: Coffee, name: "Cafeterias", text: "Equipe em turnos curtos e insumos que acabam no meio do movimento." },
  { icon: UtensilsCrossed, name: "Restaurantes", text: "Salão e cozinha com horários diferentes e muita coisa para acompanhar." },
  { icon: Sandwich, name: "Lanchonetes", text: "Giro rápido: o estoque e a equipe precisam estar sempre em dia." },
  { icon: Croissant, name: "Padarias", text: "Madrugada, escalas apertadas e produtos que não podem faltar." },
  { icon: Cake, name: "Confeitarias", text: "Encomendas, ingredientes e prazos que exigem organização." },
  { icon: Store, name: "Pequenos e médios comércios", text: "O dono participa da rotina e precisa de ferramentas simples, sem complicação." },
];

const STEPS: [string, string, string][] = [
  ["01", "Escolha o aplicativo", "Comece pela necessidade que mais pesa no seu dia a dia."],
  ["02", "Conheça e contrate", "Contrate individualmente ou em pacote, conforme o seu negócio."],
  ["03", "Organize a operação", "Use a ferramenta para dar clareza à rotina do estabelecimento."],
];

function StatusBadge({ status }: { status: Status }) {
  const available = status === "available";
  return (
    <span
      className={[
        "gh-mono inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border-2 px-2 py-0.5 text-[10px] font-bold",
        available
          ? "border-[#09090b] bg-[#d2e823] text-[#09090b]"
          : "border-dashed border-[#09090b] bg-[#fffdf6] text-[#09090b]",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={["size-1.5 rounded-full", available ? "bg-[#09090b]" : "bg-[#f26b38]"].join(" ")}
      />
      {available ? "Disponível" : "Em breve"}
    </span>
  );
}

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
    <div className="gh-marquee border-y-2 border-[#09090b] bg-[#09090b] text-[#d2e823]" role="presentation">
      <div className="gh-marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}

function EcosystemVisual() {
  return (
    <div className="gh-box gh-box-lg relative p-5" aria-hidden>
      <div className="flex items-center gap-3 border-b-2 border-[#09090b] pb-4">
        <img src={BRAND_LOGO} alt="" className="size-14 object-contain" />
        <div>
          <p className="gh-display text-lg uppercase leading-none">{GROUP_NAME}</p>
          <p className="gh-mono mt-1 text-[10px] text-[#5e5a50]">cinco aplicativos · uma identidade</p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2.5">
        {APPS.map((a) => (
          <li
            key={a.id}
            className={[
              "flex items-center gap-2 rounded-lg border-2 border-[#09090b] p-2.5",
              a.id === "caixa-financeiro" ? "col-span-2" : "",
              a.status === "soon" ? "border-dashed bg-[#fffdf6] text-[#09090b]" : `${TONES[a.tone].head} ${TONES[a.tone].text}`,
            ].join(" ")}
          >
            <a.icon className="size-5 shrink-0" />
            <span className="min-w-0 text-[12px] font-bold leading-tight">
              {a.name.replace("MyFoods ", "")}
            </span>
            <span className="gh-mono ml-auto shrink-0 text-[9px] font-bold">
              {a.status === "available" ? "no ar" : "em breve"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppCardView({ app }: { app: AppCard }) {
  const tone = TONES[app.tone];
  const soon = app.status === "soon";
  return (
    <article
      id={`app-${app.id}`}
      className={[
        "gh-box gh-card-hover flex h-full flex-col overflow-hidden",
        soon ? "border-dashed" : "",
        app.span,
      ].join(" ")}
    >
      <header className={["flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#09090b] p-5", tone.head, tone.text].join(" ")}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-[#09090b] bg-[#fffdf6] text-[#09090b]">
            <app.icon className="size-6" aria-hidden />
          </span>
          <h3 className="gh-display text-xl uppercase leading-tight">{app.name}</h3>
        </div>
        <StatusBadge status={app.status} />
      </header>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-medium">{app.short}</p>

        <h4 className="gh-mono mt-4 text-[11px] font-bold text-[#5e5a50]">{app.benefitsTitle}</h4>
        <ul className="mt-2 space-y-1.5 text-sm">
          {app.benefits.map((b) => (
            <li key={b} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#f26b38]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {app.extraBenefits ? (
          <>
            <h4 className="gh-mono mt-4 text-[11px] font-bold text-[#5e5a50]">{app.extraTitle}</h4>
            <ul className="mt-2 space-y-1.5 text-sm">
              {app.extraBenefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#f26b38]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="mt-auto pt-5">
          {soon ? (
            <a
              href={contactHref(`Olá! Quero saber mais sobre o ${app.name} quando estiver disponível.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="gh-btn gh-press px-3 py-2 text-sm"
            >
              <MessageCircle className="size-4" aria-hidden /> Quero saber mais
            </a>
          ) : (
            <a
              href={contactHref(`Olá! Quero contratar o ${app.name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="gh-btn gh-btn-primary gh-press px-3 py-2 text-sm"
            >
              Quero contratar <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ContactButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <a href={contactHref()} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function Landing() {
  const navigate = useNavigate();
  // Retorno do login com Google: quem ainda não tem empresa passa pelo onboarding.
  // A assinatura pelo site está desativada: a landing não retoma checkout pendente.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.company_id) {
        navigate({ to: "/app", replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="gh min-h-screen">
      <div className="relative z-[1]">
        <header className="sticky top-4 z-50 mx-4 mb-6">
          <nav
            className="mx-auto flex max-w-6xl items-center gap-3 rounded-xl border-2 border-[#09090b] bg-[#f8f4e8]/90 px-4 py-3 backdrop-blur-xl"
            aria-label="Principal"
          >
            <Link to="/" className="flex min-w-0 items-center" aria-label={GROUP_NAME}>
              <img
                src={BRAND_LOGO}
                alt={GROUP_NAME}
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              />
            </Link>

            <div className="gh-mono mx-auto hidden gap-6 text-xs lg:flex">
              <a href="#aplicativos" className="hover:text-[#f26b38]">Aplicativos</a>
              <a href="#como-funciona" className="hover:text-[#f26b38]">Como funciona</a>
              <a href="#para-quem" className="hover:text-[#f26b38]">Para quem é</a>
              <a href="#ecossistema" className="hover:text-[#f26b38]">Ecossistema</a>
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
          {/* 1. HERO */}
          <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-14 pt-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="gh-mono inline-block rounded-md border-2 border-[#09090b] bg-[#d2e823] px-3 py-1 text-[11px] font-bold">
                {GROUP_NAME}
              </span>
              <h1 className="gh-display mt-5 text-[2.2rem] uppercase leading-[1.05] sm:text-5xl xl:text-6xl">
                Seu negócio mais organizado. Sua gestão mais simples.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[#5e5a50]">
                O Grupo MyFoods reúne aplicativos especializados para ajudar você a controlar
                funcionários, estoque, compras, caixa e documentos em um só ecossistema.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#aplicativos" className="gh-btn gh-btn-primary gh-press">
                  Conheça os aplicativos <ArrowRight className="size-4" aria-hidden />
                </a>
                <ContactButton className="gh-btn gh-press">
                  <MessageCircle className="size-4" aria-hidden /> Fale com a MyFoods
                </ContactButton>
              </div>
              <p className="gh-mono mt-5 text-[11px] text-[#5e5a50]">
                Para cafeterias, restaurantes, lanchonetes, padarias e confeitarias.
              </p>
            </div>

            <div className="relative mb-16 lg:col-span-5">
              <EcosystemVisual />
              <div className="gh-box gh-box-lg gh-acid gh-float absolute -bottom-16 right-2 max-w-[15rem] p-3 sm:-bottom-14 sm:-right-2">
                <p className="gh-mono text-[10px] font-bold">Você escolhe</p>
                <p className="mt-1 text-sm font-medium">Comece por um aplicativo e cresça com o negócio.</p>
              </div>
            </div>
          </section>

          <Marquee />

          {/* 2. CONCEITO */}
          <section id="conceito" className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="gh-display text-3xl uppercase sm:text-4xl">
                  Você escolhe o que seu negócio precisa.
                </h2>
                <p className="mt-4 text-[#5e5a50]">
                  Você não precisa de um sistema enorme para administrar seu estabelecimento. Com o
                  Grupo MyFoods, você escolhe aplicativos especializados para cada necessidade do seu
                  negócio.
                </p>
              </div>
              <ul className="grid gap-3">
                {[
                  [Puzzle, "Aplicativos especializados", "Cada um resolve uma necessidade, sem excesso de telas e recursos que você não usa."],
                  [Store, "Individual ou em pacote", "Os aplicativos podem ser contratados individualmente ou em pacotes."],
                  [ArrowRight, "Cresça no seu ritmo", "Comece por uma necessidade e adicione outros aplicativos conforme o negócio cresce."],
                ].map(([Icon, title, text]) => {
                  const I = Icon as LucideIcon;
                  return (
                    <li key={title as string} className="gh-box flex gap-4 p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-[#09090b] bg-[#d2e823]">
                        <I className="size-5" aria-hidden />
                      </span>
                      <span>
                        <span className="block font-bold">{title as string}</span>
                        <span className="mt-0.5 block text-sm text-[#5e5a50]">{text as string}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* 3. APLICATIVOS */}
          <section id="aplicativos" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-8">
            <h2 className="gh-display text-3xl uppercase sm:text-4xl">Os aplicativos do Grupo MyFoods</h2>
            <p className="mt-3 max-w-2xl text-[#5e5a50]">
              Cada aplicativo cuida de uma parte da rotina. Veja quais já estão disponíveis e quais
              estão chegando.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
              {APPS.map((app) => (
                <AppCardView key={app.id} app={app} />
              ))}
            </div>
            <p className="gh-mono mt-5 text-[11px] text-[#5e5a50]">
              A contratação é feita diretamente com a equipe do Grupo MyFoods, pelo WhatsApp. Os
              aplicativos “em breve” ainda não estão à venda e não têm data de lançamento definida.
            </p>
          </section>

          {/* 4. COMO FUNCIONA */}
          <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16">
            <h2 className="gh-display text-3xl uppercase sm:text-4xl">Como funciona</h2>
            <p className="mt-3 max-w-2xl text-[#5e5a50]">Três passos simples, sem complicação.</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(([n, title, text], i) => (
                <li key={n} className={["gh-box p-5", i === 0 ? "gh-acid" : ""].join(" ")}>
                  <span className="gh-display text-3xl">{n}</span>
                  <h3 className="mt-2 text-base font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-[#5e5a50]">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* 5. PARA QUEM É */}
          <section id="para-quem" className="scroll-mt-28 border-y-2 border-[#09090b] bg-[#d2e823]">
            <div className="mx-auto max-w-6xl px-6 py-16">
              <h2 className="gh-display max-w-3xl text-3xl uppercase sm:text-4xl">
                Feito para quem vive a rotina do estabelecimento.
              </h2>
              <p className="mt-3 max-w-2xl">
                Se você cuida do negócio de perto, sabe o quanto cada detalhe pesa. Os aplicativos
                foram pensados para o dia a dia de quem toca o próprio estabelecimento.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AUDIENCE.map((a) => (
                  <li key={a.name} className="gh-box gh-card-hover p-5">
                    <span className="grid size-10 place-items-center rounded-lg border-2 border-[#09090b] bg-[#d2e823]">
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-3 font-bold">{a.name}</h3>
                    <p className="mt-1 text-sm text-[#5e5a50]">{a.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 6. ECOSSISTEMA */}
          <section id="ecossistema" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="gh-display text-3xl uppercase sm:text-4xl">Um ecossistema que cresce com você.</h2>
                <p className="mt-4 text-[#5e5a50]">
                  Os aplicativos do Grupo MyFoods compartilham a mesma identidade e a mesma estrutura
                  de empresas, unidades e colaboradores. Assim, você amplia a gestão aos poucos, sem
                  recomeçar do zero a cada novo aplicativo.
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {[
                    "Visual e forma de usar semelhantes em todos os aplicativos",
                    "Cadastro de empresa, unidades e equipe em uma base única",
                    "Adicione um novo aplicativo quando o seu negócio pedir",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#f26b38]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="gh-box gh-box-lg gh-dark p-6" aria-hidden>
                <p className="gh-mono text-[10px] text-[#d2e823]">base compartilhada</p>
                <div className="mt-3 rounded-lg border-2 border-[#f8f4e8]/40 px-4 py-3 text-center text-xs font-bold text-[#d2e823]">
                  Empresa · Unidades · Equipe
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                  {["Ponto", "Estoque", "Documentos"].map((n) => (
                    <div key={n} className="rounded-lg border-2 border-[#d2e823] bg-[#d2e823] px-2 py-3 text-[#09090b]">
                      {n}
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
                  {["Compras", "Caixa & Financeiro"].map((n) => (
                    <div key={n} className="rounded-lg border-2 border-dashed border-[#f8f4e8]/60 px-2 py-3 text-[#f8f4e8]">
                      {n} · em breve
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 7. CHAMADA FINAL */}
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <div className="gh-box gh-box-lg p-8 sm:p-12">
              <h2 className="gh-display max-w-3xl text-3xl uppercase sm:text-5xl">
                Comece pela necessidade do seu negócio.
              </h2>
              <p className="mt-4 max-w-xl text-[#5e5a50]">
                Conheça os aplicativos do Grupo MyFoods e descubra como simplificar a gestão do seu
                estabelecimento.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ContactButton className="gh-btn gh-btn-primary gh-press">
                  <MessageCircle className="size-4" aria-hidden /> Fale com a MyFoods
                </ContactButton>
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

        {/* 8. RODAPÉ */}
        <footer className="border-t-2 border-[#09090b] bg-[#09090b] text-[#f8f4e8]">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <img src={BRAND_LOGO} alt="" className="size-14 rounded-lg bg-[#f8f4e8] object-contain p-1" />
              <p className="gh-display mt-3 text-lg uppercase">{GROUP_NAME}</p>
              <p className="mt-1 text-sm text-[#f8f4e8]/70">{GROUP_TAGLINE}</p>
            </div>
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Aplicativos</h2>
              <ul className="space-y-2 text-sm">
                {APPS.map((a) => (
                  <li key={a.id}>
                    <a href={`#app-${a.id}`} className="hover:text-[#d2e823]">
                      {a.name}
                      {a.status === "soon" ? " · em breve" : ""}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Acesso</h2>
              <ul className="space-y-2 text-sm">
                <li><Link to="/auth" className="hover:text-[#d2e823]">Entrar no painel</Link></li>
                <li><Link to="/portal/login" className="hover:text-[#d2e823]">Portal do colaborador</Link></li>
              </ul>
            </div>
            <div>
              <h2 className="gh-mono mb-3 text-[11px] text-[#d2e823]">Contato</h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href={contactHref()} target="_blank" rel="noopener noreferrer" className="hover:text-[#d2e823]">
                    WhatsApp {CONTACT_WHATSAPP_LABEL}
                  </a>
                </li>
                <li>
                  <a href={SITE_URL} className="hover:text-[#d2e823]">
                    {SITE_URL.replace("https://", "")}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <p className="gh-mono border-t-2 border-[#f8f4e8]/20 px-6 py-6 text-center text-[10px]">
            {GROUP_NAME} · {GROUP_TAGLINE}
          </p>
        </footer>
      </div>
    </div>
  );
}
