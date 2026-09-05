import { Router } from "express";
import { AgentEndpointConfig } from "../agent-client/types";
import { activeLanguages, buildScenarios } from "../scenarios/scenarios";
import { runTestSuite } from "../testRun/orchestrator";

const router = Router();

// Hardcoded demo agent registry - fine for the hackathon floor
// (design/SCOPE_FLOOR_PROPOSAL_EN.md Won't-Have explicitly excludes a real
// registration flow). Replace with a DB-backed registry later.
const AGENTS: Record<string, AgentEndpointConfig> = {
  "safe-agent": {
    name: "SafeAgent",
    baseUrl: process.env.SAFE_AGENT_URL ?? "http://localhost:4001",
    apiKey: process.env.SAFE_AGENT_API_KEY ?? "dev-safe-agent-key",
  },
  "yolo-agent": {
    name: "YOLOAgent",
    baseUrl: process.env.YOLO_AGENT_URL ?? "http://localhost:4002",
    apiKey: process.env.YOLO_AGENT_API_KEY ?? "dev-yolo-agent-key",
  },
  "naive-agent": {
    name: "NaiveAgent",
    baseUrl: process.env.NAIVE_AGENT_URL ?? "http://localhost:4003",
    apiKey: process.env.NAIVE_AGENT_API_KEY ?? "dev-naive-agent-key",
  },
  // Real, LLM-backed candidates (agents/llm-agent) - same model, different
  // system prompt. Registered unconditionally like the others; if
  // LLM_AGENT_PROVIDER_URL/API_KEY/MODEL aren't set, the agent server
  // itself returns a clear "not configured" error rather than this
  // registry silently omitting the entry.
  "llm-careful-agent": {
    name: "CarefulLLMAgent",
    baseUrl: process.env.LLM_AGENT_CAREFUL_URL ?? "http://localhost:4004",
    apiKey: process.env.LLM_AGENT_CAREFUL_API_KEY ?? "dev-llm-careful-agent-key",
  },
  "llm-reckless-agent": {
    name: "RecklessLLMAgent",
    baseUrl: process.env.LLM_AGENT_RECKLESS_URL ?? "http://localhost:4005",
    apiKey: process.env.LLM_AGENT_RECKLESS_API_KEY ?? "dev-llm-reckless-agent-key",
  },
};

// The suite the backend will actually run, published so the dashboard can
// render every scenario as a pending row *before* a run starts (and know the
// denominator for its progress bar) instead of discovering the shape of the
// suite from whichever rows happen to arrive first. Also means
// SCENARIO_LANGUAGES is visible to the UI without duplicating that config in
// the frontend.
router.get("/suite", (_req, res) => {
  res.json({
    languages: activeLanguages(),
    scenarios: buildScenarios().map(({ id, template_id, category, language, message }) => ({
      id,
      template_id,
      category,
      language,
      message,
    })),
  });
});

router.post("/test-runs/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const endpoint = AGENTS[agentId];

  if (!endpoint) {
    res.status(404).json({ error: `Unknown agent id "${agentId}"` });
    return;
  }

  const requestedTestRunId =
    typeof req.body?.test_run_id === "string" ? req.body.test_run_id : undefined;
  // Validated again in sui/client.ts before ever being used as an object
  // owner - accepting a loosely-typed string here and letting that be the
  // single source of truth for the format check, rather than duplicating
  // the regex in two places.
  const ownerAddress = typeof req.body?.owner_address === "string" ? req.body.owner_address : undefined;

  try {
    const result = await runTestSuite(agentId, endpoint, requestedTestRunId, ownerAddress);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: message });
  }
});

export default router;
