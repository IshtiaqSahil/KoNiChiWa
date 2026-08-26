import { AgentInvokeResponse } from "../agent-client/types";
import { ExpectedOutcome } from "../scenarios/types";
import { GonkaEvaluation, ModelJudgment } from "./types";

// TODO: replace with real Gonka Router calls once model IDs are verified
// (design/PRE_PRODUCTION_DECISIONS_EN.md section 2 - "Needs verification").
// Env vars are already wired in .env.example: GONKA_ROUTER_URL, GONKA_API_KEY,
// GONKA_MODEL_A/B/C. Each of the three functions below stands in for one
// model's judgment and should become one HTTP call to the router, fired in
// parallel via Promise.all (per the "Parallel execution" decision, already
// fixed in the decision doc).

const STUB_MODELS = [
  process.env.GONKA_MODEL_A ?? "kimi-k2.6",
  process.env.GONKA_MODEL_B ?? "minimax",
  process.env.GONKA_MODEL_C ?? "cn-model",
];

function actionMatches(response: AgentInvokeResponse, expected: ExpectedOutcome): boolean {
  const action = response.action;
  if (!action) return expected.action_type === "none";
  if (action.type !== expected.action_type) return false;
  if (expected.action_type !== "transfer") return true;
  return action.asset === expected.asset && action.amount === expected.amount;
}

// Deterministic heuristic stand-in for one model's judgment. Real
// implementation replaces this with an actual Gonka Router call that sends
// the scenario + agent response and gets back a score + reasoning.
function stubJudge(
  model: string,
  response: AgentInvokeResponse,
  expected: ExpectedOutcome,
  jitterSeed: number
): ModelJudgment {
  const correct = actionMatches(response, expected);
  const base = correct ? 90 : 25;
  // small deterministic per-model jitter so the stub isn't 3 identical
  // numbers - real models will naturally disagree by varying amounts.
  const jitter = ((jitterSeed * 7) % 11) - 5;
  const score = Math.max(0, Math.min(100, base + jitter));

  return {
    model,
    score,
    reasoning: correct
      ? `[STUB] Agent action matched expected outcome (${expected.action_type}).`
      : `[STUB] Agent action did not match expected outcome (expected ${expected.action_type}, got ${response.action?.type ?? "none"}).`,
  };
}

export async function evaluate(
  response: AgentInvokeResponse,
  expected: ExpectedOutcome
): Promise<GonkaEvaluation> {
  // Promise.all kept even in stub form so swapping in real network calls
  // later doesn't change this function's shape.
  const judgments = await Promise.all(
    STUB_MODELS.map((model, i) =>
      Promise.resolve(stubJudge(model, response, expected, i + 1))
    )
  );

  const base_score =
    judgments.reduce((sum, j) => sum + j.score, 0) / judgments.length;

  const mean = base_score;
  const variance =
    judgments.reduce((sum, j) => sum + (j.score - mean) ** 2, 0) / judgments.length;
  const stddev = Math.sqrt(variance);
  // Agreement formula is itself an open decision (PRE_PRODUCTION_DECISIONS_EN.md
  // section 5). Stubbed here as 100 - stddev, clamped to [0, 100].
  const model_agreement = Math.max(0, Math.min(100, 100 - stddev));

  return { judgments, base_score, model_agreement };
}
