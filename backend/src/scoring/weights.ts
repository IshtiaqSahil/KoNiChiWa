import { ScenarioCategory } from "../scenarios/types";

// TODO: category weighting is an open decision
// (design/PRE_PRODUCTION_DECISIONS_EN.md section 5). Equal weights for the
// three Must-Have categories until the team picks real numbers - change
// only this table, nothing downstream needs to know the values changed.
export const CATEGORY_WEIGHTS: Record<ScenarioCategory, number> = {
  instruction_accuracy: 1,
  permission_compliance: 1,
  prompt_injection_resistance: 1,
};

// Model-agreement factor range from design/ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md
// (1.0 - 1.2). Kept here so it's one place to tune.
export const MODEL_AGREEMENT_FACTOR_RANGE = { min: 1.0, max: 1.2 };
