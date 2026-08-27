import { AgentEndpointConfig, Language } from "../agent-client/types";
import { invokeAgent } from "../agent-client/client";
import { evaluate } from "../gonka/router";
import { buildScenarios } from "../scenarios/scenarios";
import { calculateTrustScore, TrustScore } from "../scoring/score";
import { CategoryResult } from "../scoring/score";
import { writeCertification, CertificationRecord } from "../sui/client";
import { startTestRun, recordScenarioResult, completeTestRun, failTestRun } from "../db/persistence";

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
  judgments: Awaited<ReturnType<typeof evaluate>>["judgments"];
}

export interface TestRunResult {
  test_run_id: string;
  agent_id: string;
  scenario_results: ScenarioRunResult[];
  score: TrustScore;
  certification: CertificationRecord;
}

// Running the same suite in three languages tripled the scenario count, and
// each scenario costs one agent call plus three Gonka judgments (up to 28s
// each - see gonka/router.ts). Sequentially that's a multi-minute run, which
// is too slow to demo live. Bounded concurrency instead of a flat
// Promise.all: GonkaRouter was already timing out under hackathon load, and
// firing every judgment at once would make that worse, not better.
const DEFAULT_CONCURRENCY = 3;

function scenarioConcurrency(): number {
  const raw = Number(process.env.SCENARIO_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_CONCURRENCY;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  const scenarios = buildScenarios();
  await startTestRun(testRunId, agentId, scenarios.length);

  let scenarioResults: ScenarioRunResult[];

  try {
    scenarioResults = await mapWithConcurrency(scenarios, scenarioConcurrency(), async (scenario) => {
      const response = await invokeAgent(endpoint, {
        scenario_id: scenario.id,
        language: scenario.language,
        message: scenario.message,
        context: scenario.context,
      });

      const gonkaEval = await evaluate(scenario, response);

      // Fire-and-forget: this is what makes progress visible on the
      // dashboard scenario-by-scenario instead of only once the whole run
      // (and the final HTTP response) completes. See schema.sql / the
      // Supabase Realtime note in TECH_STACK_EN.md - this is the off-chain
      // analogue of the on-chain "per-test write" idea, not a replacement
      // for it.
      void recordScenarioResult(testRunId, scenario, response.reply, gonkaEval);

      return {
        scenario_id: scenario.id,
        template_id: scenario.template_id,
        category: scenario.category,
        language: scenario.language,
        message: scenario.message,
        reply: response.reply,
        replied_in_language: gonkaEval.replied_in_language,
        base_score: gonkaEval.base_score,
        model_agreement: gonkaEval.model_agreement,
        judgments: gonkaEval.judgments,
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await failTestRun(testRunId, message);
    throw err;
  }

  const categoryResults: CategoryResult[] = scenarios.map((scenario, i) => ({
    category: scenario.category,
    scenario_id: scenario.id,
    template_id: scenario.template_id,
    language: scenario.language,
    base_score: scenarioResults[i].base_score,
    model_agreement: scenarioResults[i].model_agreement,
  }));

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
