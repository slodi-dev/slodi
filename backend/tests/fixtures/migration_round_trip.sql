-- Rows for the Migrations CI job to carry through `alembic downgrade base`.
--
-- An empty database hides downgrades that only fail when a table has rows,
-- such as re-adding a NOT NULL column with no value (#144). This puts at least
-- one row in every table, loaded at head, so each downgrade() meets real data.
--
-- It is written against the schema at head. When a migration adds a required
-- column or a table, this file needs the matching change, and CI fails at the
-- "Load fixture rows" step until it has one. That is the point: the new
-- downgrade() should be exercised with data too.

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO users (id, auth0_id, name, email, permissions, pronouns) VALUES
  ('00000000-0000-4000-8000-000000000001', 'auth0|round-trip-admin', 'Stjórnandi', 'admin@example.is', 'admin', 'they_them'),
  ('00000000-0000-4000-8000-000000000002', 'auth0|round-trip-member', 'Foringi', 'member@example.is', 'member', NULL);

INSERT INTO groups (id, name) VALUES
  ('00000000-0000-4000-8000-000000000101', 'Skátafélag');
INSERT INTO group_memberships (user_id, group_id, role) VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'owner');

INSERT INTO workspaces (id, name, default_meeting_weekday, default_start_time, default_end_time, default_interval, season_start) VALUES
  ('00000000-0000-4000-8000-000000000201', 'Dagskrárbankinn', 'tuesday', '18:00', '19:30', 'weekly', '2026-09-01');
INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'editor');
INSERT INTO troops (id, name, workspace_id) VALUES
  ('00000000-0000-4000-8000-000000000301', 'Fálkar', '00000000-0000-4000-8000-000000000201');

INSERT INTO tags (id, name) VALUES
  ('00000000-0000-4000-8000-000000000401', 'Útivera'),
  ('00000000-0000-4000-8000-000000000402', 'Leikir');

-- One of each content type, across review states, with every range filled.
INSERT INTO content (id, content_type, name, description, instructions, created_at, author_id, workspace_id,
                     review_state, hidden_at, age, count_min, count_max, duration_min, duration_max,
                     prep_time_min, prep_time_max, equipment, price, location) VALUES
  ('00000000-0000-4000-8000-000000000501', 'program', 'Kvöldvaka', 'Söngur og leikir', 'Kveikið eld',
   now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201',
   'approved', NULL, ARRAY['Drekaskátar', 'Fálkaskátar']::age_group_enum[], 5, 30, 60, 90, 10, 20, '["Gítar"]', 0, 'Úlfljótsvatn'),
  ('00000000-0000-4000-8000-000000000502', 'event', 'Fjallganga', 'Upp á Esju', NULL,
   now(), '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201',
   'rejected', NULL, ARRAY['Dróttskátar']::age_group_enum[], 4, 12, 180, 300, 30, 60, '["Nesti", "Regnföt"]', 500, 'Esja'),
  ('00000000-0000-4000-8000-000000000503', 'task', 'Kveikjuleikur', 'Hlaupaleikur', 'Myndið hring',
   now(), '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000201',
   'unreviewed', now(), ARRAY['Hrefnuskátar']::age_group_enum[], 6, 40, 15, 25, 0, 5, '["Spottar"]', 0, NULL);
INSERT INTO programs (id) VALUES ('00000000-0000-4000-8000-000000000501');
INSERT INTO events (id, program_id) VALUES ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000501');
INSERT INTO tasks (id, event_id) VALUES ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000502');
INSERT INTO troop_participation (troop_id, event_id) VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000502');

INSERT INTO content_tags (content_id, tag_id) VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000401'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000402');
INSERT INTO comments (id, body, created_at, user_id, content_id) VALUES
  ('00000000-0000-4000-8000-000000000601', 'Frábær dagskrá', now(), '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000501');
INSERT INTO likes (user_id, content_id) VALUES
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000501');

-- Moderation: an open report on an item, a resolved one on a comment, notes,
-- and one open-ended and one lifted suspension.
INSERT INTO content_reports (id, content_id, comment_id, reporter_id, reason, status, created_at, resolved_at) VALUES
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000503', NULL, '00000000-0000-4000-8000-000000000001', 'unsafe', 'open', now(), NULL),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', 'spam', 'dismissed', now(), now());
INSERT INTO review_comments (id, content_id, body, visibility, created_at) VALUES
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000502', 'Vantar búnaðarlista', 'to_author', now()),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000502', 'Skoðum aftur í vikunni', 'internal', now());
INSERT INTO posting_suspensions (id, user_id, starts_at, expires_at, reason, created_at, lifted_at, lift_reason) VALUES
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000002', now(), NULL, 'Ítrekað ruslefni', now(), NULL, NULL),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000002', now() - interval '60 days', now() - interval '30 days', 'Próf', now() - interval '60 days', now() - interval '45 days', 'Mistök');

-- Email and games. Migrations seed the first puzzles, so this one is numbered
-- well clear of them.
INSERT INTO emaillist (email, unsubscribe_token) VALUES
  ('frettir@example.is', '00000000-0000-4000-8000-000000001001');
INSERT INTO email_drafts (subject, template, created_by) VALUES
  ('Haustfréttir', 'Halló {{nafn}}', '00000000-0000-4000-8000-000000000001');
INSERT INTO heidursordla_puzzles (id, puzzle_number, answer, unlocks_at, locks_at) VALUES
  ('00000000-0000-4000-8000-000000001101', 9001, 'hnýta', now(), now() + interval '1 day');
INSERT INTO heidursordla_attempts (user_id, puzzle_id, guesses, status) VALUES
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000001101', '["skáti", "hnýta"]', 'won');
INSERT INTO game_scores (id, user_id, user_name, game_slug, score) VALUES
  ('00000000-0000-4000-8000-000000001201', '00000000-0000-4000-8000-000000000002', 'Foringi', 'laddi-bird', 42);
INSERT INTO game_saves (id, user_id, game_slug, state, revision) VALUES
  ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000000002', 'arnor-clicker', '{"points": 1200}', 3);

COMMIT;

-- Fail if a table is missing from the list above, so a new table cannot
-- quietly go through the round trip empty.
DO $$
DECLARE
  t text;
  has_rows boolean;
  empty_tables text[] := '{}';
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'alembic_version'
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', t) INTO has_rows;
    IF NOT has_rows THEN
      empty_tables := empty_tables || t;
    END IF;
  END LOOP;
  IF cardinality(empty_tables) > 0 THEN
    RAISE EXCEPTION 'migration_round_trip.sql leaves these tables empty: %',
      array_to_string(empty_tables, ', ');
  END IF;
END $$;
