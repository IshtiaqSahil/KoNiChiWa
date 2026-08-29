import {
  AgentEndpointConfig,
  AgentInvokeRequest,
  AgentInvokeResponse,
} from "./types";

// Was 20s; bumped to match the same lesson already learned tuning
// gonka/router.ts's TIMEOUT_MS - real LLM inference calls (as opposed to
// the near-instant regex demo agents) sometimes ran close to 28s this
// session under provider load. A real LLM-backed agent (agents/llm-agent)
// needs headroom to not get killed by this before it can even respond.
const CALL_TIMEOUT_MS = 30_000;

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
