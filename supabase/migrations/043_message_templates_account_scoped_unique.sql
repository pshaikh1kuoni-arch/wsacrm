-- ============================================================
-- 043_message_templates_account_scoped_unique
--
-- Follow-up to 017 (account sharing) that never landed: message_templates
-- moved to account_id-scoped RLS and the sync route already matches
-- existing rows by (account_id, name, language), but the table's actual
-- UNIQUE index — added back in 014, before accounts existed — was never
-- migrated off (user_id, name, language). The submit route's upsert
-- (`onConflict: 'user_id,name,language'`) inherited the same scope.
--
-- Symptom: a template submitted or re-synced under one account member's
-- user_id can silently fail to line up with "Sync from Meta" afterwards
-- whenever the row-matching logic and the DB constraint disagree on
-- what counts as "the same template" — the sync route looks it up by
-- account, but nothing at the DB level enforces that account-scoped
-- notion of uniqueness, so a legitimate account-scoped match can still
-- collide with — or fail to be found via — a stale user-scoped
-- constraint. Fix: make the DB uniqueness rule match the scope
-- everything else already uses.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Bail loudly if collapsing to (account_id, name, language) would
--    merge rows that need a human decision (e.g. two teammates each
--    created a same-named draft before this migration ran).
DO $$
DECLARE
  dupe_count INT;
  sample TEXT;
BEGIN
  SELECT count(*) INTO dupe_count
  FROM (
    SELECT account_id, name, language
    FROM message_templates
    GROUP BY account_id, name, language
    HAVING count(*) > 1
  ) dupes;

  IF dupe_count > 0 THEN
    SELECT string_agg(
      account_id::text || ' / ' || name || ' / ' || COALESCE(language, '(null)') ||
        ' (' || count || ' rows)',
      E'\n  '
    )
    INTO sample
    FROM (
      SELECT account_id, name, language, count(*) AS count
      FROM message_templates
      GROUP BY account_id, name, language
      HAVING count(*) > 1
    ) dupe_detail;

    RAISE EXCEPTION
      E'Cannot add UNIQUE(account_id, name, language) on message_templates — % duplicate combination(s):\n  %\nDelete or rename the rows you do not want to keep, then re-run migrations.',
      dupe_count, sample;
  END IF;
END $$;

-- 2. Drop the legacy user-scoped unique index (014) and its dependent
--    upsert conflict target. DROP INDEX also removes the implicit
--    constraint it backed, so nothing downstream is left pointing at it.
DROP INDEX IF EXISTS message_templates_user_name_language_key;

-- 3. Add the account-scoped replacement. This is what the submit
--    route's upsert(onConflict: 'account_id,name,language') and the
--    sync route's account_id-scoped lookup have assumed all along.
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_account_name_language_key
  ON message_templates (account_id, name, language);
