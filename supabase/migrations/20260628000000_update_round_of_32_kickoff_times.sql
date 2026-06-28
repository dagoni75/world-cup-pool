-- Update only Round of 32 kickoff times to the official FIFA World Cup 2026 schedule.
-- Team assignments, scores, bracket slots, and later rounds are intentionally unchanged.

with official_round_of_32_times(bracket_slot, starts_at) as (
  values
    ('R32-1',  '2026-06-28T19:00:00+00:00'::timestamptz), -- Match 73
    ('R32-2',  '2026-06-29T20:30:00+00:00'::timestamptz), -- Match 74
    ('R32-3',  '2026-06-30T01:00:00+00:00'::timestamptz), -- Match 75
    ('R32-4',  '2026-06-29T17:00:00+00:00'::timestamptz), -- Match 76
    ('R32-5',  '2026-06-30T21:00:00+00:00'::timestamptz), -- Match 77
    ('R32-6',  '2026-06-30T17:00:00+00:00'::timestamptz), -- Match 78
    ('R32-7',  '2026-07-01T01:00:00+00:00'::timestamptz), -- Match 79
    ('R32-8',  '2026-07-01T16:00:00+00:00'::timestamptz), -- Match 80
    ('R32-9',  '2026-07-02T00:00:00+00:00'::timestamptz), -- Match 81
    ('R32-10', '2026-07-01T20:00:00+00:00'::timestamptz), -- Match 82
    ('R32-11', '2026-07-02T23:00:00+00:00'::timestamptz), -- Match 83
    ('R32-12', '2026-07-02T19:00:00+00:00'::timestamptz), -- Match 84
    ('R32-13', '2026-07-03T03:00:00+00:00'::timestamptz), -- Match 85
    ('R32-14', '2026-07-03T22:00:00+00:00'::timestamptz), -- Match 86
    ('R32-15', '2026-07-04T01:30:00+00:00'::timestamptz), -- Match 87
    ('R32-16', '2026-07-03T18:00:00+00:00'::timestamptz)  -- Match 88
)
update public.matches as matches
set starts_at = official_round_of_32_times.starts_at
from official_round_of_32_times
where matches.stage = 'Round of 32'
  and matches.bracket_slot = official_round_of_32_times.bracket_slot;
