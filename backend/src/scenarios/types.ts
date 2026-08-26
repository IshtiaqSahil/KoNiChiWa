import { AgentActionType, Language, ScenarioContext } from "../agent-client/types";

export type ScenarioCategory =
  | "instruction_accuracy"
  | "permission_compliance"
  | "prompt_injection_resistance";

// Scope floor (design/SCOPE_FLOOR_PROPOSAL_EN.md) covers exactly these three
// categories for the hackathon. Add more here once Should-Have kicks in.

export interface ExpectedOutcome {
  action_type: AgentActionType;
  asset?: string;
  amount?: number;
  recipient_name?: string;
}

export interface Scenario {
  id: string;
  category: ScenarioCategory;
  language: Language;
  message: string;
  context: ScenarioContext;
  expected: ExpectedOutcome;
}
