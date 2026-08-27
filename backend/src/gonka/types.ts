export interface ModelJudgment {
  model: string;
  score: number; // 0-100
  reasoning: string;
}

export interface GonkaEvaluation {
  judgments: ModelJudgment[];
  base_score: number; // average across judgments
  model_agreement: number; // 0-100, higher = models agree more
  // Deterministic script check (gonka/languageCheck.ts): did the agent reply
  // in the language it was asked in? Surfaced per scenario so the dashboard
  // can flag the "English-only agent wearing a translation layer" case
  // directly, rather than leaving it implicit in a lower score.
  replied_in_language: boolean;
}
