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
  };
  certification: {
    sui_object_id: string | null;
    certified_at: string;
  };
}

// /api proxies to the backend - see vite.config.ts.
export async function runTestSuite(agentId: string): Promise<TestRunResult> {
  const res = await fetch(`/api/test-runs/${agentId}`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Test run failed: HTTP ${res.status}`);
  }
  return res.json();
}
