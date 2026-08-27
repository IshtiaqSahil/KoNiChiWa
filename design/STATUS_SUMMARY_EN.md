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
| Frontend (React/Vite) | ✅ full dashboard — score dial, formula breakdown, per-category/per-language bars, live per-scenario rows, UI in en/zh/ja |
| Agent connection interface (REST/JSON) | ✅ finalized and implemented |
| Two demo agents (SafeAgent/YOLOAgent) | ✅ working, reproduce the intended contrast (100 vs. 58) |
| Scoring + certification tiers | ✅ implemented (Excellent/Strong/Adequate/Weak/Failing) |
| Supabase (persistence + live progress) | ✅ framework built (needs the team's own Supabase project) |
| Sui SDK + on-chain writes | ✅ real `AgentCertification` write implemented (needs the `sui` CLI run once — see `IMPLEMENTATION_NOTES_EN.md` "Testnet Sui setup" — falls back to a mock id until then) |
| Real Gonka model calls | ✅ real GonkaRouter calls, heuristic stub as per-model fallback |
| Multilingual testing (pillar #3) | ✅ every scenario runs in en/zh/ja; language-stability factor in the score and written on-chain |

SafeAgent scores 100 (Excellent). YOLOAgent scores 29 (Failing) on the
default en+zh+ja suite, or 58 (Weak) with `SCENARIO_LANGUAGES=en` — it fails
`permission_compliance` and `prompt_injection_resistance` in English, and
fails everything in Chinese and Japanese (per-language averages: en 48,
zh 16, ja 16), which is pillar #3 doing its job rather than a regression.
This contrast is the core of the demo, so it's been re-verified after every
change so far.

**Caveat on these two numbers:** they were measured with the heuristic stub
judge (no `GONKA_API_KEY` in that environment), not against live Gonka
models. The multilingual scores in particular are untested against real
judges — the stub applies a fixed 0.6x penalty for replying in the wrong
language, whereas a real model decides that weighting for itself from the
judge prompt. Expect the exact figures to move once someone re-runs this
with the team key; the ordering (SafeAgent well clear of YOLOAgent, zh/ja
well below en for YOLOAgent) is what the design guarantees, not the digits.
The `model_agreement` percentages are the least meaningful of all on the
stub path — they come from fixed jitter seeds, not real cross-model spread.

---

## What's needed next

**Team decisions (the actual bottleneck):**

1. **Lineage-diverse third judge** — Gonka model IDs are confirmed and wired
   up, but all three GonkaRouter models are Chinese-lineage, which weakens
   the cross-model-agreement signal. Either accept it as a stated limitation
   or bring in an outside model.
2. **Category and language weighting** — both placeholders (equal category
   weights; Chinese 1.5x vs. 1.0x for the brief's "weighted heavily"). They
   multiply, so decide them together — `backend/src/scoring/weights.ts`.
3. **Certification tier bands vs. the multilingual track** — YOLOAgent now
   lands in "Failing" rather than "Weak". If the pitch wants the softer
   contrast, the lever is `SCENARIO_LANGUAGES` or the tier bands, not the
   scoring formula.
4. **Submission deadline** — needed to plan backward.

Resolved since the last update: Sui gas payer and object ownership (both
defaulted — testnet SUI is free via faucet, backend's own keypair pays and
owns; see `PRE_PRODUCTION_DECISIONS_EN.md` §1).

**Technical next steps:**
- Stand up the team's own Supabase project and run
  `backend/supabase/schema.sql` against it (the Supabase project already
  linked in this dev environment belongs to an unrelated app — don't reuse
  it).
- Run the manual `sui` CLI steps once (install, fund via faucet, publish)
  to turn on real on-chain writes — see `IMPLEMENTATION_NOTES_EN.md`
  "Testnet Sui setup." Nothing breaks if this is skipped.
- Re-run `backend/supabase/schema.sql` against the team's project: the
  multilingual columns are new (additive `add column if not exists`, safe to
  re-run, no data loss).
- If time allows: more scenario templates (the suite is 3 templates x 3
  languages = 9 runs; the scope floor asked for ~10 scenarios and adding one
  is a single object in `scenarios.ts`), and per-test `TestResult` on-chain
  writes (Should-Have #1 — `record_test_result` exists in the Move module but
  isn't called).

---

**Last updated:** August 28, 2026
