# Changelog

Single source of truth for what changed in this project and why. Every
teammate (and every AI agent acting on their behalf) adds an entry here
for any non-trivial change — code, docs, architecture decisions,
scope changes. Newest entry at the top.

Format:

```
## YYYY-MM-DD HH:MM — Short title (who/agent)
What changed and why. Link files/PRs if useful.
```

---

## 2026-08-27 23:50 — Real Gonka Router integration implemented (Sahil)
Resolved the last open Gonka item: confirmed GonkaRouter (gonkarouter.io,
not the broker-directory gonka.ai flow) is what the hackathon-provided key
points at. It's OpenAI-compatible (`POST {GONKA_ROUTER_URL}/chat/completions`,
`Authorization: Bearer`). Confirmed exact model ids from their docs:
`moonshotai/Kimi-K2.6`, `MiniMaxAI/MiniMax-M2.7`; third slot
(`deepseek-ai/DeepSeek-V4-Flash-0731`) has its id format inferred from the
same convention, not confirmed against the dashboard yet.

**`backend/src/gonka/router.ts`** rewritten: `evaluate()` now takes the
full `Scenario` (not just `expected`) so the judge prompt has the actual
user message + wallet context to reason about, not just a fixed expected
answer to pattern-match. Each model gets a real call — a prompt asking for
strict-JSON `{"score", "reasoning"}`, `temperature: 0`. Falls back to the
existing deterministic heuristic stub per-model, either globally (if
`GONKA_API_KEY`/`GONKA_ROUTER_URL` unset) or individually on any call
failure/timeout/malformed response — same degrade-gracefully pattern as
`sui/client.ts` and `db/persistence.ts`. `backend/src/testRun/orchestrator.ts`
updated for the new `evaluate(scenario, response)` signature.

**Timeout tuned from live testing**: `PRE_PRODUCTION_DECISIONS_EN.md` §2
recommended 15s. Tested against the real hackathon key (18 live calls
across 2 runs): `deepseek-ai/DeepSeek-V4-Flash-0731` was fast and reliable
(6/6 succeeded), but `moonshotai/Kimi-K2.6` and `MiniMaxAI/MiniMax-M2.7`
frequently exceeded 15s (5/12 timed out) — likely load on GonkaRouter
during the hackathon, not a bug (all failures were `TimeoutError`, never
an auth/format error, confirming the key and request shape are correct).
Bumped to 28s, which cut the fallback rate from 5/9 to 2/9 judgments on a
repeat run, trading ~33s/run instead of ~46s for more real (non-stub)
judgments.

**Known limitation, not fixed**: all three GonkaRouter models are
Chinese-lineage (per `TECH_STACK_EN.md` "Corrections" #5's flag) —
GonkaRouter doesn't offer a non-Chinese-lineage model at all, so this can't
be resolved by picking a different Gonka model. Team decision needed on
whether to accept it or bring in an outside model for genuine lineage
diversity.

Verified end-to-end with the real hackathon key in local `.env` (not
committed): both SafeAgent and YOLOAgent runs against live GonkaRouter
calls produced correct tiers (100/"Excellent" and 50-58/"Weak" depending
on how many judgments landed real vs. stub) with real per-model reasoning
text visible in the response. Also verified the all-stub fallback path
still works with the key blank. Typechecked clean.

## 2026-08-27 21:15 — Wire up root .env loading, set up team Supabase project (Sahil)
Set up a Supabase project for the team (`fgcuzvrtgxgoqkijswpm`) and ran
`backend/supabase/schema.sql` against it. Filled `.env` (local, gitignored)
with the project URL + anon + service_role keys.

Found neither service actually read a root-level `.env`: no `dotenv` in
`backend`, and Vite only reads env files from its own directory
(`frontend/`) by default, not the monorepo root where `.env.example`
lives. Fixed both without adding a dependency:
- `frontend/vite.config.ts`: added `envDir: ".."` so Vite reads the root
  `.env`.
- `backend/package.json`: `dev`/`start` scripts now pass
  `--env-file=../.env` (Node 20.6+ native flag, verified working on
  Node 24) instead of requiring a `backend/.env`.

Verified: restarted all 4 services, ran both agents through the
dashboard — Supabase Realtime rows now stream in live during a run
instead of the orange "not configured" fallback notice.

## 2026-08-27 19:00 — Real Sui testnet writes implemented (konosuke)
Resolved the two remaining Sui open decisions as hackathon defaults:
testnet SUI is free via faucet, so "who pays gas" has no real cost either
way — the backend's own keypair pays. Object ownership defaulted to
"the test engine's own address" for both `TestResult` and
`AgentCertification`, since there's no real per-agent wallet (wallet
integration was cut in an earlier pass). Documented in
`PRE_PRODUCTION_DECISIONS_EN.md` §1 and `TECH_STACK_EN.md`.

**Bug found and fixed**: `move/sources/trust.move`'s `agent_id` field was
typed `address` and `test_run_id` was `u64`, but the backend only has
string identifiers for both (`"safe-agent"`, `"run_<uuid>"`) — no real
Sui address per agent, no numeric run id. Changed both to `String` in both
structs and both entry functions before anyone tried to publish/call them
with the wrong types.

**`backend/src/sui/client.ts`**: `writeCertification()` now builds a
`Transaction` calling `issue_certification`, signs it with a keypair
loaded from `SUI_PUBLISHER_PRIVATE_KEY` (via `decodeSuiPrivateKey` +
`Ed25519Keypair.fromSecretKey`), submits via `signAndExecuteTransaction`,
and returns the real created object's id. Falls back to the previous
mocked `0xMOCK_<id>` behavior if `SUI_PACKAGE_ID`/the keypair aren't
configured, or if the write throws — verified the fallback still returns
the correct 100/"Excellent" vs. 58/"Weak" split with typecheck clean and a
live local run. Per-test `TestResult` writes (Should-Have) still not
wired up, only the Must-Have final `AgentCertification`.

Added a "Testnet Sui setup" section to `design/IMPLEMENTATION_NOTES_EN.md`
with the exact manual `sui` CLI steps (install, fund via faucet, publish,
export key) — the `sui` binary isn't available in this dev sandbox, so
this part has to be run by a teammate, not by the agent. Updated
`TECH_STACK_EN.md` and `STATUS_SUMMARY_EN.md` to reflect gas payer/
ownership being resolved and Sui writes being implemented.

Also discussed (not yet implemented, pending teammate confirmation of
which specific product): using a generic endpoint+API-key router as an
interim substitute for Gonka while real Gonka Router access is confirmed.
`backend/src/gonka/router.ts`'s `evaluate()` function is already the only
integration point, so this would be a low-risk swap when scoped.

## 2026-08-27 18:00 — Status summary doc added (konosuke)
Added `design/STATUS_SUMMARY_EN.md` — English translation of a status
recap given in chat (what we're building / where things stand / what's
needed next), saved as a standalone doc for quick onboarding. No code
changed.

## 2026-08-27 17:45 — Teammate-facing implementation notes added (konosuke)
Added `design/IMPLEMENTATION_NOTES_EN.md` so a teammate picking up the
Supabase/Sui-SDK/certification-tier work (previous entry below) doesn't
have to reconstruct it from the diff or the changelog: a TL;DR, exact
Supabase project setup steps (with an explicit warning not to reuse the
unrelated Supabase project linked in this dev environment), a data-flow
diagram of the new client-generated-run-id + Realtime-subscribe-before-
POST pattern, a full file map of what changed and why, an explicit list
of what's still stubbed/blocked (unchanged), and copy-pasteable
verification commands. Cross-linked from `WORKFLOW_EN.md`'s local dev
loop section. No code changed.

## 2026-08-27 17:20 — Built the framework for every decided stack item (konosuke)
Implemented everything from `design/TECH_STACK_EN.md` that isn't still
blocked on an open decision. Left untouched: real Gonka model calls/timeout
retry (blocked on model IDs), real Sui writes (blocked on object ownership
+ gas payer), wallet operations in the demo agents (blocked/mock-by-scope),
category weights and the agreement formula (both explicitly open).

**Supabase (Postgres + Realtime)** — `backend/supabase/schema.sql`
(`test_runs`, `scenario_results`, RLS policies, realtime publication,
idempotent); `backend/src/db/supabaseClient.ts` + `persistence.ts`
(service-role writes, no-op/log-only if unconfigured so test runs never
break on a missing/unreachable Supabase project); wired into
`backend/src/testRun/orchestrator.ts` (`startTestRun` → per-scenario
`recordScenarioResult` → `completeTestRun`/`failTestRun`). Frontend:
`frontend/src/supabaseClient.ts` (anon key) + `App.tsx` now generates the
`test_run_id` client-side (`generateTestRunId()` in `api.ts`) and
subscribes to a Realtime channel *before* triggering the run, so
per-scenario progress rows stream in live instead of only the final HTTP
response. **Checked first**: the Supabase project already linked via this
environment's MCP tools belongs to an unrelated app (`groups`,
`participants`, `spot_candidates`, ...) — did not touch it; schema is a
file for the team to run against their own project.

**Sui SDK correction applied** — `backend/src/sui/client.ts` now imports
`@mysten/sui` (not the deprecated `@mysten/sui.js`) and constructs a real
read-only `SuiClient` against `SUI_RPC_URL`/`SUI_NETWORK`. The actual
on-chain *write* stays mocked, since that's still blocked on object
ownership + gas payer.

**Certification tiers** — `CERTIFICATION_TIERS` in
`backend/src/scoring/weights.ts` + `getCertificationTier()` in `score.ts`,
using the proposed default bands (90/75/60/40/0) from
`PRE_PRODUCTION_DECISIONS_EN.md` §5. `TrustScore` now carries
`certification_tier`; surfaced in the dashboard.

Verified: typechecked both `backend` and `frontend` clean, then ran both
demo agents + backend locally and hit `/test-runs/safe-agent` and
`/test-runs/yolo-agent` directly — same 100/"Excellent" vs. 58/"Weak"
split as before, and the backend logs no errors with Supabase
unconfigured (confirms the no-op fallback works).

Also added `frontend/src/vite-env.d.ts` (needed for `import.meta.env`
typing) and new env vars in `.env.example`
(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY`). Updated `design/TECH_STACK_EN.md` status
column for every row that moved from 🔴/🟡 to ✅ or 🟡(partial).

## 2026-08-27 16:45 — Tech stack review + corrections (konosuke)
Re-reviewed `design/TECH_STACK_EN.md` for whether each choice is actually
optimal, not just "picked." Five corrections: (1) `@mysten/sui.js` is
deprecated, renamed to `@mysten/sui` — updated everywhere including
`WORKFLOW_EN.md`; (2) merged the open "Postgres vs Mongo" + "Socket.io"
decisions into one choice, Supabase (Postgres + Realtime), since it's
already available as a configured MCP tool in this environment and
removes a whole hand-rolled WebSocket layer; (3) cut `@mysten/dapp-kit`
from Must-Have — nothing in scope needs a browser wallet connection, the
backend signs Sui txs with its own keypair, confirmed no wallet code
exists in `frontend/src/App.tsx`; (4) dropped "LangChain wrappers" as a
target for the demo agents — the already-built, already-verified
hand-rolled Express agents are the better choice for a judged demo
(deterministic, no live-LLM-call failure mode), not a stand-in to
replace; (5) flagged (not yet fixed, blocked on real Gonka model
availability) that the planned 3-model roster — Kimi-K2.6, MiniMax, "a
Chinese-strong model" — has no lineage diversity, which weakens the
cross-model-agreement trust signal the Gonka pillar depends on.

## 2026-08-27 16:15 — Tech stack + workflow docs added (konosuke)
Added `design/TECH_STACK_EN.md` (a single table of every stack choice —
frontend, backend, demo agents, Gonka, Sui, scoring — each tagged ✅
built / 🟡 chosen-not-built / 🔴 open decision, cross-referenced against
what's actually in the scaffold) and `design/WORKFLOW_EN.md` (local dev
run commands + request-flow diagram for what works today, plus a
diagrammed build sequence for closing the remaining open decisions from
`PRE_PRODUCTION_DECISIONS_EN.md`, ordered by the priority list there and
the cut order in `SCOPE_FLOOR_PROPOSAL_EN.md`). No code changed.

## 2026-08-27 15:30 — Repo skeleton scaffolded (konosuke)
Built a working end-to-end skeleton so implementation can start without
waiting on every open decision in `design/PRE_PRODUCTION_DECISIONS_EN.md`.
Stack: Node/TS/Express `backend`, React/TS/Vite `frontend`, two Express
stub agents under `agents/` (`safe-agent`, `yolo-agent`), and a
hand-written (unbuilt - no Sui CLI here) Move package under `move/`.

What's real: the agent connection interface (REST/JSON per
`design/AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md`), a 3-scenario/
3-category test set (`backend/src/scenarios`), scoring with configurable
category weights and a model-agreement factor, and two demo agents with
genuinely different behavior. Verified locally: SafeAgent scores 100/100,
YOLOAgent 58/100, both correctly on `instruction_accuracy` but YOLOAgent
fails `permission_compliance` and `prompt_injection_resistance` as
intended for the demo narrative.

What's stubbed with `TODO` markers pointing back at the open decisions:
`backend/src/gonka/router.ts` (real Gonka Router model IDs unverified —
returns heuristic scores instead of calling out to Kimi-K2.6/MiniMax/a
Chinese-strong model), `backend/src/sui/client.ts` (mocks a Sui object id
instead of writing on-chain — blocked on object-ownership + gas-payer
decisions), and `backend/src/scoring/weights.ts` (equal category weights
until the team picks real numbers).

Also added two new design docs (`design/SCOPE_FLOOR_PROPOSAL_EN.md`,
`design/AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md`) and root
`.gitignore` entries for `node_modules/`, `dist/`, `.env`.

Not yet decided, still needs a team call: tech stack sign-off (this
scaffold assumed the design doc's recommended defaults), 4-way role
split, submission deadline, and the Sui/Gonka open items above.

## 2026-08-27 — Remove proposal doc from repo (Sahil)
Untracked `ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md` and added it to
`.gitignore` — the detailed proposal stays local, not pushed to GitHub.
`AGENTS.md` updated to drop the now-broken link and rely on its inline
summary of the idea instead.

## 2026-08-27 — Repo bootstrap (Sahil)
Initialized the repo with the project idea doc, `AGENTS.md` as the shared
brief for all AI agents on the team, and this changelog. From here on,
every change gets logged below.
