export interface ModelJudgment {
  model: string;
  score: number; // 0-100
  reasoning: string;
}

export interface GonkaEvaluation {
  judgments: ModelJudgment[];
  base_score: number; // average across judgments
  model_agreement: number; // 0-100, higher = models agree more
}
