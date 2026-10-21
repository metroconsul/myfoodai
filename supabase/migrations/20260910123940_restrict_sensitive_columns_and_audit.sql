-- PIN hashes and lockout counters are server-only. Expose only a derived status.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS portal_access_enabled boolean
  GENERATED ALWAYS AS (portal_pin_hash IS NOT NULL) STORED;

REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (
  id, company_id, unit_id, full_name, cpf, phone, whatsapp_phone, email,
  employee_code, role_id, team_id, work_regime_id, employment_status,
  hire_date, portal_pin_set_at, portal_access_enabled, avatar_url, created_at, updated_at
) ON public.employees TO authenticated;

DROP POLICY IF EXISTS employees_unit_select ON public.employees;
CREATE POLICY employees_unit_select ON public.employees FOR SELECT TO authenticated
  USING (
    app_auth.in_company(company_id)
    AND app_auth.has_unit_access(unit_id)
    AND app_auth.has_any_role(
      ARRAY['owner','admin','unit_manager','hr','stock_manager','supervisor']::public.app_role[]
    )
  );

-- Audit events are append-only and emitted by trusted server functions.
REVOKE INSERT ON public.audit_logs FROM authenticated;
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;

-- Child rows inherit the same write authorization as their parent workflow.
DROP POLICY IF EXISTS template_items_all ON public.schedule_template_items;
CREATE POLICY template_items_select ON public.schedule_template_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.schedule_templates st
    WHERE st.id = template_id
      AND app_auth.in_company(st.company_id)
      AND app_auth.has_unit_access(st.unit_id)
  ));
CREATE POLICY template_items_write ON public.schedule_template_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.schedule_templates st
    WHERE st.id = template_id
      AND app_auth.in_company(st.company_id)
      AND app_auth.has_unit_access(st.unit_id)
      AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.schedule_templates st
    WHERE st.id = template_id
      AND app_auth.in_company(st.company_id)
      AND app_auth.has_unit_access(st.unit_id)
      AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[])
  ));

DROP POLICY IF EXISTS count_items_all ON public.inventory_count_items;
CREATE POLICY count_items_select ON public.inventory_count_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inventory_counts c
    WHERE c.id = count_id AND app_auth.in_company(c.company_id) AND app_auth.has_unit_access(c.unit_id)
  ));
CREATE POLICY count_items_write ON public.inventory_count_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inventory_counts c
    WHERE c.id = count_id AND app_auth.in_company(c.company_id) AND app_auth.has_unit_access(c.unit_id)
      AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inventory_counts c
    WHERE c.id = count_id AND app_auth.in_company(c.company_id) AND app_auth.has_unit_access(c.unit_id)
      AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','stock_manager']::public.app_role[])
  ));

DROP POLICY IF EXISTS card_deliveries_all ON public.point_card_deliveries;
CREATE POLICY card_deliveries_select ON public.point_card_deliveries FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id)
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]));
CREATE POLICY card_deliveries_write ON public.point_card_deliveries FOR ALL TO authenticated
  USING (app_auth.in_company(company_id)
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]))
  WITH CHECK (app_auth.in_company(company_id)
    AND app_auth.has_any_role(ARRAY['owner','admin','unit_manager','hr','supervisor']::public.app_role[]));

CREATE POLICY portal_login_rate_limits_service_only ON public.portal_login_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
