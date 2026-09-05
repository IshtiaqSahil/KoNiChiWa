import { useCallback, useEffect, useState } from "react";
import {
  Language,
  ModelJudgment,
  TestRunResult,
  generateTestRunId,
  runTestSuite,
} from "./api";
import { AgentCard } from "./components/AgentCard";
import { ScenarioRow } from "./components/ScenarioList";
import { ZkLoginButton } from "./components/ZkLoginButton";
import { LANGUAGE_NAMES, STRINGS, UI_LANGUAGES } from "./i18n";
import { supabase } from "./supabaseClient";
import { LOCALE_KEY, loadUiLanguage } from "./uiLanguage";
import "./styles.css";

const AGENTS = [
  { id: "safe-agent", label: "SafeAgent" },
  { id: "yolo-agent", label: "YOLOAgent" },
  { id: "naive-agent", label: "NaiveAgent" },
  { id: "llm-careful-agent", label: "CarefulLLMAgent" },
  { id: "llm-reckless-agent", label: "RecklessLLMAgent" },
];

interface SuiteScenario {
  id: string;
  template_id: string;
  category: string;
  language: Language;
  message: string;
}

// Shape of a scenario_results row as it arrives over Supabase Realtime -
// see backend/supabase/schema.sql. Every column added for the multilingual
// track is nullable there (existing projects predate them), so everything
// past scenario_id is optional here too.
interface LiveScenarioRow {
  scenario_id: string;
  category: string;
  language?: Language;
  message?: string;
  reply?: string;
  replied_in_language?: boolean;
  base_score: number;
  judgments?: ModelJudgment[];
}

export default function App() {
  const [uiLanguage, setUiLanguage] = useState<Language>(loadUiLanguage);
  const [suite, setSuite] = useState<SuiteScenario[]>([]);
  const [rows, setRows] = useState<Record<string, ScenarioRow[]>>({});
  const [results, setResults] = useState<Record<string, TestRunResult | undefined>>({});
  // Keyed by agent rather than a single "which agent is running" id: the two
  // cards run independently, and a shared id let a second run flip the first
  // card's button back to enabled while it was still in flight.
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  // zkLogin-derived address (ZkLoginButton) - who owns the on-chain objects
  // a run creates. null (not signed in) falls back to the backend's own
  // address (sui/client.ts).
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  const t = STRINGS[uiLanguage];

  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_KEY, uiLanguage);
    } catch {
      // Non-fatal: the switcher still works for this session.
    }
  }, [uiLanguage]);

  // The suite is fetched rather than duplicated in the frontend so the
  // dashboard always reflects the backend's real SCENARIO_LANGUAGES setting
  // (see backend/src/routes/testRuns.ts GET /suite).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/suite")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body) => {
        if (!cancelled) setSuite(body.scenarios ?? []);
      })
      .catch(() => {
        // Backend not up yet: the cards still render and the run button
        // still works, it just can't pre-list the pending scenarios.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingRows = useCallback(
    (): ScenarioRow[] =>
      suite.map((scenario) => ({
        scenario_id: scenario.id,
        category: scenario.category,
        language: scenario.language,
        message: scenario.message,
      })),
    [suite]
  );

  function patchRow(agentId: string, scenarioId: string, patch: Partial<ScenarioRow>) {
    setRows((prev) => {
      const current = prev[agentId] ?? [];
      const index = current.findIndex((r) => r.scenario_id === scenarioId);
      if (index === -1) return prev;
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return { ...prev, [agentId]: next };
    });
  }

  async function handleRun(agentId: string) {
    setRunning((prev) => ({ ...prev, [agentId]: true }));
    setErrors((prev) => ({ ...prev, [agentId]: undefined }));
    setResults((prev) => ({ ...prev, [agentId]: undefined }));
    setRows((prev) => ({ ...prev, [agentId]: pendingRows() }));

    const testRunId = generateTestRunId();

    // Subscribe before the run starts so no early scenario_results inserts
    // are missed - falls back silently to "no live rows, final result only"
    // if Supabase isn't configured (see supabaseClient.ts).
    const channel = supabase
      ?.channel(`scenario_results:${testRunId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scenario_results",
          filter: `test_run_id=eq.${testRunId}`,
        },
        (payload) => {
          const row = payload.new as LiveScenarioRow;
          patchRow(agentId, row.scenario_id, {
            reply: row.reply,
            replied_in_language: row.replied_in_language,
            base_score: row.base_score,
            judgments: row.judgments,
          });
        }
      )
      .subscribe();

    try {
      const result = await runTestSuite(agentId, testRunId, ownerAddress ?? undefined);
      setResults((prev) => ({ ...prev, [agentId]: result }));
      // Backfill from the HTTP response regardless of what Realtime
      // delivered: it's the authoritative copy, and it's the only source of
      // rows at all when Supabase isn't configured.
      setRows((prev) => ({
        ...prev,
        [agentId]: result.scenario_results.map((scenario) => ({
          scenario_id: scenario.scenario_id,
          category: scenario.category,
          language: scenario.language,
          message: scenario.message,
          reply: scenario.reply,
          replied_in_language: scenario.replied_in_language,
          base_score: scenario.base_score,
          judgments: scenario.judgments,
        })),
      }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [agentId]: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      setRunning((prev) => ({ ...prev, [agentId]: false }));
      if (channel) supabase?.removeChannel(channel);
    }
  }

  const suiteLanguages = Array.from(new Set(suite.map((s) => s.language)));

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            <img src="/logo.png" alt="" className="logo-mark" />
            Verity<span>.</span>
          </h1>
          <p className="tagline">{t.tagline}</p>
        </div>
        <div className="locale-switch" role="group" aria-label={t.localeLabel}>
          {UI_LANGUAGES.map((language) => (
            <button
              key={language}
              aria-pressed={uiLanguage === language}
              onClick={() => setUiLanguage(language)}
            >
              {LANGUAGE_NAMES[language]}
            </button>
          ))}
        </div>
        <ZkLoginButton
          signedInLabel={t.zkLoginSignedIn}
          errorPrefix={t.zkLoginError}
          onAddressChange={setOwnerAddress}
        />
      </header>

      <div className="status-strip">
        <span className="chip">
          <span className={`dot ${supabase ? "on" : "off"}`} />
          {supabase ? t.statusLive : t.statusLiveOff}
        </span>
        <span className="chip">
          <span className="dot on" />
          {t.statusGonka}
        </span>
        <span className="chip">
          <span className="dot on" />
          {suiteLanguages.length > 0
            ? `${t.statusLanguages} (${suiteLanguages.map((l) => LANGUAGE_NAMES[l]).join(" · ")})`
            : t.statusLanguages}
        </span>
        <span className="chip">
          <span className="dot on" />
          {t.statusSui}
        </span>
        <a className="chip" href="/certifications">
          {t.certificationsLink}
        </a>
      </div>

      <div className="agent-grid">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agentId={agent.id}
            agentLabel={agent.label}
            uiLanguage={uiLanguage}
            rows={rows[agent.id] ?? pendingRows()}
            result={results[agent.id]}
            running={Boolean(running[agent.id])}
            live={Boolean(supabase)}
            error={errors[agent.id]}
            onRun={() => handleRun(agent.id)}
          />
        ))}
      </div>

      <p className="footnote">{t.footnote}</p>
    </main>
  );
}
