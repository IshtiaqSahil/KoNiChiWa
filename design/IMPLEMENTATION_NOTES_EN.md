# Implementation Notes — Supabase, Sui SDK, Certification Tiers

For whoever picks this up next. Covers everything built in the
2026-08-27 16:00-17:30 session (see `CHANGELOG.md` for the raw log) —
what changed, why, how to get it running on your machine, and exactly
where the line is between "built" and "still blocked." Pairs with
`design/TECH_STACK_EN.md` (status of every stack choice) and
`design/WORKFLOW_EN.md` (day-to-day dev loop + build sequence).

---

## TL;DR

1. Off-chain persistence + live dashboard progress now run on **Supabase**
   (Postgres + Realtime) instead of the previously-undecided Postgres/Mongo
   + not-yet-built Socket.io.
2. The Sui client now uses the **current** SDK package (`@mysten/sui`, not
   the deprecated `@mysten/sui.js`) — read-only for now, since writing is
   still blocked on two open decisions.
3. Scores now come with a **certification tier** label
   ("Excellent"/"Strong"/"Adequate"/"Weak"/"Failing").
4. Nothing about the demo narrative changed: SafeAgent still scores
   100 ("Excellent"), YOLOAgent still scores 58 ("Weak"), verified locally
   after every change in this session.
5. **You need to set up your own Supabase project** before any of the new
   persistence/realtime code does anything — see below. Nothing breaks if
   you skip it; it just silently no-ops (dashboard still shows the final
   result, just not live per-scenario progress).

---

## Setup: your own Supabase project
Create your own free Supabase project:

1. Create a project at supabase.com (or ask whoever owns the team's
   Supabase account to make one for KoNiChiWa).
2. In the SQL editor, run `backend/supabase/schema.sql` once. It's
   idempotent — safe to re-run if you're not sure it already ran.
3. Grab four values from the project's API settings:
   - Project URL → `SUPABASE_URL` and `VITE_SUPABASE_URL` (same value)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend only —
     **never** expose this to the frontend/browser)
   - `anon`/publishable key → `VITE_SUPABASE_ANON_KEY` (safe for the
     browser — RLS policies in the schema only grant it `SELECT`)
4. Fill those into your `.env` (copy from `.env.example`, which already
   has the right variable names).
5. `npm install` at the repo root (already pulls in `@supabase/supabase-js`
   for both `backend` and `frontend`, and `@mysten/sui` for `backend`).

If you skip all of this, the app still runs — persistence calls become
silent no-ops (backend) and the dashboard shows a small orange notice and
falls back to displaying only the final result (frontend).

---

## How it works

```
Frontend                          Backend                        Supabase
--------                          -------                        --------
generateTestRunId()
  → "run_<uuid>"
        │
        ▼
subscribe to Realtime channel
"scenario_results" WHERE
test_run_id = <that id>   ─────────────────────────────────▶  (channel open,
        │                                                       nothing yet)
        ▼
POST /test-runs/:agentId
{ test_run_id }          ────────▶  runTestSuite(agentId,
                                     endpoint, testRunId)
                                            │
                                            ▼
                                     startTestRun()          ──▶ INSERT test_runs
                                            │                     (status: running)
                                     for each scenario:
                                       invoke agent
                                       evaluate (Gonka stub)
                                       recordScenarioResult() ─▶ INSERT scenario_results
                                            │                     │
                                            │            Realtime pushes the
                                            │            new row over the open
                                            │◀───────────channel ┘
        ◀───────────────────────────────────────────────  UI updates: new
  live progress row appears                                scenario line
        │                                            (while backend keeps looping)
                                            │
                                     calculateTrustScore()
                                     writeCertification()   (still mocked - see below)
                                     completeTestRun()      ──▶ UPDATE test_runs
                                            │                    (status: completed,
                                            │                     scores, tier, ...)
        ◀───────────────────────────────────  HTTP response
  final result rendered,
  channel unsubscribed
```

Two things worth calling out:

- **The `test_run_id` is generated client-side** (`generateTestRunId()` in
  `frontend/src/api.ts`), not by the backend, and sent in the POST body.
  That's the only way the frontend can subscribe to a Realtime channel
  *before* the run starts — if the backend generated the id, there'd be a
  race where early scenario rows could insert before the frontend even
  knows what to subscribe to. The backend still generates its own id as a
  fallback if the caller doesn't send one (`orchestrator.ts`'s
  `requestedTestRunId ?? "run_" + Date.now()`), so nothing breaks for any
  other caller of `runTestSuite`.
- **Persistence is a side channel, not the source of truth.** The
  orchestrator still returns the full result over HTTP regardless of
  whether any Supabase write succeeded — every `startTestRun` /
  `recordScenarioResult` / `completeTestRun` / `failTestRun` call is
  fire-and-forget-or-logged, never awaited in a way that would fail the
  request. This was a deliberate call: a flaky/misconfigured Supabase
  project should degrade the *demo polish* (no live rows), not the *demo
  itself* (score still comes back).

---

## File map

| File | What it does |
|---|---|
| `backend/supabase/schema.sql` | `test_runs` + `scenario_results` tables, RLS read policies, Realtime publication. Run once against your own project. |
| `backend/src/db/supabaseClient.ts` | Creates the service-role client from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; exports `null` if unset. |
| `backend/src/db/persistence.ts` | `startTestRun`, `recordScenarioResult`, `completeTestRun`, `failTestRun` — all no-op if `supabaseClient` is `null`, all log-and-continue on error. |
| `backend/src/testRun/orchestrator.ts` | Calls the four persistence functions at the right points in the existing scenario loop; wrapped the loop in try/catch so a mid-run failure calls `failTestRun` before rethrowing. |
| `backend/src/scoring/weights.ts` | Added `CERTIFICATION_TIERS` (the proposed 90/75/60/40/0 bands with placeholder labels). |
| `backend/src/scoring/score.ts` | Added `getCertificationTier()`; `TrustScore` now has a `certification_tier` field. |
| `backend/src/sui/client.ts` | Now imports `@mysten/sui/client` and constructs a real read-only `SuiClient`. `writeCertification()` itself is unchanged — still mocked, still blocked on the two Sui decisions. |
| `backend/src/routes/testRuns.ts` | Reads an optional `test_run_id` from the POST body and passes it through. |
| `frontend/src/supabaseClient.ts` | Anon-key client for the browser; exports `null` if unset. |
| `frontend/src/vite-env.d.ts` | New file — needed for `import.meta.env` typing (didn't exist before). |
| `frontend/src/api.ts` | Added `generateTestRunId()`; `runTestSuite()` now sends `test_run_id` in the request body. `TestRunResult.score` now includes `certification_tier`. |
| `frontend/src/App.tsx` | Generates the run id, opens a Realtime subscription before POSTing, renders live per-scenario rows while a run is in flight, shows the tier next to the overall score, and shows an orange notice if Supabase isn't configured. |
| `.env.example` | New vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. |

---

## What's still stubbed or blocked (unchanged by this work)

Nothing here was touched — listed so it's obvious what *wasn't* part of
this pass. Full detail in `PRE_PRODUCTION_DECISIONS_EN.md` and the "Open
items" list in `TECH_STACK_EN.md`.

- **Gonka**: `backend/src/gonka/router.ts` still returns heuristic scores.
  Real model IDs (and the lineage-diversity flag from `TECH_STACK_EN.md`
  "Corrections" #5) are still unresolved.
- **Sui writes**: `writeCertification()` still returns a mocked object id.
  Blocked on object-ownership model + gas-payer decision.
- **Category weights / agreement formula**: `CATEGORY_WEIGHTS` still equal
  weights; agreement formula still the original stddev-based stub.
- **Wallet operations**: demo agents still don't touch a real wallet
  (Scope Floor says mock — this is by design, not a gap).

---

## Verifying it still works

```
npm install
npm run dev:safe-agent   # :4001
npm run dev:yolo-agent   # :4002
npm run dev:backend      # :4000
npm run dev:frontend     # Vite dev server

curl -X POST http://localhost:4000/test-runs/safe-agent -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:4000/test-runs/yolo-agent -H "Content-Type: application/json" -d '{}'
```

Expect SafeAgent → `overall_score: 100`, `certification_tier: "Excellent"`;
YOLOAgent → `overall_score: 58`, `certification_tier: "Weak"`, failing
`permission_compliance` and `prompt_injection_resistance`. Both were
re-verified against the live code after every change in this session, with
and without Supabase configured — no errors either way, just no
`scenario_results` rows written when it's unconfigured.

---

**Last updated:** August 27, 2026
