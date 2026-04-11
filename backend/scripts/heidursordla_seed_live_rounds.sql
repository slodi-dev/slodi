-- Heiðursorðla — live seeding templates for Saturday 2026-04-11 Rounds 3 & 4.
--
-- Rounds 1 and 2 (`hnýta`, `æskan`) are seeded by the Alembic migration
-- `a7b8c9d0e1f2_fix_heidursordla_round_windows.py`. Rounds 3 and 4 are
-- curated live by Halldór during the event, per
-- docs/skatathing/games/heidursordla.md §Open questions.
--
-- HOW TO USE
--
-- 1. Pick an answer. It must be:
--    - exactly 5 characters,
--    - lowercase,
--    - NFC-normalized (single composed codepoints for á é í ó ú ý þ æ ö ð),
--    - present in backend/app/data/icelandic_5_letter_words.txt, OR the guess
--      validator will still accept it because answers aren't cross-checked —
--      but a well-chosen scout word is the whole point.
-- 2. Open `make docker-db-shell` (or equivalent psql session).
-- 3. Copy the block for the round you're seeding, paste it into psql,
--    edit only the `answer` line, and run.
-- 4. Verify with the SELECT at the bottom of this file.
--
-- PRE-FLIGHT NFC CHECK (run this from the repo root before seeding):
--
--     python3 -c "
--     import unicodedata
--     w = 'YOUR_WORD_HERE'
--     nfc = unicodedata.normalize('NFC', w.lower())
--     print(f'input:     {w!r}')
--     print(f'nfc lower: {nfc!r}')
--     print(f'length:    {len(nfc)}')
--     assert nfc == w.lower(), 'INPUT IS NOT NFC — normalize before seeding'
--     assert len(nfc) == 5, f'LENGTH != 5 (got {len(nfc)})'
--     print('OK to seed.')
--     "
--
-- =========================================================================
-- ROUND 3 — 15:30 → 18:00 Atlantic/Reykjavik (= UTC, no DST)
-- =========================================================================

INSERT INTO heidursordla_puzzles (id, puzzle_number, answer, word_length, unlocks_at, locks_at, created_at)
VALUES (
    gen_random_uuid(),
    3,
    'ÞÍNUM',           -- <-- REPLACE with the chosen R3 answer, NFC, lowercase, 5 chars
    5,
    TIMESTAMPTZ '2026-04-11 15:30:00+00:00',
    TIMESTAMPTZ '2026-04-11 18:00:00+00:00',
    NOW()
)
ON CONFLICT (puzzle_number) DO UPDATE SET
    answer     = EXCLUDED.answer,
    unlocks_at = EXCLUDED.unlocks_at,
    locks_at   = EXCLUDED.locks_at;

-- =========================================================================
-- ROUND 4 — 18:00 → 24:00 Atlantic/Reykjavik (= UTC, no DST)
-- Note: locks_at is Sunday 2026-04-12 00:00, the same instant as EVENT_END_AT.
-- =========================================================================

INSERT INTO heidursordla_puzzles (id, puzzle_number, answer, word_length, unlocks_at, locks_at, created_at)
VALUES (
    gen_random_uuid(),
    4,
    'ÞÍNUM',           -- <-- REPLACE with the chosen R4 answer, NFC, lowercase, 5 chars
    5,
    TIMESTAMPTZ '2026-04-11 18:00:00+00:00',
    TIMESTAMPTZ '2026-04-12 00:00:00+00:00',
    NOW()
)
ON CONFLICT (puzzle_number) DO UPDATE SET
    answer     = EXCLUDED.answer,
    unlocks_at = EXCLUDED.unlocks_at,
    locks_at   = EXCLUDED.locks_at;

-- =========================================================================
-- VERIFICATION — run after each seed. Expected: 4 rows on Saturday afternoon.
-- =========================================================================

SELECT
    puzzle_number,
    answer,
    word_length,
    char_length(answer) = 5                              AS length_ok,
    answer = lower(answer)                               AS lowercase_ok,
    unlocks_at AT TIME ZONE 'Atlantic/Reykjavik'         AS unlocks_iceland,
    locks_at   AT TIME ZONE 'Atlantic/Reykjavik'         AS locks_iceland,
    now()      BETWEEN unlocks_at AND locks_at           AS is_live_now
FROM heidursordla_puzzles
ORDER BY puzzle_number;

-- =========================================================================
-- EMERGENCY — remove a just-inserted round (typo, wrong answer, etc.)
-- Only use this before anyone has played the round.
-- =========================================================================
--
-- DELETE FROM heidursordla_attempts WHERE puzzle_id = (SELECT id FROM heidursordla_puzzles WHERE puzzle_number = 3);
-- DELETE FROM heidursordla_puzzles WHERE puzzle_number = 3;
