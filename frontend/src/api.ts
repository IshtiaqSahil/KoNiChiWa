export type Language = "en" | "zh" | "ja";

export interface ModelJudgment {
  model: string;
  score: number;
  reasoning: string;
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
}

// /api proxies to the backend - see vite.config.ts.
// test_run_id is generated here (not by the backend) so the caller can
// subscribe to Supabase Realtime for this id *before* the run starts -
// see App.tsx.
export async function runTestSuite(
  agentId: string,
  testRunId: string
): Promise<TestRunResult> {
  const res = await fetch(`/api/test-runs/${agentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test_run_id: testRunId }),
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
