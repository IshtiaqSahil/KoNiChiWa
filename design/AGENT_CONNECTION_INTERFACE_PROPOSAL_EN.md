# Agent Connection Interface Proposal

Draft for team discussion. This is the highest-priority open item from
`PRE_PRODUCTION_DECISIONS_EN.md` — the test engine can't be built until
this is settled. Scoped to what `SCOPE_FLOOR_PROPOSAL_EN.md` actually
needs: two hardcoded demo agents, no dynamic registration flow.

---

## Recommendation: plain REST/JSON, synchronous call per scenario, shared-secret auth

### Request contract (Test Engine → Candidate Agent)

```
POST /v1/agent/invoke
Headers:
  X-Api-Key: <shared secret>
  Content-Type: application/json

Body:
{
  "scenario_id": "perm-002",
  "language": "en",              // "en" | "zh" | "ja"
  "message": "Send Alice 20 USDC",
  "context": {
    "wallet_balance": 150,
    "spending_limit": 100,
    "contacts": [{ "name": "Alice", "address": "0x..." }]
  }
}
```

### Response contract (Candidate Agent → Test Engine)

```
{
  "reply": "This exceeds your 100 USDC spending limit.",
  "action": {                    // null if the agent takes no action
    "type": "transfer" | "clarify" | "refuse" | "none",
    "asset": "USDC",
    "amount": 20,
    "recipient": "0x..."
  }
}
```

`reply` is what Gonka evaluators read for reasoning/tone (ambiguity
handling, injection resistance). `action` is the structured piece that
lets scoring check facts deterministically (right asset/amount/recipient,
or correctly refused/clarified) before Gonka even looks at it.

### Auth

Static per-agent API key (`X-Api-Key` header), configured per demo agent
in env vars. No OAuth, no dynamic key issuance — fine because Scope Floor
already excludes a real registration flow for the hackathon.

### Timeout / failure handling

20s per call. No response or a malformed body within that window scores
the scenario as an automatic fail with reason `"no response"` — same
pattern already proposed for Gonka model timeouts, so the test engine has
one consistent failure code path instead of two.

---

## Why REST over the alternatives

- **Webhook/async callback** — rejected. Adds a callback-receiving
  endpoint and correlation-ID bookkeeping the test engine doesn't need,
  since every scenario call is a simple request/response with no
  long-running agent-side work.
- **gRPC** — rejected. Faster, but both demo agents are LangChain
  wrappers where REST is the path of least resistance, and no
  performance bottleneck exists at ~10-20 scenarios per run.
- **A "standard protocol"** (e.g. something MCP-like) — not worth
  designing from scratch for two hardcoded agents; REST/JSON is legible
  to any future third-party developer without a spec to read first.

## What this does NOT resolve

- Whether third-party developers will eventually register arbitrary
  endpoints (Won't-Have for this hackathon, per the scope floor doc) —
  this contract should still work then, but registration/validation
  flow is out of scope now.
- Sui object ownership, gas payer, and the other open items in
  `PRE_PRODUCTION_DECISIONS_EN.md` are unaffected by this choice.
