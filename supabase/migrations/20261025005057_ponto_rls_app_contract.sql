-- MyFoods Ponto — P2: regras de acesso no banco (plano em docs/PONTO_PLANO_SEPARACAO.md).
-- 1) Toda tabela de ponto passa a exigir o app Ponto contratado (app_ponto).
-- 2) Ler e alterar dados de ponto fica restrito aos papéis de gestão do ponto
--    (dono, admin, gerente de unidade, RH, supervisor), respeitando a unidade.
-- O Portal do Colaborador, as rotinas de automação e o cálculo de cartões no servidor usam service_role
-- e não passam por estas regras. Nenhum dado é alterado; só as políticas.

-- Funções auxiliares ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_auth.ponto_enabled(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.in_company(_company_id) AND app_auth.has_feature(_company_id, 'app_ponto');
$$;

CREATE OR REPLACE FUNCTION app_auth.can_manage_ponto()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]);
$$;

-- App contratado + papel de gestão + acesso à unidade (unidade nula = registro da empresa toda).
CREATE OR REPLACE FUNCTION app_auth.ponto_unit(_company_id uuid, _unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_auth AS $$
  SELECT app_auth.ponto_enabled(_company_id) AND app_auth.can_manage_ponto() AND app_auth.has_unit_access(_unit_id);
$$;

REVOKE ALL ON FUNCTION app_auth.ponto_enabled(uuid), app_auth.can_manage_ponto(), app_auth.ponto_unit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_auth.ponto_enabled(uuid), app_auth.can_manage_ponto(), app_auth.ponto_unit(uuid, uuid)
  TO authenticated, service_role;

-- Batidas e pedidos de correção ---------------------------------------------------------------
DROP POLICY IF EXISTS time_entries_unit_select ON public.time_entries;
DROP POLICY IF EXISTS time_entries_unit_write ON public.time_entries;
CREATE POLICY time_entries_ponto ON public.time_entries FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

DROP POLICY IF EXISTS time_entry_reviews_unit_select ON public.time_entry_reviews;
DROP POLICY IF EXISTS time_entry_reviews_unit_write ON public.time_entry_reviews;
CREATE POLICY time_entry_reviews_ponto ON public.time_entry_reviews FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

-- Cartões de ponto e fechamento ---------------------------------------------------------------
DROP POLICY IF EXISTS point_cards_unit_select ON public.point_cards;
DROP POLICY IF EXISTS point_cards_unit_write ON public.point_cards;
CREATE POLICY point_cards_ponto ON public.point_cards FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

DROP POLICY IF EXISTS point_card_events_read ON public.point_card_events;
CREATE POLICY point_card_events_read ON public.point_card_events FOR SELECT TO authenticated
  USING (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto());

DROP POLICY IF EXISTS card_deliveries_select ON public.point_card_deliveries;
DROP POLICY IF EXISTS card_deliveries_write ON public.point_card_deliveries;
CREATE POLICY card_deliveries_ponto ON public.point_card_deliveries FOR ALL TO authenticated
  USING (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto())
  WITH CHECK (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto());

DROP POLICY IF EXISTS point_card_evidence_read ON public.point_card_evidence;
CREATE POLICY point_card_evidence_read ON public.point_card_evidence FOR SELECT TO authenticated
  USING (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto() AND app_auth.can_see_all_units());

DROP POLICY IF EXISTS timesheet_periods_company ON public.timesheet_periods;
CREATE POLICY timesheet_periods_ponto ON public.timesheet_periods FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

DROP POLICY IF EXISTS timesheet_batches_company ON public.timesheet_batches;
CREATE POLICY timesheet_batches_ponto ON public.timesheet_batches FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

-- Linhas do cartão: mesma unidade do cartão (a subconsulta respeita a regra de point_cards).
DROP POLICY IF EXISTS timesheet_entries_company ON public.timesheet_entries;
CREATE POLICY timesheet_entries_ponto ON public.timesheet_entries FOR ALL TO authenticated
  USING (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto()
         AND EXISTS (SELECT 1 FROM public.point_cards pc WHERE pc.id = timesheet_entries.card_id))
  WITH CHECK (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto()
         AND EXISTS (SELECT 1 FROM public.point_cards pc WHERE pc.id = timesheet_entries.card_id));

-- Contestações: abertas pelo colaborador no Portal (servidor); a equipe de gestão lê e responde.
DROP POLICY IF EXISTS timesheet_disputes_read ON public.timesheet_disputes;
DROP POLICY IF EXISTS timesheet_disputes_update ON public.timesheet_disputes;
DROP POLICY IF EXISTS timesheet_disputes_write ON public.timesheet_disputes;
CREATE POLICY timesheet_disputes_read ON public.timesheet_disputes FOR SELECT TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY timesheet_disputes_update ON public.timesheet_disputes FOR UPDATE TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY timesheet_disputes_insert ON public.timesheet_disputes FOR INSERT TO authenticated
  WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

-- Escalas -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS schedules_select ON public.schedules;
DROP POLICY IF EXISTS schedules_write ON public.schedules;
CREATE POLICY schedules_select ON public.schedules FOR SELECT TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY schedules_write ON public.schedules FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'schedules_advanced'))
  WITH CHECK (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'schedules_advanced'));

DROP POLICY IF EXISTS schedule_blocks_unit_all ON public.schedule_blocks;
CREATE POLICY schedule_blocks_ponto ON public.schedule_blocks FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

DROP POLICY IF EXISTS shifts_select ON public.shifts;
DROP POLICY IF EXISTS shifts_write ON public.shifts;
CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY shifts_write ON public.shifts FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'shifts'))
  WITH CHECK (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'shifts'));

DROP POLICY IF EXISTS schedule_templates_select ON public.schedule_templates;
DROP POLICY IF EXISTS schedule_templates_write ON public.schedule_templates;
CREATE POLICY schedule_templates_select ON public.schedule_templates FOR SELECT TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY schedule_templates_write ON public.schedule_templates FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'schedule_templates'))
  WITH CHECK (app_auth.ponto_unit(company_id, unit_id) AND app_auth.has_feature(company_id, 'schedule_templates'));

DROP POLICY IF EXISTS template_items_select ON public.schedule_template_items;
DROP POLICY IF EXISTS template_items_write ON public.schedule_template_items;
CREATE POLICY template_items_select ON public.schedule_template_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = schedule_template_items.template_id AND app_auth.ponto_unit(st.company_id, st.unit_id)));
CREATE POLICY template_items_write ON public.schedule_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = schedule_template_items.template_id AND app_auth.ponto_unit(st.company_id, st.unit_id)
                   AND app_auth.has_feature(st.company_id, 'schedule_templates')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedule_templates st
                 WHERE st.id = schedule_template_items.template_id AND app_auth.ponto_unit(st.company_id, st.unit_id)
                   AND app_auth.has_feature(st.company_id, 'schedule_templates')));

DROP POLICY IF EXISTS schedule_changes_company_select ON public.schedule_changes;
DROP POLICY IF EXISTS schedule_changes_company_write ON public.schedule_changes;
CREATE POLICY schedule_changes_ponto ON public.schedule_changes FOR ALL TO authenticated
  USING (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto())
  WITH CHECK (app_auth.ponto_enabled(company_id) AND app_auth.can_manage_ponto());

DROP POLICY IF EXISTS shift_swap_requests_unit_all ON public.shift_swap_requests;
CREATE POLICY shift_swap_requests_ponto ON public.shift_swap_requests FOR ALL TO authenticated
  USING (app_auth.ponto_unit(company_id, unit_id)) WITH CHECK (app_auth.ponto_unit(company_id, unit_id));

-- Horário padrão da unidade (jornada fixa): lê a gestão do ponto; altera dono/admin/RH/gerente.
DROP POLICY IF EXISTS fixed_schedules_read_company ON public.fixed_work_schedules;
DROP POLICY IF EXISTS fixed_schedules_write_admin ON public.fixed_work_schedules;
CREATE POLICY fixed_schedules_read ON public.fixed_work_schedules FOR SELECT TO authenticated
  USING (company_id = app_auth.current_company_id() AND app_auth.ponto_unit(company_id, unit_id));
CREATE POLICY fixed_schedules_write ON public.fixed_work_schedules FOR ALL TO authenticated
  USING (company_id = app_auth.current_company_id() AND app_auth.ponto_unit(company_id, unit_id)
         AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr']::public.app_role[]))
  WITH CHECK (company_id = app_auth.current_company_id() AND app_auth.ponto_unit(company_id, unit_id)
         AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr']::public.app_role[]));
