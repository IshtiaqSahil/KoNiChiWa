-- KoNiChiWa off-chain persistence schema.
--
-- Covers the decided part of the Sui pillar's "visible live, not just at
-- the end" narrative (design/ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md) using
-- Supabase Realtime instead of a hand-rolled WebSocket layer (see
-- design/TECH_STACK_EN.md, "Corrections" #2). Does NOT touch anything still
-- open: no on-chain object model here (that's Sui's job, blocked on
-- ownership + gas-payer decisions), no category-weight or agreement-formula
-- assumptions baked into the schema.
--
-- Run this once against your own Supabase project's SQL editor (or via
-- `supabase db push` / mcp__supabase__apply_migration) -- NOT against a
-- shared/unrelated project. Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists test_runs (
  id text primary key,                    -- matches orchestrator's test_run_id
  agent_id text not null,
  status text not null default 'running', -- 'running' | 'completed' | 'failed'
  scenario_count integer,                 -- known at run start; drives the progress bar
  overall_score numeric,                  -- null until completed
  base_score numeric,                     -- pre-factor weighted average
  model_agreement numeric,
  language_stability numeric,             -- multilingual stability, 0-100 (pillar #3)
  model_agreement_factor numeric,         -- multiplier applied to base_score (score.ts)
  language_stability_factor numeric,      -- multiplier applied to base_score (score.ts)
  certification_tier text,
  category_scores jsonb,
  language_scores jsonb,                  -- per-language average base score
  sui_object_id text,                     -- mocked until Sui write is unblocked
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists scenario_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id text not null references test_runs(id) on delete cascade,
  scenario_id text not null,              -- unique per language, e.g. "instr-001-zh"
  template_id text,                       -- shared across languages, e.g. "instr-001"
  category text not null,
  language text,                          -- 'en' | 'zh' | 'ja'
  message text,                           -- the prompt as the agent received it
  reply text not null,
  replied_in_language boolean,            -- did the agent answer in the asked language?
  base_score numeric not null,
  model_agreement numeric not null,
  judgments jsonb not null,               -- per-model Gonka judgments
  sui_object_id text,                     -- per-scenario TestResult object (mocked if Sui unconfigured)
  created_at timestamptz not null default now()
);

-- Additive migration for projects created before the multilingual columns
-- existed (the team's Supabase project was set up 2026-08-27). New columns
-- are nullable rather than `not null default` so re-running this against a
-- populated project can't fail on existing rows. Safe to re-run.
alter table test_runs add column if not exists scenario_count integer;
alter table test_runs add column if not exists base_score numeric;
alter table test_runs add column if not exists language_stability numeric;
alter table test_runs add column if not exists language_scores jsonb;
alter table test_runs add column if not exists model_agreement_factor numeric;
alter table test_runs add column if not exists language_stability_factor numeric;

alter table scenario_results add column if not exists template_id text;
alter table scenario_results add column if not exists language text;
alter table scenario_results add column if not exists message text;
alter table scenario_results add column if not exists replied_in_language boolean;
alter table scenario_results add column if not exists sui_object_id text;

create index if not exists scenario_results_test_run_id_idx
  on scenario_results (test_run_id);

-- RLS: Supabase projects have RLS on by default. Backend writes with the
-- service role key (bypasses RLS). Frontend reads/subscribes with the
-- anon/publishable key, so it needs an explicit read policy.
alter table test_runs enable row level security;
alter table scenario_results enable row level security;

drop policy if exists "public read test_runs" on test_runs;
create policy "public read test_runs" on test_runs
  for select using (true);

drop policy if exists "public read scenario_results" on scenario_results;
create policy "public read scenario_results" on scenario_results
  for select using (true);

-- Required for Realtime: table must be in the publication. Guarded so the
-- script is safe to re-run (bare ALTER PUBLICATION ... ADD TABLE errors on
-- a table that's already a member).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'test_runs'
  ) then
    alter publication supabase_realtime add table test_runs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'scenario_results'
  ) then
    alter publication supabase_realtime add table scenario_results;
  end if;
end $$;
