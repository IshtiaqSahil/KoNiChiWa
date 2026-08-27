import { Router } from "express";
import { AgentEndpointConfig } from "../agent-client/types";
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
};

router.post("/test-runs/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const endpoint = AGENTS[agentId];

  if (!endpoint) {
    res.status(404).json({ error: `Unknown agent id "${agentId}"` });
    return;
  }

  const requestedTestRunId =
    typeof req.body?.test_run_id === "string" ? req.body.test_run_id : undefined;

  try {
    const result = await runTestSuite(agentId, endpoint, requestedTestRunId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: message });
  }
});

export default router;
