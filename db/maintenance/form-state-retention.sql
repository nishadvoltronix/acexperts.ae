-- Operator-only scheduled maintenance. Run with psql -v form_scope=approved_scope
-- after approving retention and backup policies. Never grant DELETE to web role.
-- This does NOT release pending, uncertain or timeout claims: reconcile them
-- against provider evidence before explicitly changing their status.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL synchronous_commit = on;
DELETE FROM acexperts_forms.consent_events
  WHERE scope = :'form_scope' AND retain_until <= clock_timestamp();
DELETE FROM acexperts_forms.submissions
  WHERE scope = :'form_scope' AND status IN ('accepted', 'rejected')
    AND retry_after <= clock_timestamp();
COMMIT;
