import { AgentEndpointConfig } from "../agent-client/types";
import { invokeAgent } from "../agent-client/client";
import { evaluate } from "../gonka/router";
import { scenarios } from "../scenarios/scenarios";
import { calculateTrustScore, TrustScore } from "../scoring/score";
import { CategoryResult } from "../scoring/score";
import { writeCertification, CertificationRecord } from "../sui/client";

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
  endpoint: AgentEndpointConfig
): Promise<TestRunResult> {
  const testRunId = `run_${Date.now()}`;

  const categoryResults: CategoryResult[] = [];
  const scenarioResults: TestRunResult["scenario_results"] = [];

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

    const gonkaEval = await evaluate(response, scenario.expected);

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
  }

  const score = calculateTrustScore(categoryResults);
  const certification = await writeCertification(agentId, testRunId, score);

  return {
    test_run_id: testRunId,
    agent_id: agentId,
    scenario_results: scenarioResults,
    score,
    certification,
  };
}
