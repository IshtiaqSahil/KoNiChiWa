import {
  AgentEndpointConfig,
  AgentInvokeRequest,
  AgentInvokeResponse,
} from "./types";

// Was 20s, then 30s (real LLM inference calls sometimes ran close to 28s
// under provider load). Bumped again 2026-09-05: agents/llm-agent switched
// its provider from OmniRoute (fails fast with a 429/502) to GonkaRouter
// (confirmed live - fails slowly, via a ~25s timeout, not a fast error).
// llm-agent's own retry-once-on-failure logic (throttle + CALL_TIMEOUT_MS,
// twice in the worst case) can now genuinely take up to ~66s
// (8s throttle + 25s call) x2 - the old 30s budget here killed the whole
// request before llm-agent's own retry even got a chance to succeed.
const CALL_TIMEOUT_MS = 75_000;

export class AgentTimeoutError extends Error {
  constructor(agentName: string) {
    super(`Agent "${agentName}" did not respond within ${CALL_TIMEOUT_MS}ms`);
    this.name = "AgentTimeoutError";
  }
}

// POST {baseUrl}/v1/agent/invoke - see
// design/AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md for the full contract.
export async function invokeAgent(
  endpoint: AgentEndpointConfig,
  request: AgentInvokeRequest
): Promise<AgentInvokeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  try {
    const res = await fetch(`${endpoint.baseUrl}/v1/agent/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": endpoint.apiKey,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Agent "${endpoint.name}" returned HTTP ${res.status}`);
    }

    return (await res.json()) as AgentInvokeResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AgentTimeoutError(endpoint.name);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
