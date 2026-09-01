-- Escalas avançadas
DROP POLICY IF EXISTS schedules_unit_all ON public.schedules;
CREATE POLICY schedules_select ON public.schedules FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY schedules_write ON public.schedules FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'schedules_advanced'))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'schedules_advanced'));

DROP POLICY IF EXISTS shifts_unit_all ON public.shifts;
CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY shifts_write ON public.shifts FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'shifts'))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'shifts'));

DROP POLICY IF EXISTS schedule_templates_unit_all ON public.schedule_templates;
CREATE POLICY schedule_templates_select ON public.schedule_templates FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY schedule_templates_write ON public.schedule_templates FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'schedule_templates'))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'schedule_templates'));

-- Estoque
DROP POLICY IF EXISTS inventory_items_unit_all ON public.inventory_items;
CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id));
CREATE POLICY inventory_items_write ON public.inventory_items FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'inventory'))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_unit_access(unit_id) AND app_auth.has_feature(company_id, 'inventory'));

-- Vendas
DROP POLICY IF EXISTS sales_orders_company_all ON public.sales_orders;
CREATE POLICY sales_orders_select ON public.sales_orders FOR SELECT TO authenticated
  USING (app_auth.in_company(company_id));
CREATE POLICY sales_orders_write ON public.sales_orders FOR ALL TO authenticated
  USING (app_auth.in_company(company_id) AND app_auth.has_feature(company_id, 'sales'))
  WITH CHECK (app_auth.in_company(company_id) AND app_auth.has_feature(company_id, 'sales'));