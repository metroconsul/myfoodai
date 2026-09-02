/**
 * Configuração centralizada de planos e preços da landing page.
 * Altere valores, limites e funcionalidades aqui — a seção de preços
 * reflete automaticamente sem duplicar markup.
 */

export type BillingCycle = "monthly" | "yearly";

export interface PlanLimit {
  label: string;
  value: string;
}

export interface Plan {
  id: string;
  name: string;
  label: string;
  description: string;
  monthlyPrice: string;
  yearlyMonthlyEquivalent: string;
  yearlyTotal: string;
  yearlyNote: string;
  limits: PlanLimit[];
  cta: string;
  highlighted?: boolean;
  highlightBadge?: string;
}

export const YEARLY_DISCOUNT_LABEL = "Anual — economize 20%";

export const PLANS: Plan[] = [
  {
    id: "comeco",
    name: "Começo",
    label: "Para começar a organizar",
    description:
      "Para microempresas e operações pequenas que querem sair das planilhas e começar a organizar a rotina.",
    monthlyPrice: "R$ 79,90",
    yearlyMonthlyEquivalent: "R$ 63,92",
    yearlyTotal: "R$ 767,04/ano",
    yearlyNote: "cobrado anualmente — 20% de desconto",
    limits: [
      { label: "Colaboradores ativos", value: "Até 5" },
      { label: "Empresas", value: "1" },
      { label: "Unidades", value: "1" },
      { label: "Usuários administrativos", value: "Ilimitado" },
      { label: "Portal do Colaborador", value: "Até 5 colaboradores" },
    ],
    cta: "Começar agora",
  },
  {
    id: "essencial",
    name: "Essencial",
    label: "Para pequenas empresas em operação",
    description:
      "Para empresas que já têm uma equipe em operação e precisam acompanhar a rotina com mais controle.",
    monthlyPrice: "R$ 149,90",
    yearlyMonthlyEquivalent: "R$ 119,92",
    yearlyTotal: "R$ 1.439,04/ano",
    yearlyNote: "cobrado anualmente — 20% de desconto",
    highlighted: true,
    highlightBadge: "Mais escolhido",
    limits: [
      { label: "Colaboradores ativos", value: "Até 10" },
      { label: "Empresas", value: "1" },
      { label: "Unidades", value: "1" },
      { label: "Usuários administrativos", value: "Até 3" },
      { label: "Portal do Colaborador", value: "Até 10 pessoas" },
    ],
    cta: "Começar agora",
  },
  {
    id: "equipe",
    name: "Equipe",
    label: "Para operações em crescimento",
    description:
      "Para pequenas e médias empresas que precisam coordenar mais pessoas, processos e indicadores.",
    monthlyPrice: "R$ 249,90",
    yearlyMonthlyEquivalent: "R$ 199,92",
    yearlyTotal: "R$ 2.399,04/ano",
    yearlyNote: "cobrado anualmente — 20% de desconto",
    limits: [
      { label: "Colaboradores ativos", value: "Até 25" },
      { label: "Empresas", value: "1" },
      { label: "Unidades", value: "Até 2" },
      { label: "Usuários administrativos", value: "Até 5" },
      { label: "Portal do Colaborador", value: "Até 25 pessoas" },
    ],
    cta: "Começar agora",
  },
];

export interface ComparisonRow {
  feature: string;
  values: [string, string, string];
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Colaboradores ativos", values: ["Até 5", "Até 10", "Até 25"] },
  { feature: "Empresas", values: ["1", "1", "1"] },
  { feature: "Unidades", values: ["1", "1", "Até 2"] },
  { feature: "Usuários administrativos", values: ["1", "Até 3", "Até 5"] },
  { feature: "Portal do Colaborador", values: ["Sim", "Sim", "Sim"] },
  { feature: "Escalas e turnos", values: ["Básico", "Completo", "Avançado"] },
  { feature: "Ponto pelo celular/navegador", values: ["Sim", "Sim", "Sim"] },
  { feature: "Geolocalização", values: ["Básica", "Sim", "Sim"] },
  { feature: "Revisão de ponto", values: ["Manual", "Completa", "Completa com auditoria"] },
  { feature: "Banco de horas", values: ["—", "Básico", "Completo"] },
  { feature: "Estoque mínimo", values: ["Sim", "Sim", "Sim"] },
  { feature: "Validade e perdas", values: ["—", "Sim", "Sim"] },
  { feature: "Estoque por unidade", values: ["—", "—", "Sim"] },
  { feature: "Transferência entre unidades", values: ["—", "—", "Sim"] },
  { feature: "Dashboard", values: ["Básico", "Operacional", "Avançado"] },
  { feature: "Relatórios", values: ["Básicos", "Avançados", "Comparativos"] },
  { feature: "Auditoria", values: ["Básica", "Histórico", "Completa"] },
  { feature: "Suporte", values: ["Central de ajuda", "WhatsApp", "WhatsApp prioritário"] },
  { feature: "Onboarding guiado", values: ["—", "—", "Sim"] },
];

export interface PricingFaq {
  question: string;
  answer: string;
}

export const PRICING_FAQ: PricingFaq[] = [
  {
    question: "Posso trocar de plano depois?",
    answer:
      "Sim. Você poderá fazer upgrade ou downgrade conforme sua equipe e sua operação mudarem. A aplicação respeita o ciclo de cobrança e informa claramente qualquer diferença proporcional.",
  },
  {
    question: "O desconto anual é de quanto?",
    answer:
      "O plano anual oferece 20% de desconto em relação ao valor mensal. O preço equivalente mensal aparece na seleção anual e a cobrança é feita anualmente.",
  },
  {
    question: "O Portal do Colaborador está incluído?",
    answer:
      "Sim. O Portal do Colaborador está incluído nos três planos, respeitando o limite de colaboradores de cada plano.",
  },
  {
    question: "O que acontece quando eu atingir o limite de colaboradores?",
    answer:
      "Você poderá fazer upgrade para o próximo plano. Não bloqueamos a operação sem aviso: mostramos um alerta antecipado e orientamos o gestor sobre a mudança.",
  },
  {
    question: "Preciso instalar um aplicativo?",
    answer:
      "O acesso ao Portal do Colaborador funciona pelo navegador do celular. Se houver aplicativo nativo disponível no futuro, ele poderá ser apresentado separadamente.",
  },
];
