import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Backend writes with the service role key so it bypasses RLS (the read
// policies in backend/supabase/schema.sql are for the frontend's
// anon/publishable key instead). Point SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// at your own project - see design/TECH_STACK_EN.md "Corrections" #2 for why
// Supabase over a separate Postgres+Socket.io setup.
//
// Persistence is additive, not load-bearing: the orchestrator already
// returns the full result over HTTP regardless of whether this succeeds, so
// an unconfigured/unreachable Supabase project degrades to "no live
// progress rows, no history" rather than breaking test runs.
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null =
  url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;

export const isSupabaseConfigured = supabase !== null;
