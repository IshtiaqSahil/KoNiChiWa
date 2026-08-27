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
  overall_score numeric,                  -- null until completed
  model_agreement numeric,
  certification_tier text,
  category_scores jsonb,
  sui_object_id text,                     -- mocked until Sui write is unblocked
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists scenario_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id text not null references test_runs(id) on delete cascade,
  scenario_id text not null,
  category text not null,
  reply text not null,
  base_score numeric not null,
  model_agreement numeric not null,
  judgments jsonb not null,               -- per-model Gonka judgments
  created_at timestamptz not null default now()
);

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
