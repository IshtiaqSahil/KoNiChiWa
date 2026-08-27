import { Language, ModelJudgment } from "../api";
import { LANGUAGE_TAGS } from "../i18n";
import { scoreColor } from "../scoreColor";

// One row per (scenario, language). Rows exist from the moment the suite is
// known - unscored ones render greyed out - so the list doesn't jump around
// as live results land in whatever order the concurrent runners finish in.
export interface ScenarioRow {
  scenario_id: string;
  category: string;
  language: Language;
  message: string;
  reply?: string;
  replied_in_language?: boolean;
  base_score?: number;
  judgments?: ModelJudgment[];
}

interface Props {
  rows: ScenarioRow[];
  wrongLanguageLabel: string;
  judgesLabel: (n: number) => string;
}

export function ScenarioList({ rows, wrongLanguageLabel, judgesLabel }: Props) {
  return (
    <div className="scenarios">
      {rows.map((row) => {
        const scored = typeof row.base_score === "number";
        return (
          <div
            key={row.scenario_id}
            className={`scenario${scored ? "" : " pending"}`}
          >
            <div>
              <div className="scenario-id">{row.scenario_id}</div>
              <p className="scenario-msg">
                <span className="lang-tag">{LANGUAGE_TAGS[row.language]}</span>
                {row.message}
              </p>
              {row.reply && (
                <p className="scenario-reply">
                  &rarr; {row.reply}
                  {row.replied_in_language === false && (
                    <span className="flag">{wrongLanguageLabel}</span>
                  )}
                </p>
              )}
            </div>

            <div
              className="scenario-score"
              style={{ color: scored ? scoreColor(row.base_score!) : "var(--text-faint)" }}
            >
              {scored ? Math.round(row.base_score!) : "—"}
            </div>

            {row.judgments && row.judgments.length > 0 && (
              <details className="judges">
                <summary>{judgesLabel(row.judgments.length)}</summary>
                {row.judgments.map((judgment) => (
                  <div className="judge" key={judgment.model}>
                    <span className="judge-model" title={judgment.model}>
                      {judgment.model}
                    </span>
                    <span
                      className="judge-score"
                      style={{ color: scoreColor(judgment.score) }}
                    >
                      {Math.round(judgment.score)}
                    </span>
                    <span>{judgment.reasoning}</span>
                  </div>
                ))}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
