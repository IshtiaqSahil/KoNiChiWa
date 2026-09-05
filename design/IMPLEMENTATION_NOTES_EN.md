# Implementation Notes — Supabase, Sui, Certification Tiers

For whoever picks this up next. Covers everything built across the
2026-08-27 16:00-19:00 sessions (see `CHANGELOG.md` for the raw log) —
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
   the deprecated `@mysten/sui.js`) and **writes a real on-chain
   `AgentCertification` object** when configured — gas payer and object
   ownership, previously open decisions, are resolved as hackathon
   defaults (testnet SUI is free via faucet either way; the backend's own
   keypair pays and owns). See "Testnet Sui setup" below.
3. Scores now come with a **certification tier** label
   ("Excellent"/"Strong"/"Adequate"/"Weak"/"Failing").
4. Nothing about the demo narrative changed: SafeAgent still scores
   100 ("Excellent"), YOLOAgent still scores 58 ("Weak"), verified locally
   after every change.
5. **You need to set up your own Supabase project and (optionally) publish
   the Move package to Sui testnet** before the new code does anything
   live — see below. Nothing breaks if you skip either: Supabase
   persistence/realtime silently no-ops, and Sui writes fall back to a
   mocked object id.

---

## Setup: your own Supabase project
Create your own free Supabase project:

1. Create a project at supabase.com (or ask whoever owns the team's
   Supabase account to make one for Verity).
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

## Testnet Sui setup

`backend/src/sui/client.ts` now does a real on-chain write
(`issue_certification`) when `SUI_PACKAGE_ID` and
`SUI_PUBLISHER_PRIVATE_KEY` are both set and the address they resolve to
has testnet SUI. Everything up through "sign and submit the transaction"
is already coded — what's left is CLI-only setup that needs the `sui`
binary, which isn't available in this dev sandbox, so run these steps
yourself:

1. **Install the Sui CLI.** Easiest on any platform: download a prebuilt
   binary from the Releases page of
   `https://github.com/MystenLabs/sui` (the same repo already referenced
   in `move/Move.toml`) and put it on your `PATH`. Building from source via
   `cargo install` also works but is a long compile — skip it unless the
   binary release doesn't cover your platform.
2. **Point the CLI at testnet and create an address:**
   ```
   sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
   sui client switch --env testnet
   sui client new-address ed25519
   ```
   (If this is your very first time running `sui client`, it'll prompt you
   to set up a config and an address interactively — follow the prompts,
   they land in the same place.)
3. **Fund it — free, no real money:**
   ```
   sui client faucet
   ```
   Testnet SUI has no monetary value; this is exactly what resolves the
   "who pays gas" decision that used to be open (see
   `PRE_PRODUCTION_DECISIONS_EN.md` §1) — it doesn't matter who "pays"
   because it's free either way.
4. **Publish the Move package:**
   ```
   cd move
   sui client publish --gas-budget 100000000
   ```
   Find the `packageId` in the output (or in the `objectChanges` of type
   `"published"`) → that's `SUI_PACKAGE_ID`.
5. **Export the private key in the format the backend expects** (a bech32
   string starting `suiprivkey1...`, which `decodeSuiPrivateKey` in
   `backend/src/sui/client.ts` parses directly):
   ```
   sui keytool export --key-identity <your address from step 2>
   ```
   → that's `SUI_PUBLISHER_PRIVATE_KEY`.
6. Fill both into `.env` alongside the already-present `SUI_NETWORK=testnet`
   and `SUI_RPC_URL=https://fullnode.testnet.sui.io:443`.
7. Run a test suite (`curl -X POST http://localhost:4000/test-runs/safe-agent ...`
   or the dashboard) and check the returned `certification.sui_object_id` —
   it should now be a real `0x...` object id instead of `0xMOCK_...`.
   Paste it into the Sui testnet explorer to see the object.

If you skip this, `writeCertification()` falls back to the same mocked
`0xMOCK_<test_run_id>` behavior as before — nothing else in the pipeline
depends on this being real.

**Object ownership note:** the Move contract's `agent_id` field was
originally typed `address` and `test_run_id` was `u64` — both were
type-mismatched against what the backend actually has (agent ids are
strings like `"safe-agent"`, run ids are strings like `"run_<uuid>"`, and
there's no real per-agent Sui wallet since wallet integration was cut).
Fixed to `String` in `move/sources/trust.move` — re-publish if you had an
older build. `AgentCertification` is transferred to the backend's own
address (not the agent developer's), a pragmatic default for the
hackathon floor — see the module doc comment in `trust.move` for the full
reasoning and how to change it later.

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
| `backend/src/sui/client.ts` | Real read-only `SuiClient` (`@mysten/sui/client`), plus `writeCertification()` now builds/signs/submits a real `issue_certification` transaction when `SUI_PACKAGE_ID`+`SUI_PUBLISHER_PRIVATE_KEY` are set and funded, falling back to the mocked object id otherwise or on any failure. |
| `move/sources/trust.move` | `agent_id` (`address` → `String`) and `test_run_id` (`u64` → `String`) corrected to match what the backend actually has; both structs now transfer to the caller's own address (test-engine-owns default). |
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
- **Per-test `TestResult` writes**: the Move entry function
  `record_test_result` exists and is correctly typed, but nothing calls it
  yet — only the final `issue_certification` (Must-Have) is wired up. This
  is the Should-Have "per-test write" upgrade from
  `SCOPE_FLOOR_PROPOSAL_EN.md`.
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
