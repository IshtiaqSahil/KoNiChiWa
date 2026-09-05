import { supabase } from "./supabaseClient";
import { TrustScore } from "../scoring/score";
import { GonkaEvaluation } from "../gonka/types";
import { Scenario } from "../scenarios/types";
import { CertificationRecord } from "../sui/client";
import { ReasoningTraceUpload } from "../walrus/client";

// Every function here is a best-effort side channel: it feeds the live
// dashboard (Supabase Realtime, per design/TECH_STACK_EN.md "Corrections"
// #2) alongside the HTTP response the orchestrator already returns, and
// never blocks or fails a test run if Supabase isn't configured/reachable.

export async function startTestRun(
  testRunId: string,
  agentId: string,
  // Scenario count is written up front so the dashboard can render a real
  // progress bar ("4 of 9") the moment the run starts, instead of only
  // learning the denominator once every row has arrived.
  scenarioCount: number
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("test_runs")
    .insert({ id: testRunId, agent_id: agentId, status: "running", scenario_count: scenarioCount });

  if (error) console.error("[supabase] startTestRun failed:", error.message);
}

export async function recordScenarioResult(
  testRunId: string,
  scenario: Scenario,
  reply: string,
  evaluation: GonkaEvaluation,
  suiObjectId: string
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("scenario_results").insert({
    test_run_id: testRunId,
    scenario_id: scenario.id,
    template_id: scenario.template_id,
    category: scenario.category,
    language: scenario.language,
    message: scenario.message,
    reply,
    replied_in_language: evaluation.replied_in_language,
    base_score: evaluation.base_score,
    model_agreement: evaluation.model_agreement,
    judgments: evaluation.judgments,
    sui_object_id: suiObjectId,
  });

  if (error) console.error("[supabase] recordScenarioResult failed:", error.message);
}

export async function completeTestRun(
  testRunId: string,
  score: TrustScore,
  certification: CertificationRecord,
  reasoningTrace: ReasoningTraceUpload | null
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("test_runs")
    .update({
      status: "completed",
      overall_score: score.overall_score,
      base_score: score.base_score,
      model_agreement: score.model_agreement,
      language_stability: score.language_stability,
      model_agreement_factor: score.model_agreement_factor,
      language_stability_factor: score.language_stability_factor,
      certification_tier: score.certification_tier,
      category_scores: score.category_scores,
      language_scores: score.language_scores,
      sui_object_id: certification.sui_object_id,
      walrus_blob_id: reasoningTrace?.blob_id ?? null,
      walrus_url: reasoningTrace?.aggregator_url ?? null,
      uncapped_score: score.uncapped_score ?? null,
      safety_floor_category: score.safety_floor_category ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", testRunId);

  if (error) console.error("[supabase] completeTestRun failed:", error.message);
}

export async function failTestRun(testRunId: string, message: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("test_runs")
    .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
    .eq("id", testRunId);

  if (error) console.error("[supabase] failTestRun failed:", error.message);
}
