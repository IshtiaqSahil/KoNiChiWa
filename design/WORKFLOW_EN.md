# Workflow

Two workflows live here: how to **run the skeleton locally today**, and how
the team should **sequence the remaining build** given the open decisions
in `PRE_PRODUCTION_DECISIONS_EN.md`. See `TECH_STACK_EN.md` for what each
piece is built with, and `IMPLEMENTATION_NOTES_EN.md` for a walkthrough of
the Supabase/Sui-SDK/certification-tier work specifically (setup steps,
data flow, file map).

---

## 1. Local dev loop (works today)

```
npm install                    # once, from repo root (npm workspaces)
cp .env.example .env           # fill in PORT / agent URLs; Gonka+Sui vars can stay blank
                                # Supabase vars: see IMPLEMENTATION_NOTES_EN.md - optional,
                                # everything degrades gracefully without them

npm run dev:safe-agent         # :4001
npm run dev:yolo-agent         # :4002
npm run dev:backend            # :4000
npm run dev:frontend           # Vite dev server
```

Request flow for one test run:

```
Frontend ──POST──▶ backend (testRuns route)
                      │
                      ▼
              testRun/orchestrator.ts
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
  agent-client   gonka/router    sui/client
  (REST call to   (heuristic      (mocked
   safe/yolo       stub today)     object id
   agent)                          today)
        │             │              │
        └─────────────┴──────┬───────┘
                              ▼
                      scoring/score.ts
                              │
                              ▼
                     TestRunResult ──▶ frontend
```

Every scenario call is currently **sequential**, not `Promise.all` — an
intentional skeleton-stage simplification noted in
`backend/src/testRun/orchestrator.ts:30`. Switch to parallel once real
Gonka/Sui calls are wired in and per-test Sui writes (Should-Have #1 in
`SCOPE_FLOOR_PROPOSAL_EN.md`) are worth streaming live.

Verify it works end-to-end: run a test suite against SafeAgent (expect
~100/100) and YOLOAgent (expect ~58/100, failing `permission_compliance`
and `prompt_injection_resistance`). That contrast is the whole demo
narrative — if it stops reproducing, something upstream broke.

## 2. Change discipline

Every non-trivial change (code, docs, design decisions) gets an entry in
`CHANGELOG.md`, newest on top — this is the only thing keeping four
parallel agents/humans in sync. Skim it before starting work, add an entry
when you finish. See `AGENTS.md` for the full working agreement.

## 3. Build sequence to close the open decisions

Ordered so each step unblocks the next, following the priority list in
`PRE_PRODUCTION_DECISIONS_EN.md` and the cut order in
`SCOPE_FLOOR_PROPOSAL_EN.md`.

```
Step 0 (done)   Scaffold: backend/frontend/agents skeleton, REST agent
                contract, heuristic scoring, mocked Sui.
                                │
Step 1          Confirm submission deadline + role split (Sui / Gonka /
(blocks          Frontend lead) — needed to plan backward and parallelize
planning)         steps 2-4 across teammates instead of serializing them.
                                │
                ┌───────────────┼────────────────┐
                ▼               ▼                ▼
Step 2a         Step 2b         Step 2c
Gonka lead      Sui lead        Scoring/backend lead
Verify real     Decide object   Pick category weights +
model IDs on    ownership +     agreement formula (stdev
Gonka Router;   gas payer;      vs variance); replace
replace         run `sui move  equal-weight placeholder
heuristic       publish`,       in weights.ts
stub in         wire            
router.ts       @mysten/sui  
with real       into            
Promise.all     sui/client.ts   
calls                           
                └───────────────┼────────────────┘
                                ▼
Step 3          Switch orchestrator.ts loop from sequential to
                Promise.all now that real Gonka/Sui latency exists;
                add per-test Sui writes if time allows (Should-Have #1).
                                │
Step 4          Frontend: wire dashboard to real score/agreement data.
                Static refresh is fine (Must-Have); WebSocket live view
                is Should-Have #3 — only pick up if steps 2-3 land early.
                                │
Step 5          Multilingual: add Chinese as a second language pass over
                the same 10 scenarios (Should-Have #2). Japanese and
                cultural-context scenario variants are explicitly
                Won't-Have this hackathon.
                                │
Step 6          Demo polish: public verification page, Sui explorer link
                on the dashboard, rehearse the SafeAgent-vs-YOLOAgent
                walkthrough end-to-end.
```

Cut from the bottom if time runs short — everything in Step 5-6 is
Should-Have/polish, not load-bearing for the pitch. Steps 0-4 alone still
deliver the complete "same test, two agents, wildly different scores,
verifiable on-chain" demo.

---

**Last updated:** August 27, 2026
