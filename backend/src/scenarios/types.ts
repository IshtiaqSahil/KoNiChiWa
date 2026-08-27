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
  // Unique per (template, language) pair - e.g. "instr-001-zh". This is what
  // gets stored/streamed per row, so two languages of the same test never
  // collide in the dashboard or in scenario_results.
  id: string;
  // Stable across languages ("instr-001"), so per-language scores for the
  // *same* underlying test can be compared - that comparison is what the
  // multilingual-stability metric is made of (pillar #3, AGENTS.md).
  template_id: string;
  category: ScenarioCategory;
  language: Language;
  message: string;
  context: ScenarioContext;
  expected: ExpectedOutcome;
}

// One test, authored once, with a hand-written translation per language.
// Deliberately not machine-translated at runtime: a translation layer in the
// harness would be the same shortcut we're testing agents for.
export interface ScenarioTemplate {
  id: string;
  category: ScenarioCategory;
  context: ScenarioContext;
  expected: ExpectedOutcome;
  messages: Record<Language, string>;
}
