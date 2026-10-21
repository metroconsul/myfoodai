-- PROPOSTA JÁ INCORPORADA à migration 20261021120000 (Fase 1.3, T12c). Mantida só como registro histórico.
-- PROPOSTA (não faz parte da migration 20261021120000; não aprovada; nunca aplicada fora do contêiner de teste).
-- Motivo: no teste T12c, app_auth.has_unit_access(<unidade de B>) retorna TRUE para o dono/admin/RH da empresa A,
-- porque can_see_all_units() agora tem escopo de empresa, mas não confere se a UNIDADE pertence a essa empresa.
-- As políticas continuam protegidas por in_company(company_id) da linha; o defeito está na própria função.
-- Correção: exigir unit_in_company(_unit_id) antes de qualquer outra condição (unit_id nulo continua verdadeiro).
-- Mudança de comportamento: um unit_id inexistente passa a ser falso também para admins (hoje seria verdadeiro).
CREATE OR REPLACE FUNCTION app_auth.has_unit_access(_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _unit_id IS NULL
    OR (
      app_auth.unit_in_company(_unit_id)
      AND (
        app_auth.can_see_all_units()
        OR EXISTS (
          SELECT 1 FROM public.user_units uu
          WHERE uu.user_id = auth.uid() AND uu.unit_id = _unit_id
        )
      )
    );
$$;
