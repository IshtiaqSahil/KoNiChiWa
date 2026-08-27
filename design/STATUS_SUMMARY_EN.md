# Status Summary

A snapshot answer to "what are we building, how far are we, what's next" —
kept short on purpose. For full detail see `PRE_PRODUCTION_DECISIONS_EN.md`
(open decisions), `TECH_STACK_EN.md` (stack + status), `WORKFLOW_EN.md`
(dev loop + build sequence), and `IMPLEMENTATION_NOTES_EN.md` (handoff
notes for the Supabase/Sui-SDK/certification-tier work).

---

## What we're building

An **AI Agent Trust/Certification platform** (hackathon, 4-person team).
It tests candidate AI agents (e.g. payment/DeFi agents) for safety and
reliability, then records the results on-chain. Three pillars set it
apart:

1. **Sui** — every test result is written as its own on-chain object the
   moment it completes (sub-second finality), so certification progress
   is visible live instead of only at the end, and results can't be
   altered after the fact.
2. **Gonka** — each test scenario is judged in parallel by three different
   models (Kimi-K2.6, MiniMax, a Chinese-strong model). Cross-model
   agreement becomes a trust signal on its own: high agreement = high
   confidence, low agreement = flag for review.
3. **Multilingual testing** — scenarios run in English, Chinese, and
   Japanese, with Chinese weighted heavily since its complexity best
   exposes agents that only fake-support non-English users.

The demo narrative: run the same test suite against two agents (a safe one
and a deliberately weak one), show wildly different scores, and prove it's
on-chain.

---

## Where things stand

| Item | Status |
|---|---|
| Backend (Node/Express/TS) | ✅ working |
| Frontend (React/Vite) | ✅ minimal dashboard working |
| Agent connection interface (REST/JSON) | ✅ finalized and implemented |
| Two demo agents (SafeAgent/YOLOAgent) | ✅ working, reproduce the intended contrast (100 vs. 58) |
| Scoring + certification tiers | ✅ implemented (Excellent/Strong/Adequate/Weak/Failing) |
| Supabase (persistence + live progress) | ✅ framework built (needs the team's own Supabase project) |
| Sui SDK | 🟡 switched to the correct package (`@mysten/sui`); only the read-only client works so far |
| Real Gonka model calls | 🔴 not started (still a heuristic stub) |
| Real Sui writes | 🔴 not started (still a mocked object id) |

SafeAgent scores 100 (Excellent), YOLOAgent scores 58 (Weak), failing
`permission_compliance` and `prompt_injection_resistance` exactly as
intended — this contrast is the core of the demo, so it's been
re-verified after every change so far.

---

## What's needed next

**Team decisions (the actual bottleneck):**

1. **Confirm real Gonka model IDs** — verify Kimi-K2.6/MiniMax/a
   Chinese-strong model are actually available on Gonka Router. Also worth
   checking whether a lineage-diverse third judge is available, since all
   three currently planned models are Chinese-lineage, which weakens the
   cross-model-agreement signal.
2. **Sui object ownership model** — who owns `TestResult` /
   `AgentCertification`.
3. **Gas payer** — developer-pays vs. sponsored-transaction model.
4. **Category weighting** — currently equal weights as a placeholder.
5. **Submission deadline** — needed to plan backward.

**Technical next steps (once decisions land):**
- Stand up the team's own Supabase project and run
  `backend/supabase/schema.sql` against it (the Supabase project already
  linked in this dev environment belongs to an unrelated app — don't reuse
  it).
- Replace the Gonka heuristic stub with real API calls
  (`backend/src/gonka/router.ts`).
- Implement the real Sui write path
  (`backend/src/sui/client.ts`'s `writeCertification`).
- If time allows: add Chinese-language scenarios, polish the live
  dashboard.

---

**Last updated:** August 27, 2026
