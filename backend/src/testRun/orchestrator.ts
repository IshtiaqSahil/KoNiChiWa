import { AgentEndpointConfig } from "../agent-client/types";
import { invokeAgent } from "../agent-client/client";
import { evaluate } from "../gonka/router";
import { scenarios } from "../scenarios/scenarios";
import { calculateTrustScore, TrustScore } from "../scoring/score";
import { CategoryResult } from "../scoring/score";
import { writeCertification, CertificationRecord } from "../sui/client";
import { startTestRun, recordScenarioResult, completeTestRun, failTestRun } from "../db/persistence";

export interface TestRunResult {
  test_run_id: string;
  agent_id: string;
  scenario_results: Array<{
    scenario_id: string;
    reply: string;
    judgments: Awaited<ReturnType<typeof evaluate>>["judgments"];
  }>;
  score: TrustScore;
  certification: CertificationRecord;
}

export async function runTestSuite(
  agentId: string,
  endpoint: AgentEndpointConfig,
  requestedTestRunId?: string
): Promise<TestRunResult> {
  // Accepts a caller-supplied id so the frontend can subscribe to Supabase
  // Realtime for this run *before* kicking it off (see frontend/src/App.tsx)
  // instead of racing to discover the id after the fact.
  const testRunId = requestedTestRunId ?? `run_${Date.now()}`;
  await startTestRun(testRunId, agentId);

  const categoryResults: CategoryResult[] = [];
  const scenarioResults: TestRunResult["scenario_results"] = [];

  try {
    // Sequential for now (readability during skeleton stage); switch to
    // Promise.all once the real Gonka/Sui calls are wired in and we want the
    // "each test completes -> Sui write" streaming behaviour from the
    // proposal doc.
    for (const scenario of scenarios) {
      const response = await invokeAgent(endpoint, {
        scenario_id: scenario.id,
        language: scenario.language,
        message: scenario.message,
        context: scenario.context,
      });

      const gonkaEval = await evaluate(scenario, response);

      categoryResults.push({
        category: scenario.category,
        scenario_id: scenario.id,
        base_score: gonkaEval.base_score,
        model_agreement: gonkaEval.model_agreement,
      });

      scenarioResults.push({
        scenario_id: scenario.id,
        reply: response.reply,
        judgments: gonkaEval.judgments,
      });

      // Fire-and-forget: this is what makes progress visible on the
      // dashboard scenario-by-scenario instead of only once the whole run
      // (and the final HTTP response) completes. See schema.sql / the
      // Supabase Realtime note in TECH_STACK_EN.md - this is the off-chain
      // analogue of the on-chain "per-test write" idea, not a replacement
      // for it.
      void recordScenarioResult(
        testRunId,
        scenario.id,
        scenario.category,
        response.reply,
        gonkaEval
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await failTestRun(testRunId, message);
    throw err;
  }

  const score = calculateTrustScore(categoryResults);
  const certification = await writeCertification(agentId, testRunId, score);
  await completeTestRun(testRunId, score, certification);

  return {
    test_run_id: testRunId,
    agent_id: agentId,
    scenario_results: scenarioResults,
    score,
    certification,
  };
}
