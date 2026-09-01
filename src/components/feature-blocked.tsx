import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PLAN_LABELS, type PlanCode } from "@/config/features";
import { Button } from "@/components/ui/button";

/**
 * Tela amigável para recursos fora do plano contratado.
 * Não revela dados de outras contas nem quebra a navegação.
 */
export function FeatureBlocked({
  planCode,
  title = "Recurso não incluído no seu plano",
}: {
  planCode: string;
  title?: string;
}) {
  const label = PLAN_LABELS[(planCode as PlanCode) ?? "comeco"] ?? "seu plano";
  return (
    <div className="mx-auto max-w-lg rounded-[12px] border-2 border-foreground bg-card p-8 text-center shadow-[4px_4px_0_var(--ink)]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-[10px] border-2 border-foreground bg-accent shadow-[2px_2px_0_var(--ink)]">
        <Lock className="size-6" aria-hidden />
      </span>
      <h1 className="display-type mt-4 text-xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este módulo não faz parte do {label}. Sua operação continua funcionando normalmente nos
        recursos incluídos.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/app">Voltar para a visão geral</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="/#planos">Ver planos</a>
        </Button>
      </div>
    </div>
  );
}
