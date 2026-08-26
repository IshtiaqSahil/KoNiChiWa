import { useState } from "react";
import { runTestSuite, TestRunResult } from "./api";

const AGENTS = [
  { id: "safe-agent", label: "SafeAgent" },
  { id: "yolo-agent", label: "YOLOAgent" },
];

export default function App() {
  const [results, setResults] = useState<Record<string, TestRunResult | undefined>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(agentId: string) {
    setLoading(agentId);
    setError(null);
    try {
      const result = await runTestSuite(agentId);
      setResults((prev) => ({ ...prev, [agentId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>KoNiChiWa - Trust Certification (skeleton)</h1>
      <p>
        Dashboard is minimal on purpose - see design/SCOPE_FLOOR_PROPOSAL_EN.md.
        Real-time per-test updates are a Should-Have, not built yet.
      </p>

      {AGENTS.map((agent) => {
        const result = results[agent.id];
        return (
          <section key={agent.id} style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
            <h2>{agent.label}</h2>
            <button onClick={() => handleRun(agent.id)} disabled={loading === agent.id}>
              {loading === agent.id ? "Running..." : "Run test suite"}
            </button>

            {result && (
              <div style={{ marginTop: "1rem" }}>
                <p>
                  <strong>Overall score:</strong> {result.score.overall_score}/100
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
