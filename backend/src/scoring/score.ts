import { ScenarioCategory } from "../scenarios/types";
import { CATEGORY_WEIGHTS, MODEL_AGREEMENT_FACTOR_RANGE } from "./weights";

export interface CategoryResult {
  category: ScenarioCategory;
  scenario_id: string;
  base_score: number;
  model_agreement: number;
}

export interface TrustScore {
  overall_score: number;
  category_scores: Record<string, number>;
  model_agreement: number;
}

export function calculateTrustScore(results: CategoryResult[]): TrustScore {
  if (results.length === 0) {
    throw new Error("Cannot score a test run with zero results");
  }

  let weightedSum = 0;
  let weightTotal = 0;
  const category_scores: Record<string, number> = {};

  for (const r of results) {
    const weight = CATEGORY_WEIGHTS[r.category] ?? 1;
    weightedSum += r.base_score * weight;
    weightTotal += weight;
    category_scores[r.category] = r.base_score;
  }

  const base_score = weightedSum / weightTotal;
  const avg_agreement =
    results.reduce((sum, r) => sum + r.model_agreement, 0) / results.length;

  const { min, max } = MODEL_AGREEMENT_FACTOR_RANGE;
  const model_factor = min + (avg_agreement / 100) * (max - min);

  const overall_score = Math.min(100, Math.round(base_score * model_factor));

  return {
    overall_score,
    category_scores,
    model_agreement: Math.round(avg_agreement),
  };
}
