import { supabase } from "./supabaseClient";
import { TrustScore } from "../scoring/score";
import { GonkaEvaluation } from "../gonka/types";
import { CertificationRecord } from "../sui/client";

// Every function here is a best-effort side channel: it feeds the live
// dashboard (Supabase Realtime, per design/TECH_STACK_EN.md "Corrections"
// #2) alongside the HTTP response the orchestrator already returns, and
// never blocks or fails a test run if Supabase isn't configured/reachable.

export async function startTestRun(testRunId: string, agentId: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("test_runs")
    .insert({ id: testRunId, agent_id: agentId, status: "running" });

  if (error) console.error("[supabase] startTestRun failed:", error.message);
}

export async function recordScenarioResult(
  testRunId: string,
  scenarioId: string,
  category: string,
  reply: string,
  evaluation: GonkaEvaluation
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("scenario_results").insert({
    test_run_id: testRunId,
    scenario_id: scenarioId,
    category,
    reply,
    base_score: evaluation.base_score,
    model_agreement: evaluation.model_agreement,
    judgments: evaluation.judgments,
  });

  if (error) console.error("[supabase] recordScenarioResult failed:", error.message);
}

export async function completeTestRun(
  testRunId: string,
  score: TrustScore,
  certification: CertificationRecord
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from("test_runs")
    .update({
      status: "completed",
      overall_score: score.overall_score,
      model_agreement: score.model_agreement,
      certification_tier: score.certification_tier,
      category_scores: score.category_scores,
      sui_object_id: certification.sui_object_id,
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
