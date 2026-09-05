<img src="frontend/public/logo.png" alt="Verity logo" width="120" />

# Verity — AI Agent Trust/Certification Platform

Verity tests candidate AI agents (payment/DeFi agents, in this demo) for
safety and reliability, then issues a certification that's independently
verifiable — not just a number your server asserts. It was built for MUBA
Hacks 2026 (Sui Track — AI × Sui) and the Gonka "AI for Society" challenge.

**Three pillars:**

1. **[Gonka](https://gonkarouter.io)** — every scenario is judged in
   parallel by three different models. Cross-model agreement becomes a
   trust signal on its own: high agreement = high confidence, low
   agreement = flag for review.
2. **[Sui](https://sui.io)** — every test result is written as its own
   on-chain object the moment it completes (not batched at the end), so
   certification progress is visible live and can't be altered after the
   fact.
3. **Multilingual testing** — every scenario runs in English, Chinese, and
   Japanese. Score variance across languages becomes a "multilingual
   stability" metric — it catches agents that only fake-support
   non-English users via a thin translation layer.

A fourth layer, [Walrus](https://docs.wal.app), stores the full per-model
reasoning trace behind every score, so "trust us" isn't the only option —
the actual judge reasoning is independently fetchable.

## What a certification actually contains

Run a candidate agent through the suite and you get:

- An **overall trust score** (0–100) and tier (Excellent / Strong /
  Adequate / Weak / Failing)
- A **safety floor**: the tier can never be better than what the worst
  safety-critical category (permission compliance, prompt-injection
  resistance) earns *on its own* — a catastrophic safety failure can't be
  averaged away by good language parsing elsewhere. See
  `backend/src/scoring/score.ts`.
- Per-category and per-language breakdowns, cross-model agreement, and
  every individual judge's score + reasoning + GonkaRouter request ID
- A real Sui object (`AgentCertification`, plus one `TestResult` per
  scenario) you can look up independently on-chain
- A Walrus-hosted copy of the full reasoning trace
- A public `/verify/:testRunId` link anyone can open to check the result
  without re-running anything

## Architecture

```
Candidate agent (any HTTP endpoint - see "Agent interface" below)
        │
        ▼
Test engine — 9 scenarios × 3 languages (en/zh/ja)
        │
        ▼
GonkaRouter — 3 models judge each scenario in parallel
  (Kimi-K2.6, MiniMax-M2.7, DeepSeek-V4-Flash — see backend/src/gonka/router.ts)
        │
        ├──► Sui — TestResult written per scenario, as it completes
        │         AgentCertification written once, at the end
        │         (backend/src/sui/client.ts, move/sources/trust.move)
        │
        └──► Walrus — full reasoning trace for the run
                  (backend/src/walrus/client.ts)
        │
        ▼
Dashboard (React) — live progress via Supabase Realtime,
  zkLogin sign-in so a real identity can own the resulting certification
  (frontend/, backend/src/zklogin/)
```

## Agent interface

Any agent can be certified — the contract is a plain HTTP endpoint, not a
specific language or framework:

```
POST {agent_base_url}/v1/agent/invoke
Header: X-Api-Key: <key>
Body:   { "scenario_id": "...", "language": "en"|"zh"|"ja",
          "message": "...",
          "context": { "wallet_balance": 100, "spending_limit": 50,
                        "contacts": [{"name": "Alice", "address": "0x..."}] } }

Response (within ~75s):
        { "reply": "...",
          "action": { "type": "transfer"|"clarify"|"refuse"|"none",
                       "asset": "...", "amount": 20, "recipient": "0x..." } | null }
```

Five demo agents in this repo implement it, on purpose spanning a range of
guardrail quality:

| Agent | What it demonstrates |
|---|---|
| `SafeAgent` | Validation layer, multilingual by construction |
| `YOLOAgent` | Minimal guardrails, English-only parsing |
| `NaiveAgent` | Multilingual, but zero guardrails in any language |
| `CarefulLLMAgent` | Real LLM, careful system prompt |
| `RecklessLLMAgent` | Same real LLM, permissive system prompt — no code difference from CarefulLLMAgent beyond the prompt |

Self-service registration (bring your own agent URL) isn't built yet — the
registry (`backend/src/routes/testRuns.ts`) is currently hardcoded to
these five for the hackathon's scope.

## Gonka Router integration

All AI judging runs through GonkaRouter's OpenAI-compatible
`/chat/completions` endpoint (`backend/src/gonka/router.ts`) — three
models judge every scenario independently, and the response's real
`id` field is threaded through to the dashboard and on-chain record as
proof a result came from the decentralized network, not a centralized
server. A judge call that fails is retried once before falling back to a
local heuristic (live-tested: this raised the real-judgment rate from 37%
to 89% against transient GonkaRouter routing flakiness). The candidate
agents' own LLM calls (`agents/llm-agent`) also run through GonkaRouter.

## Sui integration

`move/sources/trust.move` defines the on-chain schema
(`TestResult`, `AgentCertification`). `backend/src/sui/client.ts` signs and
submits real transactions over gRPC (Sui's JSON-RPC was decommissioned on
testnet in 2026). Object ownership defaults to the backend's own key, but
a signed-in user's zkLogin-derived address (`backend/src/zklogin/`,
`frontend/src/zklogin.ts`) can own the resulting certification instead —
real Google-identity-backed ownership, not just a database flag.

## Getting started

```bash
npm install
cp .env.example .env   # fill in Supabase, Gonka, Sui, zkLogin credentials
```

Run `backend/supabase/schema.sql` once against your own Supabase project
(SQL Editor), then start what you need:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:safe-agent      # + dev:yolo-agent, dev:naive-agent, dev:llm-careful, dev:llm-reckless
```

Sui writes need a published package (`sui client publish` against
`move/`) and a funded testnet keypair; Gonka/Walrus/zkLogin each degrade
gracefully to a stub/mock when unconfigured, so the rest of the pipeline
stays demoable without every credential in place. See the comments in
`.env.example` for what each variable needs.

## Known limitations

- All three GonkaRouter judge models are Chinese-lineage — GonkaRouter
  doesn't currently offer a non-Chinese-lineage alternative, which
  weakens the "independent judges" framing somewhat.
- Category and language weights (`backend/src/scoring/weights.ts`) reflect
  a considered first pass, not an externally validated standard.
- No self-service agent registration (see "Agent interface" above).
- Sponsored transactions and full Programmable Transaction Block batching
  aren't used yet — each on-chain write is its own transaction, submitted
  as each scenario completes.
