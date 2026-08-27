import { useState } from "react";
import { runTestSuite, generateTestRunId, TestRunResult } from "./api";
import { supabase } from "./supabaseClient";

const AGENTS = [
  { id: "safe-agent", label: "SafeAgent" },
  { id: "yolo-agent", label: "YOLOAgent" },
];

interface LiveScenarioRow {
  scenario_id: string;
  category: string;
  base_score: number;
}

export default function App() {
  const [results, setResults] = useState<Record<string, TestRunResult | undefined>>({});
  const [liveProgress, setLiveProgress] = useState<Record<string, LiveScenarioRow[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(agentId: string) {
    setLoading(agentId);
    setError(null);
    setLiveProgress((prev) => ({ ...prev, [agentId]: [] }));

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
          setLiveProgress((prev) => ({
            ...prev,
            [agentId]: [...(prev[agentId] ?? []), row],
          }));
        }
      )
      .subscribe();

    try {
      const result = await runTestSuite(agentId, testRunId);
      setResults((prev) => ({ ...prev, [agentId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
      if (channel) supabase?.removeChannel(channel);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>KoNiChiWa - Trust Certification (skeleton)</h1>
      <p>
        Dashboard is minimal on purpose - see design/SCOPE_FLOOR_PROPOSAL_EN.md.
        Per-scenario rows below stream live via Supabase Realtime while a run
        is in progress (config permitting); a WebSocket dashboard rebuild
        (Should-Have) is still not needed on top of this.
      </p>

      {!supabase && (
        <p style={{ color: "#a60", fontSize: "0.9rem" }}>
          Supabase not configured (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) -
          live per-scenario progress is disabled; only the final result will
          show.
        </p>
      )}

      {AGENTS.map((agent) => {
        const result = results[agent.id];
        const live = liveProgress[agent.id] ?? [];
        return (
          <section key={agent.id} style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
            <h2>{agent.label}</h2>
            <button onClick={() => handleRun(agent.id)} disabled={loading === agent.id}>
              {loading === agent.id ? "Running..." : "Run test suite"}
            </button>

            {loading === agent.id && live.length > 0 && (
              <ul style={{ marginTop: "1rem", color: "#666" }}>
                {live.map((row) => (
                  <li key={row.scenario_id}>
                    {row.scenario_id} ({row.category}) → {Math.round(row.base_score)}
                  </li>
                ))}
              </ul>
            )}

            {result && (
              <div style={{ marginTop: "1rem" }}>
                <p>
                  <strong>Overall score:</strong> {result.score.overall_score}/100 (
                  {result.score.certification_tier})
                </p>
                <p>
                  <strong>Model agreement:</strong> {result.score.model_agreement}%
                </p>
                <ul>
                  {Object.entries(result.score.category_scores).map(([category, score]) => (
                    <li key={category}>
                      {category}: {Math.round(score)}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Sui object (mock):</strong> {result.certification.sui_object_id}
                </p>
              </div>
            )}
          </section>
        );
      })}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
