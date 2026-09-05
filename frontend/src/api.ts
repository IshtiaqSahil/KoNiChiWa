export type Language = "en" | "zh" | "ja";

export interface ModelJudgment {
  model: string;
  score: number;
  reasoning: string;
  request_id: string;
}

export interface ScenarioRunResult {
  scenario_id: string;
  template_id: string;
  category: string;
  language: Language;
  message: string;
  reply: string;
  replied_in_language: boolean;
  base_score: number;
  model_agreement: number;
  judgments: ModelJudgment[];
}

export interface TrustScore {
  overall_score: number;
  base_score: number;
  category_scores: Record<string, number>;
  language_scores: Record<string, number>;
  model_agreement: number;
  language_stability: number;
  model_agreement_factor: number;
  language_stability_factor: number;
  certification_tier: string;
  languages_tested: Language[];
  // Present only when the safety floor (backend/src/scoring/score.ts)
  // capped the tier below what the blended overall_score would earn.
  uncapped_score?: number;
  safety_floor_category?: string;
}

export interface TestRunResult {
  test_run_id: string;
  agent_id: string;
  scenario_results: ScenarioRunResult[];
  score: TrustScore;
  certification: {
    sui_object_id: string | null;
    certified_at: string;
    language_stability: number;
  };
  reasoning_trace: { blob_id: string; aggregator_url: string } | null;
}

// Local dev: "/api" proxies to the backend (see vite.config.ts). Deployed:
// the frontend is a separate static site, so VITE_API_BASE_URL must point
// at the backend's real origin (e.g. https://verity-wakk.onrender.com).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

// test_run_id is generated here (not by the backend) so the caller can
// subscribe to Supabase Realtime for this id *before* the run starts -
// see App.tsx.
export async function runTestSuite(
  agentId: string,
  testRunId: string,
  // zkLogin-derived address (ZkLoginButton) - who should own the on-chain
  // objects this run creates. Omitted/undefined falls back to the
  // backend's own address (sui/client.ts).
  ownerAddress?: string
): Promise<TestRunResult> {
  const res = await fetch(`${API_BASE_URL}/test-runs/${agentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_run_id: testRunId, owner_address: ownerAddress }),
  });
  if (!res.ok) {
    // The backend answers errors as {"error": "..."} (routes/testRuns.ts);
    // surfacing that beats showing a bare status code on stage.
    const detail = await res
      .json()
      .then((body) => (typeof body?.error === "string" ? body.error : null))
      .catch(() => null);
    throw new Error(detail ?? `Test run failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function generateTestRunId(): string {
  return `run_${crypto.randomUUID()}`;
}
