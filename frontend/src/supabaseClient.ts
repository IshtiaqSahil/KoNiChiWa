import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Frontend reads with the anon/publishable key (safe to expose in the
// browser - RLS in backend/supabase/schema.sql only grants it SELECT).
// Point VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY at your own project - see
// design/TECH_STACK_EN.md "Corrections" #2. Optional: the dashboard falls
// back to showing only the final HTTP response if this isn't configured.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
