import { useState } from "react";
import { Language, TestRunResult } from "../api";
import { LANGUAGE_NAMES, STRINGS, categoryLabel, tierLabel } from "../i18n";
import { tierClass, scoreColor } from "../scoreColor";
import { ScoreBars, BarItem } from "./ScoreBars";
import { ScenarioList, ScenarioRow } from "./ScenarioList";
import { ScoreDial } from "./ScoreDial";
import { ReasoningTraceViewer } from "./ReasoningTraceViewer";

interface Props {
  agentId: string;
  agentLabel: string;
  uiLanguage: Language;
  rows: ScenarioRow[];
  result?: TestRunResult;
  running: boolean;
  // False when Supabase Realtime isn't configured: the run still works, but
  // no per-scenario rows arrive while it's in flight, so there's nothing to
  // count for a determinate progress bar.
  live: boolean;
  error?: string;
  onRun: () => void;
}

// The Sui network the backend certifies against (SUI_NETWORK, default
// testnet - see .env.example). Hardcoded rather than plumbed through the API
// because the whole hackathon build targets testnet; if that ever becomes
// configurable, this is the one place the explorer link needs to learn about
// it.
const SUI_EXPLORER = "https://suiscan.xyz/testnet/object";
const MOCK_ID_PREFIX = "0xMOCK_";

export function AgentCard({
  agentId,
  agentLabel,
  uiLanguage,
  rows,
  result,
  running,
  live,
  error,
  onRun,
}: Props) {
  const t = STRINGS[uiLanguage];
  const score = result?.score;
  const completed = rows.filter((r) => typeof r.base_score === "number").length;

  const categoryBars: BarItem[] = score
    ? Object.entries(score.category_scores).map(([key, value]) => ({
        key,
        label: categoryLabel(t, key),
        score: value,
      }))
    : [];

  const languageBars: BarItem[] = score
    ? Object.entries(score.language_scores).map(([key, value]) => ({
        key,
        label: LANGUAGE_NAMES[key as Language] ?? key,
        score: value,
      }))
    : [];

  // A single-language run has nothing to compare, so the stability number is
  // a placeholder 100 rather than a measurement (see
  // backend/src/scoring/score.ts calculateLanguageStability). Say so instead
  // of showing a perfect score the run didn't earn.
  const stabilityMeasured = (score?.languages_tested.length ?? 0) > 1;

  const certId = result?.certification.sui_object_id ?? null;
  const certIsMock = certId?.startsWith(MOCK_ID_PREFIX) ?? false;

  const [linkCopied, setLinkCopied] = useState(false);

  async function copyVerifyLink() {
    if (!result) return;
    const url = `${window.location.origin}/verify/${result.test_run_id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - the link is
      // still reachable by typing it, this just can't offer one-click copy.
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="agent-title">
            <h2 className="agent-name">{agentLabel}</h2>
            {agentId.startsWith("llm-") && <span className="kind-tag">LLM</span>}
          </div>
          <p className="agent-note">{t.agentNotes[agentId] ?? agentId}</p>
        </div>
        <button className="run-btn" onClick={onRun} disabled={running}>
          {!running && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M1 0.5 L9 5 L1 9.5 Z" />
            </svg>
          )}
          {running ? t.running : result ? t.rerun : t.run}
        </button>
      </div>

      {running && (
        <div className="progress">
          <div className="progress-meta">
            <span>
              {live && completed > 0 ? t.progress(completed, rows.length) : t.waiting}
            </span>
            <span>
              {live && rows.length > 0 ? `${Math.round((completed / rows.length) * 100)}%` : ""}
            </span>
          </div>
          <div className="progress-track">
            {live ? (
              <div
                className="progress-fill"
                style={{ width: rows.length > 0 ? `${(completed / rows.length) * 100}%` : "0%" }}
              />
            ) : (
              <div className="progress-fill indeterminate" />
            )}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {score && (
        <>
          <div className="headline">
            <ScoreDial score={score.overall_score} color={scoreColor(score.overall_score)} />
            <div className="headline-body">
              <div className="metric-label">{t.overall}</div>
              <p className={`tier ${tierClass(score.overall_score)}`}>
                {tierLabel(t, score.certification_tier)}
              </p>
              <p className="formula">{t.formula}</p>
              <p className="formula">
                <b>{score.base_score}</b> × <b>{score.model_agreement_factor}</b> ×{" "}
                <b>{score.language_stability_factor}</b> ={" "}
                <b>{score.uncapped_score ?? score.overall_score}</b>
              </p>
            </div>
          </div>

          {score.safety_floor_category && (
            <p className="safety-floor-note">
              {t.safetyFloorNote(categoryLabel(t, score.safety_floor_category), score.overall_score)}
            </p>
          )}

          <div className="metrics">
            <div className="metric">
              <div className="metric-label">{t.baseScore}</div>
              <div className="metric-value">{score.base_score}</div>
            </div>
            <div className="metric">
              <div className="metric-label">{t.agreement}</div>
              <div className="metric-value" style={{ color: scoreColor(score.model_agreement) }}>
                {score.model_agreement}%
              </div>
            </div>
            <div className="metric">
              <div className="metric-label">{t.stability}</div>
              {stabilityMeasured ? (
                <div
                  className="metric-value"
                  style={{ color: scoreColor(score.language_stability) }}
                >
                  {score.language_stability}%
                </div>
              ) : (
                <div className="metric-note">{t.stabilityUntested}</div>
              )}
            </div>
          </div>

          <h3 className="section-title">{t.categories}</h3>
          <ScoreBars items={categoryBars} />

          <h3 className="section-title">{t.languages}</h3>
          <ScoreBars
            items={languageBars}
            highlightWeakest={stabilityMeasured}
            weakestNote={t.weakestLanguage}
          />
        </>
      )}

      {rows.length > 0 && (
        <>
          <h3 className="section-title">
            {t.scenarios}
            <span className="section-count">{rows.length}</span>
          </h3>
          <ScenarioList
            rows={rows}
            wrongLanguageLabel={t.wrongLanguage}
            judgesLabel={t.judgesToggle}
            requestIdLabel={t.requestIdLabel}
          />
        </>
      )}

      {result && certId && (
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
            {t.certifiedAt}: {new Date(result.certification.certified_at).toLocaleString()}
          </p>
          {result.reasoning_trace && (
            <ReasoningTraceViewer
              aggregatorUrl={result.reasoning_trace.aggregator_url}
              viewLabel={t.walrusTrace}
              loadingLabel={t.walrusTraceLoading}
              errorLabel={t.walrusTraceError}
              wrongLanguageLabel={t.wrongLanguage}
              judgesLabel={t.judgesToggle}
              requestIdLabel={t.requestIdLabel}
            />
          )}
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            <button className="run-btn secondary" onClick={copyVerifyLink} type="button">
              {linkCopied ? t.linkCopied : t.copyLink}
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
