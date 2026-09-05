import { useEffect, useState } from "react";
import { Language } from "./api";
import { STRINGS, tierLabel } from "./i18n";
import { scoreColor, tierClass } from "./scoreColor";
import { supabase } from "./supabaseClient";
import { loadUiLanguage } from "./uiLanguage";

// Browsable history of every completed certification - the missing piece
// between VerifyPage (one result, if you already have its link) and the
// live dashboard (only ever shows the two hardcoded demo agents' latest
// run). Reads straight from Supabase, same as VerifyPage, for the same
// reason: nothing here needs recomputing, RLS already grants public
// SELECT (backend/supabase/schema.sql).
const AGENT_LABELS: Record<string, string> = {
  "safe-agent": "SafeAgent",
  "yolo-agent": "YOLOAgent",
  "naive-agent": "NaiveAgent",
  "llm-careful-agent": "CarefulLLMAgent",
  "llm-reckless-agent": "RecklessLLMAgent",
};

interface CertRow {
  id: string;
  agent_id: string;
  overall_score: number | null;
  certification_tier: string | null;
  completed_at: string | null;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "ready"; rows: CertRow[] };

export function CertificationsPage() {
  const [uiLanguage] = useState<Language>(loadUiLanguage);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const t = STRINGS[uiLanguage];

  useEffect(() => {
    if (!supabase) {
      setState({ kind: "not-configured" });
      return;
    }

    let cancelled = false;
    supabase
      .from("test_runs")
      .select("id, agent_id, overall_score, certification_tier, completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) setState({ kind: "ready", rows: (data ?? []) as CertRow[] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="wordmark">
            <img src="/logo.png" alt="" className="logo-mark" />
            Verity<span>.</span>
          </h1>
          <p className="tagline">{t.certificationsIntro}</p>
        </div>
      </header>

      <p style={{ marginBottom: "1rem" }}>
        <a href="/">{t.verifyBack}</a>
      </p>

      {state.kind === "loading" && <p>{t.verifyLoading}</p>}
      {state.kind === "not-configured" && <p className="error">{t.verifyNotConfigured}</p>}

      {state.kind === "ready" &&
        (state.rows.length === 0 ? (
          <p>{t.certificationsEmpty}</p>
        ) : (
          <div className="scenarios cert-list">
            {state.rows.map((row) => (
              <a key={row.id} href={`/verify/${row.id}`} className="scenario cert-row">
                <div>
                  <div className="scenario-id">{row.id}</div>
                  <p className="scenario-msg">
                    {AGENT_LABELS[row.agent_id] ?? row.agent_id} —{" "}
                    <span className={`tier ${tierClass(row.overall_score ?? 0)}`} style={{ fontSize: "0.85rem" }}>
                      {tierLabel(t, row.certification_tier ?? "")}
                    </span>
                  </p>
                  <p className="scenario-reply">
                    {row.completed_at ? new Date(row.completed_at).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="scenario-score" style={{ color: scoreColor(row.overall_score ?? 0) }}>
                  {row.overall_score ?? "—"}
                </div>
              </a>
            ))}
          </div>
        ))}
    </main>
  );
}
