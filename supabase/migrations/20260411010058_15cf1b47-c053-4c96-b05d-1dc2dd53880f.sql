
-- ============================================================
-- FIX 1: Change admin-only policies from {public} to {authenticated}
-- This prevents anon users from ever triggering has_role() checks
-- ============================================================

-- help_articles
DROP POLICY IF EXISTS "Admins can manage help articles" ON public.help_articles;
CREATE POLICY "Admins can manage help articles"
  ON public.help_articles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- compliance_audit_logs INSERT
DROP POLICY IF EXISTS "Admins can insert compliance logs" ON public.compliance_audit_logs;
CREATE POLICY "Admins can insert compliance logs"
  ON public.compliance_audit_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- compliance_audit_logs SELECT
DROP POLICY IF EXISTS "Admins can view compliance logs" ON public.compliance_audit_logs;
CREATE POLICY "Admins can view compliance logs"
  ON public.compliance_audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- race_results_imports INSERT
DROP POLICY IF EXISTS "Admins can create imports" ON public.race_results_imports;
CREATE POLICY "Admins can create imports"
  ON public.race_results_imports FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- race_results_imports SELECT
DROP POLICY IF EXISTS "Admins can view all imports" ON public.race_results_imports;
CREATE POLICY "Admins can view all imports"
  ON public.race_results_imports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- match_queue admin policies
DROP POLICY IF EXISTS "Admins can delete queue entries" ON public.match_queue;
CREATE POLICY "Admins can delete queue entries"
  ON public.match_queue FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage queue" ON public.match_queue;
CREATE POLICY "Admins can manage queue"
  ON public.match_queue FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update queue" ON public.match_queue;
CREATE POLICY "Admins can update queue"
  ON public.match_queue FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- match_queue user policies (from public to authenticated)
DROP POLICY IF EXISTS "Users can cancel own pending entries" ON public.match_queue;
CREATE POLICY "Users can cancel own pending entries"
  ON public.match_queue FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND (status = 'pending'::text))
  WITH CHECK (status = 'cancelled'::text);

DROP POLICY IF EXISTS "Users can insert into queue" ON public.match_queue;
CREATE POLICY "Users can insert into queue"
  ON public.match_queue FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own queue entries" ON public.match_queue;
CREATE POLICY "Users can view their own queue entries"
  ON public.match_queue FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- feature_flags admin
DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- contest_pools admin
DROP POLICY IF EXISTS "Admins can manage pools" ON public.contest_pools;
CREATE POLICY "Admins can manage pools"
  ON public.contest_pools FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- contest_entries admin
DROP POLICY IF EXISTS "Admins can manage entries" ON public.contest_entries;
CREATE POLICY "Admins can manage entries"
  ON public.contest_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- contest_entries user view (from public to authenticated)
DROP POLICY IF EXISTS "Users can view their own entries" ON public.contest_entries;
CREATE POLICY "Users can view their own entries"
  ON public.contest_entries FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- contest_templates admin
DROP POLICY IF EXISTS "Admins can manage contest templates" ON public.contest_templates;
CREATE POLICY "Admins can manage contest templates"
  ON public.contest_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- contest_scores admin
DROP POLICY IF EXISTS "Admins can manage scores" ON public.contest_scores;
CREATE POLICY "Admins can manage scores"
  ON public.contest_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- contest_scores user view (from public to authenticated)
DROP POLICY IF EXISTS "Users can view their own scores" ON public.contest_scores;
CREATE POLICY "Users can view their own scores"
  ON public.contest_scores FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- payment_sessions admin
DROP POLICY IF EXISTS "Admins can view all payment sessions" ON public.payment_sessions;
CREATE POLICY "Admins can view all payment sessions"
  ON public.payment_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- payment_sessions insert (from public to authenticated)
DROP POLICY IF EXISTS "System can insert payment sessions" ON public.payment_sessions;
CREATE POLICY "System can insert payment sessions"
  ON public.payment_sessions FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- payment_sessions user view (from public to authenticated)
DROP POLICY IF EXISTS "Users can view their own payment sessions" ON public.payment_sessions;
CREATE POLICY "Users can view their own payment sessions"
  ON public.payment_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- support_tickets admin
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- support_tickets user view (from public to authenticated)
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR ((user_id IS NULL) AND (email IN (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()))));

-- contest_pool_crews admin
DROP POLICY IF EXISTS "Admins can manage contest crews" ON public.contest_pool_crews;
CREATE POLICY "Admins can manage contest crews"
  ON public.contest_pool_crews FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- responsible_gaming (from public to authenticated)
DROP POLICY IF EXISTS "Users can insert their own responsible gaming settings" ON public.responsible_gaming;
CREATE POLICY "Users can insert their own responsible gaming settings"
  ON public.responsible_gaming FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own responsible gaming settings" ON public.responsible_gaming;
CREATE POLICY "Users can update their own responsible gaming settings"
  ON public.responsible_gaming FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own responsible gaming settings" ON public.responsible_gaming;
CREATE POLICY "Users can view their own responsible gaming settings"
  ON public.responsible_gaming FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ledger_entries admin
DROP POLICY IF EXISTS "Admins can view all ledger entries" ON public.ledger_entries;
CREATE POLICY "Admins can view all ledger entries"
  ON public.ledger_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ledger_entries user view (from public to authenticated)
DROP POLICY IF EXISTS "Users can view their own ledger entries" ON public.ledger_entries;
CREATE POLICY "Users can view their own ledger entries"
  ON public.ledger_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- FIX 2: Remove user self-update on contest_entries
-- Users should never directly update their entries; all
-- modifications go through RPCs (withdraw, scoring, etc.)
-- ============================================================

DROP POLICY IF EXISTS "System can update entries" ON public.contest_entries;
-- Only service_role (via RPCs) and admins can update entries
CREATE POLICY "Only service role can update entries"
  ON public.contest_entries FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);
