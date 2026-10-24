-- Fundação dos aplicativos (F1): papéis do MyFoods Caixa & Financeiro, aprovados em 2026-10-24.
--   cashier = operador de caixa (abre, movimenta e fecha caixa; vê vendas das unidades vinculadas)
--   finance = financeiro (dashboard, lançamentos, contas, relatórios)
-- Aditivo. Fica numa migration própria porque um valor novo de enum só pode ser usado
-- depois que a transação que o criou for confirmada.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
