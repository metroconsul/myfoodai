-- =====================================================================================
-- Correção das vulnerabilidades A (funções de papel sem escopo de empresa) e B (user_units sem
-- isolamento). Revisada (Fase 1.2), testada em Postgres descartável (Fase 1.3) e APLICADA em produção
-- em 2026-10-21 (versão registrada 20261021125126). Plano: docs/FASE1_PLANO_CORRECAO_SEGURANCA.md.
-- Rollback: scripts/security-tests/multitenant/rollback_20261021125126.sql
-- Observação: o bloco-guarda que existia no rascunho foi removido após a aplicação.
-- =====================================================================================

-- Sem BEGIN/COMMIT explícitos: o executor de migrations já aplica cada arquivo de forma
-- atômica e registra a versão em schema_migrations (revisão da Fase 1.2).

-- -------------------------------------------------------------------------------------
-- 1. Funções com escopo explícito de empresa (novas, aditivas).
--    "Escopo da empresa" = empresa ativa do usuário (app_auth.current_company_id()).
--    Todas: SECURITY DEFINER (leem user_roles/profiles sem passar pelo RLS, evitando
--    recursão), search_path fixo, auth.uid() obrigatório onde há sessão.
-- -------------------------------------------------------------------------------------

-- Papel de um usuário QUALQUER numa empresa específica (nunca em outras).
CREATE OR REPLACE FUNCTION app_auth.has_role_in(_user_id uuid, _company_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT _user_id IS NOT NULL AND _company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.company_id = _company_id AND ur.role = _role
  );
$$;

-- Algum papel do usuário autenticado na empresa pedida, que também precisa ser a
-- empresa ativa dele (modelo atual: 1 perfil = 1 empresa).
CREATE OR REPLACE FUNCTION app_auth.has_any_role_in(_company_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND _company_id IS NOT NULL
    AND _company_id = app_auth.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.company_id = _company_id AND ur.role = ANY (_roles)
    );
$$;

CREATE OR REPLACE FUNCTION app_auth.is_company_admin_in(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT app_auth.has_any_role_in(_company_id, ARRAY['owner','admin']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION app_auth.can_manage_payroll_in(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT app_auth.has_any_role_in(_company_id, ARRAY['owner','admin','hr']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION app_auth.can_see_all_units_in(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT app_auth.has_any_role_in(_company_id, ARRAY['owner','admin','hr']::public.app_role[]);
$$;

-- O usuário alvo pertence à empresa informada (perfil = fonte da verdade do tenant).
CREATE OR REPLACE FUNCTION app_auth.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT _user_id IS NOT NULL AND _company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.company_id = _company_id
  );
$$;

-- A unidade pertence à empresa ativa do usuário autenticado.
CREATE OR REPLACE FUNCTION app_auth.unit_in_company(_unit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_auth
AS $$
  SELECT _unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = _unit_id AND u.company_id = app_auth.current_company_id()
  );
$$;

-- -------------------------------------------------------------------------------------
-- 2. Funções legadas (mesma assinatura, usadas por dezenas de políticas): agora
--    delegam às versões com escopo. Nenhuma política precisa ser reescrita para elas.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.is_company_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_auth.is_company_admin_in(app_auth.current_company_id());
$$;

CREATE OR REPLACE FUNCTION app_auth.can_manage_payroll()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_auth.can_manage_payroll_in(app_auth.current_company_id());
$$;

CREATE OR REPLACE FUNCTION app_auth.can_see_all_units()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_auth.can_see_all_units_in(app_auth.current_company_id());
$$;

-- Papel de _user_id restrito à empresa ativa do chamador.
CREATE OR REPLACE FUNCTION app_auth.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_auth.has_role_in(_user_id, app_auth.current_company_id(), _role);
$$;

-- Acesso a unidade: a unidade precisa ser da empresa ativa ANTES de qualquer outra condição
-- (inclusive a de "vê todas as unidades"). unit_id nulo continua verdadeiro, como antes.
-- Incorporado na revisão da Fase 1.3 (teste T12c: sem isso, o dono de A "acessava" unidade de B).
-- Mudança: unit_id inexistente passa a ser falso também para administradores.
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

-- Permissões de execução: só quem avalia RLS (authenticated) e o backend.
REVOKE ALL ON FUNCTION
  app_auth.has_role_in(uuid, uuid, public.app_role),
  app_auth.has_any_role_in(uuid, public.app_role[]),
  app_auth.is_company_admin_in(uuid),
  app_auth.can_manage_payroll_in(uuid),
  app_auth.can_see_all_units_in(uuid),
  app_auth.user_belongs_to_company(uuid, uuid),
  app_auth.unit_in_company(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  app_auth.has_role_in(uuid, uuid, public.app_role),
  app_auth.has_any_role_in(uuid, public.app_role[]),
  app_auth.is_company_admin_in(uuid),
  app_auth.can_manage_payroll_in(uuid),
  app_auth.can_see_all_units_in(uuid),
  app_auth.user_belongs_to_company(uuid, uuid),
  app_auth.unit_in_company(uuid)
TO authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- 3. user_roles — vulnerabilidade A.
--    Antes: with_check = in_company(company_id) AND is_company_admin()  (não olhava o alvo).
--    Agora: o alvo precisa ser da empresa; só owner mexe em papel 'owner'.
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (
    app_auth.in_company(company_id)
    AND app_auth.is_company_admin_in(company_id)
    AND (role <> 'owner' OR app_auth.has_any_role_in(company_id, ARRAY['owner']::public.app_role[]))
  )
  WITH CHECK (
    app_auth.in_company(company_id)
    AND app_auth.is_company_admin_in(company_id)
    AND app_auth.user_belongs_to_company(user_id, company_id)
    AND (role <> 'owner' OR app_auth.has_any_role_in(company_id, ARRAY['owner']::public.app_role[]))
  );
-- user_roles_select permanece: (user_id = auth.uid()) OR (in_company AND is_company_admin),
-- agora seguro porque is_company_admin() passou a ter escopo.

-- Defesa em profundidade para QUALQUER chamador (inclui service_role): o papel só pode
-- apontar para um usuário cujo perfil pertence à mesma empresa. Os fluxos de
-- bootstrapCompany/provisionPilot gravam o perfil ANTES do papel, então continuam válidos.
CREATE OR REPLACE FUNCTION public.enforce_user_role_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'O usuário do papel precisa pertencer à empresa do papel.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_user_role_company() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_user_role_company() TO service_role;

DROP TRIGGER IF EXISTS enforce_user_role_company ON public.user_roles;
CREATE TRIGGER enforce_user_role_company
  BEFORE INSERT OR UPDATE OF user_id, company_id ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_company();

-- -------------------------------------------------------------------------------------
-- 4. user_units — vulnerabilidade B (tabela sem company_id: o tenant vem de units).
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS user_units_select ON public.user_units;
CREATE POLICY user_units_select ON public.user_units
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (app_auth.is_company_admin() AND app_auth.unit_in_company(unit_id))
  );

DROP POLICY IF EXISTS user_units_admin_manage ON public.user_units;
CREATE POLICY user_units_admin_manage ON public.user_units
  FOR ALL TO authenticated
  USING (
    app_auth.is_company_admin()
    AND app_auth.unit_in_company(unit_id)
  )
  WITH CHECK (
    app_auth.is_company_admin()
    AND app_auth.unit_in_company(unit_id)
    AND app_auth.user_belongs_to_company(user_id, app_auth.current_company_id())
  );

CREATE OR REPLACE FUNCTION public.enforce_user_unit_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.units u ON u.company_id = p.company_id
    WHERE p.id = NEW.user_id AND u.id = NEW.unit_id
  ) THEN
    RAISE EXCEPTION 'O usuário e a unidade precisam pertencer à mesma empresa.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_user_unit_company() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_user_unit_company() TO service_role;

DROP TRIGGER IF EXISTS enforce_user_unit_company ON public.user_units;
CREATE TRIGGER enforce_user_unit_company
  BEFORE INSERT OR UPDATE OF user_id, unit_id ON public.user_units
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_unit_company();


-- Grants (anon / subscriptions / PIN): NÃO incluídos de propósito — ver
-- docs/FASE1_PLANO_CORRECAO_SEGURANCA.md, seção "Análise de grants".
--
-- Rollback manual (se aprovado e aplicado): restaurar as definições anteriores de
-- app_auth.{is_company_admin,can_manage_payroll,can_see_all_units,has_role,has_unit_access}
-- (migration 20260831211015), recriar as políticas user_roles_admin_manage,
-- user_units_select e user_units_admin_manage (migration 20260829134240), e executar
-- DROP TRIGGER enforce_user_role_company / enforce_user_unit_company + DROP das funções novas.
