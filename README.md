# Kickoff Pool

A small, mobile-friendly World Cup prediction pool built with Next.js, React, Tailwind CSS, and Supabase.

## Run locally

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

The seeded administrator login is `Admin` / `2468`.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and anon key.
4. Sign in once with the intended admin account.
5. Promote it using the commented `update public.players...` statement at the end of the schema.
6. Replace the sample rows in `public.matches` with the official tournament schedule.

This MVP uses direct Supabase table queries, plain-text PINs, session rows, client-side kickoff checks, and the shared scoring helper for leaderboard totals.

## Scoring

- 3 points: correct winner or draw
- 2 bonus points: exact score
- 1 bonus point: correct goal difference
- 1 point: correct Team A goals
- 1 point: correct Team B goals
