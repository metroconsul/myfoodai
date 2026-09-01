import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Minus, ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutSession } from "@/lib/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPARISON_ROWS,
  PLANS,
  PRICING_FAQ,
  YEARLY_DISCOUNT_LABEL,
  type BillingCycle,
  type Plan,
} from "@/config/plans";

function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  const options: { id: BillingCycle; label: string }[] = [
    { id: "monthly", label: "Mensal" },
    { id: "yearly", label: YEARLY_DISCOUNT_LABEL },
  ];
  return (
    <div
      role="tablist"
      aria-label="Periodicidade de cobrança"
      className="inline-flex rounded-xl border-2 border-[#09090b] bg-[#fffdf6] p-1 shadow-[4px_4px_0_#09090b]"
    >
      {options.map((opt) => {
        const active = cycle === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={[
              "gh-mono rounded-lg border-2 px-4 py-2 text-xs font-bold transition-colors sm:text-sm",
              active
                ? "border-[#09090b] bg-[#d2e823] text-[#09090b]"
                : "border-transparent text-[#5e5a50] hover:text-[#09090b]",
              "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#d2e823]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const yearly = cycle === "yearly";
  const price = yearly ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice;
  const navigate = useNavigate();
  const startCheckout = useServerFn(createCheckoutSession);
  const [loading, setLoading] = useState(false);

  const handleCta = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      const { url } = await startCheckout({
        data: { planId: plan.id, cycle, origin: window.location.origin },
      });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao iniciar o checkout.";
      if (message.toLowerCase().includes("unauthorized")) {
        navigate({ to: "/auth" });
        return;
      }
      toast.error("Não foi possível iniciar o pagamento. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <article
      className={[
        "gh-box gh-box-lg relative flex h-full flex-col p-6",
        plan.highlighted ? "border-[#09090b] bg-[#fffdf6]" : "",
      ].join(" ")}
    >
      {plan.highlighted ? (
        <span className="gh-mono absolute -top-4 left-1/2 -translate-x-1/2 rounded-md border-2 border-[#09090b] bg-[#d2e823] px-3 py-1 text-[11px] font-bold shadow-[4px_4px_0_#09090b]">
          {plan.highlightBadge}
        </span>
      ) : null}

      <header>
        <h3 className="gh-display text-2xl uppercase">{plan.name}</h3>
        <p className="gh-mono mt-1 text-[11px] font-bold text-[#5e5a50]">{plan.label}</p>
        <p className="mt-3 text-sm text-[#5e5a50]">{plan.description}</p>
      </header>

      <div className="mt-5 rounded-xl border-2 border-[#09090b] bg-[#f8f4e8] p-4">
        <p className="gh-display text-4xl">
          {price}
          <span className="text-base">/mês</span>
        </p>
        {yearly ? (
          <div className="mt-2 space-y-1">
            <p className="gh-mono text-[11px] text-[#5e5a50]">
              <s>{plan.monthlyPrice}/mês</s> · {plan.yearlyNote}
            </p>
            <p className="gh-mono text-[11px] font-bold">Total: {plan.yearlyTotal}</p>
          </div>
        ) : (
          <p className="gh-mono mt-2 text-[11px] text-[#5e5a50]">
            No anual: {plan.yearlyMonthlyEquivalent}/mês · {plan.yearlyTotal}
          </p>
        )}
      </div>

      <ul className="mt-5 space-y-2 border-y-2 border-[#09090b] py-4">
        {plan.limits.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-[#5e5a50]">{l.label}</span>
            <span className="gh-mono text-right text-xs font-bold">{l.value}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/auth"
        className="gh-btn gh-btn-primary gh-press mt-6 w-full justify-center"
      >
        {plan.cta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </article>
  );
}

function CellValue({ value }: { value: string }) {
  if (value === "—") {
    return (
      <span className="inline-flex items-center gap-1 text-[#5e5a50]">
        <Minus className="size-4" aria-hidden />
        <span className="sr-only">Não incluído</span>
      </span>
    );
  }
  if (value === "Sim") {
    return (
      <span className="inline-flex items-center gap-1.5 font-bold">
        <Check className="size-4 shrink-0" aria-hidden /> Sim
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

function ComparisonTable() {
  return (
    <div className="mt-16">
      <h3 className="gh-display text-2xl uppercase sm:text-3xl">Compare os planos</h3>

      {/* Desktop: tabela */}
      <div className="gh-box gh-box-lg mt-6 hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">
            Comparação de recursos entre os planos Começo, Essencial e Equipe
          </caption>
          <thead>
            <tr className="border-b-2 border-[#09090b] bg-[#f8f4e8]">
              <th scope="col" className="gh-mono p-4 text-xs font-bold">
                Recurso
              </th>
              {PLANS.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={[
                    "gh-display p-4 text-sm uppercase",
                    p.highlighted ? "bg-[#d2e823]" : "",
                  ].join(" ")}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, i) => (
              <tr
                key={row.feature}
                className={i % 2 === 0 ? "bg-[#fffdf6]" : "bg-[#f8f4e8]"}
              >
                <th scope="row" className="p-4 text-sm font-medium">
                  {row.feature}
                </th>
                {row.values.map((v, vi) => (
                  <td
                    key={vi}
                    className={[
                      "p-4",
                      PLANS[vi]?.highlighted ? "bg-[#d2e823]/40" : "",
                    ].join(" ")}
                  >
                    <CellValue value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: accordion por plano */}
      <div className="mt-6 space-y-3 md:hidden">
        {PLANS.map((plan, pi) => (
          <details key={plan.id} className="gh-box group p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="gh-display text-base uppercase">{plan.name}</span>
              <ChevronDown
                className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <ul className="space-y-2 border-t-2 border-[#09090b] p-4">
              {COMPARISON_ROWS.map((row) => (
                <li
                  key={row.feature}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-[#5e5a50]">{row.feature}</span>
                  <span className="text-right font-bold">
                    <CellValue value={row.values[pi] ?? "—"} />
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function PricingFaq() {
  return (
    <div className="mt-16">
      <h3 className="gh-display text-2xl uppercase sm:text-3xl">Perguntas frequentes</h3>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PRICING_FAQ.map((item) => (
          <details key={item.question} className="gh-box group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <ChevronDown
                className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <p className="mt-3 text-sm text-[#5e5a50]">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section
      id="planos"
      aria-labelledby="planos-title"
      className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16"
    >
      <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 id="planos-title" className="gh-display gh-glitch text-3xl uppercase sm:text-4xl">
            Um plano para cada fase da sua operação.
          </h2>
          <p className="mt-3 text-lg text-[#5e5a50]">
            Comece pequeno, organize a rotina e cresça sem trocar de sistema.
          </p>
          <p className="mt-2 text-sm text-[#5e5a50]">
            Todos os planos incluem o núcleo essencial para acompanhar pessoas, escalas, ponto,
            estoque e vendas. O que muda é a capacidade da operação, o número de colaboradores, as
            unidades e os recursos avançados.
          </p>
        </div>
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </div>

      <div className="mt-10 grid items-stretch gap-6 pt-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} cycle={cycle} />
        ))}
      </div>

      <ComparisonTable />
      <PricingFaq />
    </section>
  );
}
