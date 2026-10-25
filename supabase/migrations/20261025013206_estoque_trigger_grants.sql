-- MyFoods Estoque: funções de gatilho não ficam expostas pela API (só rodam como gatilho).
REVOKE ALL ON FUNCTION public.stock_guard_quantity(), public.stock_initial_balance() FROM PUBLIC, anon, authenticated;
