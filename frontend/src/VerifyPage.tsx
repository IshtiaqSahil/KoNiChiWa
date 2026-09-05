import { useEffect, useState } from "react";
import { Language, ModelJudgment } from "./api";
import { LANGUAGE_NAMES, STRINGS, categoryLabel, tierLabel } from "./i18n";
import { scoreColor, tierClass } from "./scoreColor";
import { supabase } from "./supabaseClient";
import { loadUiLanguage } from "./uiLanguage";
import { ScoreDial } from "./components/ScoreDial";
import { ScoreBars, BarItem } from "./components/ScoreBars";
import { ScenarioList, ScenarioRow } from "./components/ScenarioList";
import { ReasoningTraceViewer } from "./components/ReasoningTraceViewer";

// Standalone, shareable read-only view of one completed test run - the
// "public verification page" from the original pitch doc
// (ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md). Anyone with the link can check
// a certification independently of running one themselves, reading
// straight from Supabase (RLS already grants the anon key public SELECT -
// see backend/supabase/schema.sql) rather than through the backend, since
// there's nothing here that needs to be re-computed.
const SUI_EXPLORER = "https://suiscan.xyz/testnet/object";
const MOCK_ID_PREFIX = "0xMOCK_";

const AGENT_LABELS: Record<string, string> = {
  "safe-agent": "SafeAgent",
  "yolo-agent": "YOLOAgent",
  "naive-agent": "NaiveAgent",
  "llm-careful-agent": "CarefulLLMAgent",
  "llm-reckless-agent": "RecklessLLMAgent",
};

interface TestRunRow {
  id: string;
  agent_id: string;
  status: string;
  overall_score: number | null;
  base_score: number | null;
  model_agreement: number | null;
  language_stability: number | null;
  model_agreement_factor: number | null;
  language_stability_factor: number | null;
  certification_tier: string | null;
  category_scores: Record<string, number> | null;
  language_scores: Record<string, number> | null;
  sui_object_id: string | null;
  walrus_blob_id: string | null;
  walrus_url: string | null;
  uncapped_score: number | null;
  safety_floor_category: string | null;
  error: string | null;
  completed_at: string | null;
}

interface ScenarioResultRow {
  scenario_id: string;
  category: string;
  language: Language;
  message: string;
  reply: string;
  replied_in_language: boolean | null;
  base_score: number;
  judgments: ModelJudgment[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "not-found" }
  | { kind: "running" }
  | { kind: "failed"; reason: string }
  | { kind: "ready"; run: TestRunRow; scenarios: ScenarioResultRow[] };

export function VerifyPage({ testRunId }: { testRunId: string }) {
  const [uiLanguage] = useState<Language>(loadUiLanguage);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  const t = STRINGS[uiLanguage];

  useEffect(() => {
    if (!supabase) {
      setState({ kind: "not-configured" });
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: run, error: runError } = await supabase
        .from("test_runs")
        .select("*")
        .eq("id", testRunId)
        .maybeSingle();

      if (cancelled) return;

      if (runError || !run) {
        setState({ kind: "not-found" });
        return;
      }
      if (run.status === "running") {
        setState({ kind: "running" });
        return;
      }
      if (run.status === "failed") {
        setState({ kind: "failed", reason: run.error ?? "unknown error" });
        return;
      }

      const { data: scenarios } = await supabase
        .from("scenario_results")
        .select("*")
        .eq("test_run_id", testRunId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setState({ kind: "ready", run: run as TestRunRow, scenarios: (scenarios ?? []) as ScenarioResultRow[] });
    })();

    return () => {
      cancelled = true;
    };
  }, [testRunId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - the URL is
      // already visible in the address bar, so this is non-fatal.
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            KoNiChiWa<span>.</span>
          </h1>
          <p className="tagline">{t.verifyIntro}</p>
        </div>
      </header>

      <p style={{ marginBottom: "1rem" }}>
        <a href="/">{t.verifyBack}</a>
      </p>

      {state.kind === "loading" && <p>{t.verifyLoading}</p>}
      {state.kind === "not-configured" && <p className="error">{t.verifyNotConfigured}</p>}
      {state.kind === "not-found" && <p className="error">{t.verifyNotFound}</p>}
      {state.kind === "running" && <p>{t.verifyRunning}</p>}
      {state.kind === "failed" && <p className="error">{t.verifyFailed(state.reason)}</p>}

      {state.kind === "ready" && (
        <VerifiedResult
          run={state.run}
          scenarios={state.scenarios}
          uiLanguage={uiLanguage}
          onCopyLink={copyLink}
          copied={copied}
        />
      )}
    </main>
  );
}

function VerifiedResult({
  run,
  scenarios,
  uiLanguage,
  onCopyLink,
  copied,
}: {
  run: TestRunRow;
  scenarios: ScenarioResultRow[];
  uiLanguage: Language;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const t = STRINGS[uiLanguage];
  const overallScore = run.overall_score ?? 0;

  const categoryBars: BarItem[] = Object.entries(run.category_scores ?? {}).map(([key, value]) => ({
    key,
    label: categoryLabel(t, key),
    score: value,
  }));

  const languageBars: BarItem[] = Object.entries(run.language_scores ?? {}).map(([key, value]) => ({
    key,
    label: LANGUAGE_NAMES[key as Language] ?? key,
    score: value,
  }));

  const stabilityMeasured = Object.keys(run.language_scores ?? {}).length > 1;

  const rows: ScenarioRow[] = scenarios.map((s) => ({
    scenario_id: s.scenario_id,
    category: s.category,
    language: s.language,
    message: s.message,
    reply: s.reply,
    replied_in_language: s.replied_in_language ?? undefined,
    base_score: s.base_score,
    judgments: s.judgments,
  }));

  const certId = run.sui_object_id;
  const certIsMock = certId?.startsWith(MOCK_ID_PREFIX) ?? false;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="agent-name">{AGENT_LABELS[run.agent_id] ?? run.agent_id}</h2>
          <p className="agent-note">{run.id}</p>
        </div>
        <button className="run-btn" onClick={onCopyLink}>
          {copied ? t.linkCopied : t.copyLink}
        </button>
      </div>

      <div className="headline">
        <ScoreDial score={overallScore} color={scoreColor(overallScore)} />
        <div className="headline-body">
          <div className="metric-label">{t.overall}</div>
          <p className={`tier ${tierClass(overallScore)}`}>{tierLabel(t, run.certification_tier ?? "")}</p>
          <p className="formula">{t.formula}</p>
          <p className="formula">
            {/* model_agreement_factor/language_stability_factor were added
                to the schema after some certifications were already
                written - older rows have them as null. Show "—" instead of
                a blank gap ("11 ×  × = 13") for those. */}
            <b>{run.base_score ?? "—"}</b> × <b>{run.model_agreement_factor ?? "—"}</b> ×{" "}
            <b>{run.language_stability_factor ?? "—"}</b> = <b>{run.uncapped_score ?? overallScore}</b>
          </p>
        </div>
      </div>

      {run.safety_floor_category && (
        <p className="safety-floor-note">
          {t.safetyFloorNote(categoryLabel(t, run.safety_floor_category), overallScore)}
        </p>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">{t.baseScore}</div>
          <div className="metric-value">{run.base_score}</div>
        </div>
        <div className="metric">
          <div className="metric-label">{t.agreement}</div>
          <div className="metric-value" style={{ color: scoreColor(run.model_agreement ?? 0) }}>
            {run.model_agreement}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">{t.stability}</div>
          {stabilityMeasured ? (
            <div className="metric-value" style={{ color: scoreColor(run.language_stability ?? 0) }}>
              {run.language_stability}%
            </div>
          ) : (
            <div className="metric-note">{t.stabilityUntested}</div>
          )}
        </div>
      </div>

      <h3 className="section-title">{t.categories}</h3>
      <ScoreBars items={categoryBars} />

      <h3 className="section-title">{t.languages}</h3>
      <ScoreBars items={languageBars} highlightWeakest={stabilityMeasured} weakestNote={t.weakestLanguage} />

      {rows.length > 0 && (
        <>
          <h3 className="section-title">{t.scenarios}</h3>
          <ScenarioList
            rows={rows}
            wrongLanguageLabel={t.wrongLanguage}
            judgesLabel={t.judgesToggle}
            requestIdLabel={t.requestIdLabel}
          />
        </>
      )}

      {certId && (
        <div className="cert">
          <h3 className="section-title" style={{ marginTop: 0 }}>
            {t.certificate}
          </h3>
          {certIsMock ? (
            <p className="cert-mock">{t.certMock}</p>
          ) : (
            <p style={{ margin: 0 }}>
              <a href={`${SUI_EXPLORER}/${certId}`} target="_blank" rel="noreferrer">
                {t.explorer}
              </a>{" "}
              — {t.certOnChain}
            </p>
          )}
          <p className="cert-id" style={{ marginBottom: 0 }}>
            {certId}
          </p>
          <p className="cert-id" style={{ margin: 0 }}>
            {t.certifiedAt}: {run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"}
          </p>
          {run.walrus_url && (
            <ReasoningTraceViewer
              aggregatorUrl={run.walrus_url}
              viewLabel={t.walrusTrace}
              loadingLabel={t.walrusTraceLoading}
              errorLabel={t.walrusTraceError}
              wrongLanguageLabel={t.wrongLanguage}
              judgesLabel={t.judgesToggle}
              requestIdLabel={t.requestIdLabel}
            />
          )}
        </div>
      )}
    </section>
  );
}
