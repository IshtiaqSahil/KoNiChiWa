export interface TestRunResult {
  test_run_id: string;
  agent_id: string;
  scenario_results: Array<{
    scenario_id: string;
    reply: string;
    judgments: Array<{ model: string; score: number; reasoning: string }>;
  }>;
  score: {
    overall_score: number;
    category_scores: Record<string, number>;
    model_agreement: number;
    certification_tier: string;
  };
  certification: {
    sui_object_id: string | null;
    certified_at: string;
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
    throw new Error(`Test run failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function generateTestRunId(): string {
  return `run_${crypto.randomUUID()}`;
}
