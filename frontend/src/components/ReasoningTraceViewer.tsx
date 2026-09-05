import { useState } from "react";
import { ScenarioList, ScenarioRow } from "./ScenarioList";

// Walrus's aggregator serves blobs with no Content-Type header and
// `x-content-type-options: nosniff` (deliberate on Walrus's side - a blob
// could contain anything, so it won't let the browser guess a type that
// might render as HTML/JS) - confirmed live 2026-09-05 via `curl -I`. A
// plain <a href> to that URL downloads the file instead of showing it.
// Fetching client-side and rendering with the same ScenarioList component
// the live dashboard already uses sidesteps that entirely, and reuses
// the exact display the data was designed for instead of a raw JSON dump.

interface WalrusScenario {
  scenario_id: string;
  category: string;
  language: "en" | "zh" | "ja";
  message: string;
  reply: string;
  judgments: Array<{ model: string; score: number; reasoning: string; request_id: string }>;
}

interface Props {
  aggregatorUrl: string;
  viewLabel: string;
  loadingLabel: string;
  errorLabel: string;
  wrongLanguageLabel: string;
  judgesLabel: (n: number) => string;
  requestIdLabel: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; rows: ScenarioRow[] };

export function ReasoningTraceViewer({
  aggregatorUrl,
  viewLabel,
  loadingLabel,
  errorLabel,
  wrongLanguageLabel,
  judgesLabel,
  requestIdLabel,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(aggregatorUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const scenarios: WalrusScenario[] = body?.scenarios ?? [];
      // base_score/replied_in_language aren't stored in the Walrus blob
      // (only the raw per-model judgments are - see backend/src/walrus/
      // client.ts's ReasoningTraceScenario) - base_score is recomputed
      // here as the judgment average so rows render as scored rather than
      // pending; replied_in_language is simply omitted.
      const rows: ScenarioRow[] = scenarios.map((s) => ({
        scenario_id: s.scenario_id,
        category: s.category,
        language: s.language,
        message: s.message,
        reply: s.reply,
        base_score:
          s.judgments.length > 0
            ? s.judgments.reduce((sum, j) => sum + j.score, 0) / s.judgments.length
            : undefined,
        judgments: s.judgments,
      }));
      setState({ kind: "loaded", rows });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "idle") {
    return (
      <p style={{ margin: "0.3rem 0 0" }}>
        <button className="run-btn secondary" type="button" onClick={load}>
          {viewLabel}
        </button>
      </p>
    );
  }

  if (state.kind === "loading") {
    return <p className="cert-id" style={{ margin: "0.3rem 0 0" }}>{loadingLabel}</p>;
  }

  if (state.kind === "error") {
    return (
      <p style={{ margin: "0.3rem 0 0" }}>
        <button className="run-btn secondary" type="button" onClick={load}>
          {errorLabel}
        </button>
      </p>
    );
  }

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <ScenarioList
        rows={state.rows}
        wrongLanguageLabel={wrongLanguageLabel}
        judgesLabel={judgesLabel}
        requestIdLabel={requestIdLabel}
      />
    </div>
  );
}
