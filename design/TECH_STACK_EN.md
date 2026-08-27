# Recommended Tech Stack

Compiled from `PRE_PRODUCTION_DECISIONS_EN.md`, `AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md`,
and what's actually running in the current scaffold (see `CHANGELOG.md`,
2026-08-27 entry). One place to check "what are we building with" instead
of re-deriving it from three docs each time.

Status legend: ✅ built and running · 🟡 chosen, not yet implemented ·
🔴 open decision (no default picked yet)

---

## Frontend

| Layer | Choice | Status |
|---|---|---|
| Framework | React 18 + TypeScript | ✅ |
| Build tool | Vite 5 | ✅ |
| Real-time updates | ~~WebSocket (Socket.io)~~ → **Supabase Realtime**, subscribing to the off-chain results table (see Backend row below) | ✅ wired up in `frontend/src/App.tsx` + `frontend/src/supabaseClient.ts` — degrades to final-result-only if unconfigured |
| Wallet integration | ~~`@mysten/dapp-kit`~~ → **not needed** | ❌ cut — see "Corrections" below |

## Backend

| Layer | Choice | Status |
|---|---|---|
| Runtime | Node.js + Express 4 | ✅ |
| Language | TypeScript 5, `ts-node-dev` for local dev | ✅ |
| Off-chain database | ~~PostgreSQL or MongoDB~~ → **Supabase (managed Postgres)** | ✅ framework built — schema at `backend/supabase/schema.sql`, client/writes in `backend/src/db/`; needs a real project's URL/key in `.env`, and must NOT reuse the unrelated Supabase project already linked in this environment |
| Agent connection protocol | REST/JSON, `POST /v1/agent/invoke`, `X-Api-Key` shared-secret auth, 20s timeout → auto-fail | ✅ implemented in `backend/src/agent-client/` |

## Demo Agents

| Layer | Choice | Status |
|---|---|---|
| SafeAgent | Express stub, solid system-prompt behavior simulated | ✅ (`agents/safe-agent`) — scores 100/100 in local test run |
| YOLOAgent | Express stub, deliberately weak | ✅ (`agents/yolo-agent`) — scores 58/100, fails permission_compliance + prompt_injection_resistance as intended |
| ~~Real LangChain implementation~~ | **Keep the hand-rolled logic that's already built** — not a stand-in to replace | ✅ final choice, see "Corrections" below |
| Wallet operations | Real Sui testnet tx vs. mocked | 🔴 open — Scope Floor says mock for hackathon |

## Gonka (multi-model evaluation)

| Layer | Choice | Status |
|---|---|---|
| Models | Kimi-K2.6 + MiniMax + a Chinese-strong model, fired in parallel via `Promise.all` | 🔴 real model IDs on Gonka Router unverified — **also see model-diversity flag in "Corrections"** |
| Current behavior | `backend/src/gonka/router.ts` returns heuristic scores as a placeholder | 🟡 stubbed, marked `TODO` |
| Timeout / retry | 15s per model timeout, 3 retries w/ exponential backoff | 🔴 not yet implemented (depends on real router endpoint) |

## Sui (on-chain certification)

| Layer | Choice | Status |
|---|---|---|
| Language | Move | ✅ package at `move/sources/trust.move`; `agent_id`/`test_run_id` corrected from `address`/`u64` to `String` (see file header) since neither the backend nor demo agents have real per-agent Sui addresses or numeric run ids |
| SDK | ~~`@mysten/sui.js`~~ → **`@mysten/sui`** | ✅ both the read-only `SuiClient` and the real write path (`issue_certification` call) implemented in `backend/src/sui/client.ts` |
| Network | Testnet | ✅ free via faucet — see `IMPLEMENTATION_NOTES_EN.md` "Testnet Sui setup" for the manual CLI steps (publish + fund, needs the `sui` binary, not runnable from this dev sandbox) |
| Object model | One final `AgentCertification` object per run (Must-Have) | ✅ implemented; per-test `TestResult` writes (Should-Have) still not wired up |
| Gas payer / ownership | Backend's own keypair pays (free on testnet) and receives both object types | ✅ resolved as a hackathon default — see `PRE_PRODUCTION_DECISIONS_EN.md` §1 |
| Current behavior | Writes a real `AgentCertification` object if `SUI_PACKAGE_ID`+`SUI_PUBLISHER_PRIVATE_KEY` are set and funded; otherwise (or on any write failure) falls back to a mocked object ID | ✅ |

## Scoring

| Layer | Choice | Status |
|---|---|---|
| Category weights | Configurable per-category weights + model-agreement factor | ✅ implemented (`backend/src/scoring/`), currently equal weights until team picks real numbers |
| Agreement formula | Standard deviation vs. variance based | 🔴 open |
| Certification thresholds | 90-100 / 75-89 / 60-74 / 40-59 / 0-39 | ✅ implemented as `getCertificationTier()` in `backend/src/scoring/score.ts`; band edges are the proposed default, tier labels ("Excellent"/"Strong"/…) are placeholders pending a naming pass |

---

## Corrections (this review)

The design doc's defaults were reasonable starting guesses, but five of
them don't hold up once weighed against what the project actually needs
and what's already true of the environment/scaffold. Changed here rather
than left as "recommended defaults":

1. **`@mysten/sui.js` is deprecated.** Mysten Labs consolidated it into
   `@mysten/sui`. Starting new integration work today on the old package
   name means redoing it before ship. Corrected everywhere in this doc —
   use `@mysten/sui`.

2. **Socket.io + a separate database decision, replaced by one choice:
   Supabase.** The project has two open items — "which off-chain DB" and
   "how do we push live test progress to the dashboard" — that are
   actually the same problem. Supabase is Postgres (fits the relational
   shape of `agent → test_run → scenario_result` well, with JSONB for the
   off-chain reasoning logs the Sui design already calls for) *and* ships
   Realtime subscriptions on table changes for free. Writing a test
   result row and having the frontend receive it via a Realtime
   subscription removes the entire Socket.io layer — no hand-rolled
   WebSocket server, no reconnect/room logic to write under hackathon time
   pressure. It's also already available as a configured tool in this
   environment (`mcp__supabase__*`), so there's no setup cost to adopt it.
   MongoDB is dropped — nothing in this data model is document-shaped or
   schema-variable enough to need it.

3. **Cut `@mysten/dapp-kit` from Must-Have.** It solves "let a browser
   user connect their wallet," but nothing in the Scope Floor needs that:
   wallet operations are explicitly mocked (Won't-Have), and on-chain
   writes are made by the test engine's own backend keypair
   (`SUI_PUBLISHER_PRIVATE_KEY`), not a user's connected wallet. Confirmed
   `frontend/src/App.tsx` has no wallet-connection code today. Only bring
   this back if the team later decides agent owners should claim/view
   their `AgentCertification` through their own wallet — not needed for
   the demo narrative in `SCOPE_FLOOR_PROPOSAL_EN.md`.

4. **Drop the "simple LangChain implementation" target for demo agents.**
   Both agents are already built (`agents/safe-agent`,
   `agents/yolo-agent`) as plain Express handlers with regex-based intent
   parsing, and they already produce the intended contrast (SafeAgent
   100/100, YOLOAgent 58/100, failing exactly the two categories the demo
   narrative needs). LangChain would add a dependency, an abstraction
   layer (chains/prompt templates/output parsers), and a live-LLM-call
   failure mode (latency, API keys, non-determinism) to something that
   currently works deterministically and transparently — worse for a
   judged demo, not better. Treat the current hand-rolled agents as the
   final choice, not a stand-in to replace before submission.

5. **Gonka model roster lacks lineage diversity — flag, not yet fixed.**
   The three planned judges — Kimi-K2.6, MiniMax, and "a Chinese-strong
   model" — are all Chinese-lineage models. The whole point of the
   3-model pillar is that *independent* judges disagreeing is a
   meaningful trust signal; three models trained on similar-distribution
   data/RLHF are more likely to share blind spots, which quietly weakens
   the "high agreement = high confidence" claim in the pitch. This doesn't
   need reversing the Chinese-language strength (that still matters for
   multilingual-fidelity judging) — it needs a genuinely different-lineage
   third judge (e.g., a Western frontier model) swapped in for one of the
   three, if Gonka Router's actual catalog offers one. Needs a decision
   once real model availability is confirmed (still 🔴 in
   `PRE_PRODUCTION_DECISIONS_EN.md` §2) — noted here so it isn't picked
   arbitrarily once names are available.

---

## Why these choices (short version)

- **REST/JSON over webhook or gRPC** for the agent connection interface —
  every scenario call is a simple synchronous request/response with no
  agent-side long-running work, so the extra machinery isn't worth it for
  two hardcoded demo agents. Full reasoning in
  `AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md`.
- **React + Express + TypeScript everywhere** — team's existing skillset,
  no framework-learning cost during a hackathon.
- **Move + Sui testnet** — required by the Sui pillar of the pitch; testnet
  because this isn't a production deployment.
- **Supabase over separate Postgres + Socket.io** — one dependency instead
  of two, no server-side realtime code to write, and it's already
  available as a tool in this environment.
- **Heuristic Gonka stub for now** — lets scoring, the test engine, and the
  frontend all be built and demoed end-to-end before the real Gonka Router
  model IDs are confirmed, per the Scope Floor "start building instead of
  designing" principle.

## Open items blocking full implementation

Same list as `PRE_PRODUCTION_DECISIONS_EN.md` §"Summary of Highest-Priority
Open Items" — repeated here because they're what turns 🔴/🟡 rows above into
✅:

1. Real Gonka model IDs, and specifically whether a non-Chinese-lineage
   third judge is available (see Correction #5 above)
2. Category weighting formula
3. Submission deadline

Resolved by this review, no longer open: off-chain database
(Supabase/Postgres), realtime mechanism (Supabase Realtime), demo-agent
implementation approach (keep hand-rolled), Sui SDK package name
(`@mysten/sui`), frontend wallet library (not needed), Sui gas payer
(testnet faucet — free either way), Sui object ownership (defaulted to
test-engine-owns for the hackathon floor), wallet operations in demo (cut
entirely, matches Scope Floor).

---

**Last updated:** August 27, 2026
