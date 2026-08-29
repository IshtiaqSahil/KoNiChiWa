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

## 2026-08-29 18:05 — Fix llm-agent not loading root .env; document OpenRouter option (Claude)
`agents/llm-agent`'s `package.json` scripts were the only ones in the
workspace missing `--env-file=../../.env` (compare `backend/package.json`,
which has it) - so `LLM_AGENT_PROVIDER_URL`/`_API_KEY`/`_MODEL` were silently
never read even once set in `.env`. All four scripts (`dev:careful`,
`dev:reckless`, `start:careful`, `start:reckless`) now load it, matching
backend's pattern.

`.env.example` now calls out OpenRouter (`https://openrouter.ai/api/v1`) as
a concrete option alongside the existing "Big Pickle via OpenCode Zen"
mention, since it's the OpenAI-compatible router this agent's
provider-agnostic design was built for.

**Provider evaluation this session** (not landed in `.env` - still being
decided): tried OpenRouter with several models live against
`/v1/agent/invoke` - `meta-llama/llama-3.3-70b-instruct` needs purchased
credits (402), its `:free` variant is deprecated (404), and two other
`:free` models (`z-ai/glm-5.2`, `google/gemma-4-26b-a4b-it`) hit shared-pool
rate limits (429) - OpenRouter's free tier is largely unreliable capacity,
not a wiring problem (confirmed via `/auth/key`: this account's own request
count was nowhere near its daily cap). `minimax/minimax-m3:free` worked and
passed both the injection-refusal and legit-transfer scenarios end-to-end,
but replied in German to an English message - a real rule-6 (reply in the
user's language) violation from a small free model, not a bug in this repo.
Also tried OpenCode Zen (`https://opencode.ai/zen/v1`, model `big-pickle`)
with a supplied key - rejected with `AuthError: Invalid API key`, key
likely mistyped or needs regenerating. Final provider/model choice is
pending - `LLM_AGENT_PROVIDER_URL`/`_API_KEY`/`_MODEL` are unset in the
version-controlled `.env.example`; whoever picks this back up should reread
this entry before re-testing.

---

## 2026-08-29 16:20 — Real LLM-backed agent framework (Sahil)
The other half of "help me test real agents, not just regex" - `agents/llm-agent/`
is a genuinely LLM-powered candidate, not a stand-in, and it slots into the
same `/v1/agent/invoke` contract every other agent uses, so it (and every
future scenario category) works with zero pipeline changes.

**Two personas, not two providers**: `careful` and `reckless`
(`npm run dev:llm-careful` / `dev:llm-reckless`, picked via a CLI arg to
one shared `src/server.ts`) run the *same* model against the *same*
scenarios, differing only in system prompt. This is the direct
implementation of the earlier design conversation: model choice is an
unreliable lever for a clean good/bad demo split (a weak model can fail
unpredictably at everything; a strong one can pass despite a bad prompt),
but prompt quality reliably reproduces the same lesson SafeAgent/YOLOAgent
already teach - a sophisticated model with weak guardrails is exactly as
uncertifiable as a simple one.

**Provider-agnostic by design**: `LLM_AGENT_PROVIDER_URL`/`_API_KEY`/`_MODEL`
point at any OpenAI-compatible `/chat/completions` endpoint - Big Pickle via
OpenCode Zen, a paid OpenAI-compatible key, or "one might test other models
as well" later, all without touching code. Structured output uses the same
strict-JSON-in-the-prompt pattern already proven reliable against
GonkaRouter (`backend/src/gonka/router.ts`), including the same
`<think>`-block stripping, rather than the OpenAI `tools` function-calling
parameter, whose support isn't verified for whatever provider ends up
configured here.

**No fake fallback**: unlike Gonka/Sui, an unconfigured `llm-agent` doesn't
degrade to a heuristic - it returns a clear 503 "not configured" error.
An agent's response *is* the thing under test; faking it would corrupt the
data rather than just make the pipeline demoable.

**Also fixed while building this**: `backend/src/agent-client/client.ts`'s
per-agent call timeout was a hard 20s - tighter than real LLM inference
sometimes needs (Gonka judge calls ran close to 28s this session under
provider load). Bumped to 30s so a real LLM agent doesn't get killed by the
backend before it can even respond; harmless for the near-instant regex
agents.

**Verified live** (without a real key, since none is available yet): both
personas start cleanly with a visible "NOT CONFIGURED" log line, and
POSTing to `/test-runs/llm-careful-agent` returns a clean
`{"error":"Agent \"CarefulLLMAgent\" returned HTTP 503"}` through the full
pipeline - no crash, no corrupted data. Ready to test for real the moment
a provider/key is chosen. Backend typecheck and full frontend build clean.

## 2026-08-29 15:45 — Third demo agent: NaiveAgent (Sahil)
More "patients" for a richer data spread, not just a binary good/bad pair.
`agents/naive-agent/` - genuinely multilingual (like SafeAgent, unlike
YOLOAgent) but zero safety checks in any language (like YOLOAgent, unlike
SafeAgent): it correctly understands and blindly obeys every scenario in
en/zh/ja, including the injection payload and the over-limit request.

**Why this specific combination, not just "a third bad agent"**: YOLOAgent
and NaiveAgent are both bad, but in genuinely different, informative ways.
YOLOAgent's low `language_stability` score happens *because* it looks safe
in English and only collapses outside it. NaiveAgent is uniformly reckless
in all three languages - which gives it a *high* stability score despite a
low overall score. Demonstrates that stability measures consistency, not
quality: a consistent agent isn't necessarily a good one.

Registered like the other two (`backend/src/routes/testRuns.ts`,
`NAIVE_AGENT_URL`/`NAIVE_AGENT_API_KEY`, root `package.json` workspace +
script), added to the frontend's agent list, i18n `agentNotes` (all 3
locales), and the `AGENT_LABELS` maps in `VerifyPage`/`CertificationsPage`.

**Verified live** (after ruling out a false alarm - curl's shell handling
of the raw zh/ja UTF-8 test payloads was mangling the request, not the
agent's own parsing; confirmed correct behavior via a Node `fetch` call
instead): 39/100 "Failing", but 92% language stability -
`en 34 / zh 42 / ja 42`, consistently bad across all three, exactly the
intended contrast with YOLOAgent's pattern. Dashboard renders the third
card correctly (confirmed via page text, not just a screenshot - the
card was below the fold at this viewport width). Full frontend build and
both backend typechecks clean.

## 2026-08-29 01:40 — Certifications history page (Sahil)
`frontend/src/CertificationsPage.tsx` (new, `/certifications`) - a
browsable list of every completed certification, most recent first, each
row linking to its `/verify/:id` page. Fills the gap between VerifyPage
(one result, only reachable if you already have its link) and the live
dashboard (only ever shows the two demo agents' latest run) - there was no
way to see certification history at all before this. Reads straight from
Supabase (`test_runs`, same public-read RLS as VerifyPage), capped at the
100 most recent. Linked from the main dashboard's status strip so it's
discoverable, not just reachable by typing the URL.

Extracted `loadUiLanguage`/`LOCALE_KEY` (was duplicated verbatim between
`App.tsx` and `VerifyPage.tsx`) into `frontend/src/uiLanguage.ts` rather
than copy-pasting it a third time for this page.

**Bug found and fixed while testing against real historical data**: rows
written before `model_agreement_factor`/`language_stability_factor`
existed in the schema (i.e. every certification from before today's
verification-page work) render those as `null` - VerifyPage's formula line
showed `11 ×  × = 13` with blank gaps instead of numbers. Fixed to show
`—` for missing factors instead of nothing.

Verified live: history list shows real runs from throughout this session
(both agents, full score range), clicking a row navigates to the correct
verification page, and the null-factor fix confirmed against an actual
pre-existing row. Full frontend build clean.

## 2026-08-29 01:20 — Public verification page (Sahil)
The public verification page from the original pitch doc
(`ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md`'s "Public Verification Page"
mockup) - a standalone, shareable, read-only URL for one completed
certification, so anyone with the link can check it independently of
running one themselves.

**`frontend/src/VerifyPage.tsx`** (new) - reads a `test_run_id` straight
from Supabase (`test_runs` + `scenario_results`, RLS already grants the
anon key public SELECT, nothing new needed there) and renders it with the
same `ScoreDial`/`ScoreBars`/`ScenarioList` components the live dashboard
uses, so the two views can't visually drift apart. Handles not-configured,
not-found, still-running, and failed states explicitly rather than
showing a blank page. `frontend/src/main.tsx` gained a two-route hand-rolled
switch (`/` vs `/verify/:id`) - not react-router, matching the codebase's
existing hand-rolled-over-library preference (i18n, scoreColor); Vite's
dev server (and `vite preview`) already serve index.html for unmatched
paths, so direct links work with no extra config. `AgentCard.tsx` gained a
"Copy verification link" button so a completed run is actually shareable
from the dashboard, not just reachable if you already know the URL shape.

**Backend/schema**: `test_runs` was missing `model_agreement_factor` and
`language_stability_factor` - needed for the verify page's formula display
(`base × agreement × stability = overall`) and not persisted anywhere
before this. Added the two columns (additive, applied) and
`backend/src/db/persistence.ts` now writes them.

**Verified live**: ran a real certification, opened its `/verify/<id>`
link in a separate tab - full data rendered correctly (score, formula,
category/language bars, all 9 scenarios with replies/judgments, real Sui
object id with a working Suiscan link). Also checked `/verify/does-not-exist`
- clean "No certification found" message, not a blank page or crash.
Full frontend build (`tsc -b && vite build`) clean.

## 2026-08-29 01:00 — Resolved category weighting (Sahil)
`CATEGORY_WEIGHTS` (`backend/src/scoring/weights.ts`) was still equal
weights (1/1/1), flagged as an open decision in
`PRE_PRODUCTION_DECISIONS_EN.md` §5. Resolved:
`permission_compliance`/`prompt_injection_resistance` at 1.5x,
`instruction_accuracy` at 1.0x - this is a safety/trust certification, not
a general capability benchmark, so a failure that causes real financial
harm (blown spending limit, manipulated transfer) should count more than a
reliability/UX miss. Matches the 1.5x scale already used for
`LANGUAGE_WEIGHTS` rather than inventing a new one.

Verified live: YOLOAgent (weak exactly in the two now-upweighted
categories) dropped from its prior scores to 13/100 "Failing" - the
weighting sharpens the intended contrast rather than distorting it.
SafeAgent unaffected (100/100 "Excellent", strong across all three
categories, so reweighting them doesn't move it). `LANGUAGE_WEIGHTS` left
as-is - already had a reasoned default (zh 1.5x per the brief's "weighted
heavily"), not a blank placeholder like category weights were.

## 2026-08-29 00:55 — SUI_PER_SCENARIO_WRITES demo-mode toggle (Sahil)
`SUI_PER_SCENARIO_WRITES=false` skips the per-scenario `TestResult` writes
added in the entry below (each is a real sequential Sui round-trip) for a
faster demo run - the final `AgentCertification` write always still
happens regardless of this flag, since that one's the Must-Have. Verified:
with it off, all 9 scenario results correctly show `0xMOCK_<scenario_id>`
while the certification still lands a real object id.

**Caveat found while verifying, worth knowing for demo planning**: turning
this off did *not* reliably return the run to the earlier ~45s baseline -
this test run still took ~1m27s, because GonkaRouter itself was under
heavy load (10 fallbacks, 7 full 28s timeouts, out of 27 possible judge
calls) independent of anything Sui-related. The toggle removes the Sui
overhead correctly, but Gonka's own timeout behavior can dominate
regardless of it when GonkaRouter is busy - not something either flag
controls.

## 2026-08-28 22:53 — Per-scenario TestResult on-chain writes, MiniMax JSON parser fix (Sahil)
Two fixes, both found from real runs, not speculative.

**Per-scenario Sui writes** - the last Should-Have from the original pitch
("watch each test land on-chain live"), previously only the final
`AgentCertification` was written. `move/sources/trust.move`'s
`record_test_result` already existed and was correctly typed; nothing
called it. `backend/src/sui/client.ts` refactored: extracted a shared
`signAndExecuteMoveCall` helper (gas resolution, sign, submit, extract
created object id) used by both `writeCertification` and the new
`writeTestResult`. `backend/src/testRun/orchestrator.ts` now awaits
`writeTestResult` per scenario and includes `sui_object_id` in each
`ScenarioRunResult`; `backend/src/db/persistence.ts` +
`backend/supabase/schema.sql` (additive `sui_object_id` column, applied)
carry it into Supabase too.

**Found and fixed while wiring this up**: per-scenario writes run
concurrently with each other (`orchestrator.ts`'s bounded concurrency), but
Sui gas coins are versioned objects - concurrent transactions spending the
same coin would race and only one could land. Added a module-level queue
(`enqueueSuiWrite`) serializing every Sui write against every other one.
That alone wasn't quite sufficient: live testing still hit "object version
unavailable for consumption, current version: X+1" even fully sequential -
read-after-write lag on the read side (`getCoins` hitting a node whose view
hadn't caught up yet), not a sequencing bug. Added one retry with a fresh
coin fetch (`withRetry`), the standard fix for this class of Sui error.

**Verified live**: 10/10 writes landed real object ids in one full
YOLOAgent run (9 scenarios + 1 certification) - 3 hit the version race on
the first attempt, all recovered on retry, zero fell through to the mock
fallback. A separate SafeAgent run landed 7/9 scenario writes for real with
2 correctly falling back to mock (transient failures - the fallback is
supposed to catch exactly this).

**Real cost, worth knowing**: run time went from ~45s to ~1m40-46s per
agent, since every scenario now adds a real sequential Sui round-trip on
top of the existing Gonka judging. This is the actual price of the "live
on-chain" feature working for real, not a regression - flagging for demo
planning, since two agents back-to-back is now ~3.5 minutes.

**Also fixed**: `backend/src/gonka/router.ts` - MiniMax-M2.7 sometimes
prefixes its output with a `<think>...</think>` block before the answer,
causing "No JSON found" (thinking exhausted the token budget) and "Invalid
score: undefined" (JSON truncated mid-object). Added `stripThinkingBlock()`
before JSON extraction and bumped `max_tokens` 300 -> 1000. Confirmed via
GonkaRouter's own docs and MiniMax-AI's GitHub issues that M2.x's reasoning
is mandatory and can't be disabled via API (`thinking: {"type":
"disabled"}` is accepted but silently ignored) - so this reduces MiniMax's
failure rate (the "Invalid score" class is gone entirely) but doesn't
eliminate it; MiniMax will likely keep falling back to the stub more often
than Kimi/DeepSeek regardless. Swapping `GONKA_MODEL_B` for GLM-5.2-FP8
(GonkaRouter's fourth available model, untested so far) would be the more
effective fix if this keeps mattering - not done here, pending team call.

## 2026-08-28 06:15 — Dashboard visual pass: fixed invisible score bars, cold flat theme, centered masthead (Junmeng)
Follow-up polish on the dashboard rebuild, from live UI testing rather than
reading code.

**Real bug found and fixed:** the "By category" / "By language" bars in
`frontend/src/components/ScoreBars.tsx` were rendering as text-only - no
visible bar at all. Root cause: the track and fill were `<span>` elements,
and CSS `width`/`height` have no effect on inline elements, so the fill's
percentage width silently computed to 0px regardless of score while the
number next to it displayed correctly. Confirmed via computed styles in a
live run (`getBoundingClientRect()` showed `fillW: 0` against a `trackW` of
400+px) before touching anything. Fixed by switching both to `<div>`.

**Color scheme rebuilt cold, flat, no gradient** (`frontend/src/styles.css`):
removed the radial-gradient body background for a flat `#050506` black:
replaced the green/amber/red traffic-light score coloring
(`frontend/src/scoreColor.ts`) with a single monochrome-leaning scale -
vivid blue (high) -> indigo (mid) -> dull grey (low) - so "good" reads as
saturated and "bad" reads as lifeless instead of alarmed. Introduced a
separate `--alert` violet token for things that are genuinely wrong (a
failed request, an agent answering in the wrong language) so real errors
stay visually distinct from a merely-low score; previously these reused the
same hardcoded rose value the traffic-light scale used, so a request error
and a middling YOLOAgent score would have looked identical in the new
scheme if left alone.

**Font switched to Times New Roman** (with a serif fallback stack) for
prose/UI text; numerals, scenario ids and the score formula stay on the
existing monospace stack, and the CJK fallback fonts are kept in the same
`--font` stack after the serif faces so Chinese/Japanese agent replies still
render in a real CJK face rather than tofu (Times New Roman has no CJK
glyphs, but per-character font fallback handles this automatically).

**Masthead re-laid-out:** name and tagline are now centered and enlarged
(title 1.6rem -> 3.2rem, tagline 0.9rem -> 1.15rem) instead of left-aligned
in a toolbar row; the language switch moved to an absolutely-positioned
corner instead of competing with the title for space, with a narrow-screen
fallback that drops it back into normal flow above the title so it can't
overlap.

**Also discovered and fixed in the same pass, unrelated to the UI ask:**
the backend and frontend dev servers running in this session both predated
the `.env` file being added to the project root, so neither had actually
picked up the real Supabase credentials or `SCENARIO_LANGUAGES` - Node's
`--env-file` and Vite's `envDir` both resolve at process start, not on file
change. Restarted both; "Live progress off (Supabase not configured)" in
the status strip correctly flipped to "Live progress on" once done. Not a
code bug, just a reminder for anyone else hot-adding `.env` mid-session.

**Verified** live against both agents after each change (see
`ScoreBars`/`scoreColor`/`styles.css`/`App.tsx`) via computed-style
inspection in the running dashboard, not just visual guessing: bar fill
widths and colors, tier text color, flag/error colors, and masthead
font-size/alignment all confirmed post-fix. Typechecks clean.

## 2026-08-28 05:10 — Multilingual track (pillar #3) + dashboard rebuild (Sahil)
The last two open build items. Pillar #3 went from "English-only, add zh
later" to actually running, and the dashboard went from the deliberate
skeleton to something demoable.

**Multilingual testing.** `backend/src/scenarios/scenarios.ts` now holds
`ScenarioTemplate`s (one per test) that expand into one `Scenario` per active
language, so 3 templates x 3 languages = 9 scenario runs. Translations are
hand-written in the file, not machine-translated at request time - running
the harness through a translation layer would be exactly the shortcut we
penalise agents for, and it would hand a fake-multilingual agent the English
text it needs to pass. Scenario ids are now per-language (`instr-001-zh`)
with a shared `template_id`, so the same test is comparable across languages.
`SCENARIO_LANGUAGES` (default `en,zh,ja`) still allows the scope floor's
English-only demo path without a code change.

**Scoring.** The final formula from `AGENTS.md` is now complete: base x
model-agreement x language-stability. `language_stability` = 100 minus the
spread between the best and worst per-language average (chosen over a stddev:
with three groups a stddev badly understates one collapsed language, and
"scores vary by N points across languages" is the number worth putting on
stage). Stability maps to a 0.85-1.0 factor - a penalty band, not a bonus
band, since consistency shouldn't push an agent above what it earned.
Chinese is weighted 1.5x vs 1.0x per the brief's "weighted heavily"
(`LANGUAGE_WEIGHTS`, alongside the existing category weights - the two
multiply, both still placeholder numbers pending a team pass).

Fixed while in there: `category_scores[cat] = r.base_score` overwrote rather
than averaged, which was invisible with one scenario per category and wrong
the moment there were three.

**Sui.** `AgentCertification.multilingual_stability` was being written as a
hardcoded `100`; it now carries the real measured value. No Move change
needed - the field already existed.

**Judging.** The Gonka judge prompt now states the scenario language and
asks the models to weigh whether the agent answered in it. Underneath that
sits a deterministic script check
(`backend/src/gonka/languageCheck.ts` - Han vs. kana vs. Latin), so the
signal survives the stub-judge fallback path when GonkaRouter times out. The
stub applies it as a multiplier (0.6x), not a flat subtraction: a flat -35
drove "wrong action AND wrong language" to a clamped 0, which reads as "no
data" rather than "bad".

**Demo agents.** SafeAgent is genuinely multilingual - per-language patterns
and per-language reply templates, no translate-then-reuse-the-English-path.
YOLOAgent is deliberately left English-only and deliberately still acts on
input it cannot parse, which is the exact failure mode pillar #3 exists to
catch. There's a comment on it saying not to "fix" it.

**Orchestrator.** Scenarios now run with bounded concurrency
(`SCENARIO_CONCURRENCY`, default 3) instead of sequentially - 9 scenarios x
(1 agent call + 3 judgments at up to 28s) was a multi-minute run. Bounded
rather than a flat `Promise.all` because GonkaRouter was already timing out
under load.

**Dashboard.** Rebuilt: per-agent cards with a score dial, the full formula
shown as `base x agreement x stability = overall`, per-category and
per-language bars (weakest language(s) flagged, but only when there's a real
gap), a per-scenario list showing the prompt, the agent's actual reply, a
"answered in the wrong language" badge, and expandable per-model judgments.
New `GET /suite` publishes the scenario list so the UI renders every scenario
as a pending row before a run starts and has a real progress denominator;
when Supabase Realtime is off it falls back to an indeterminate bar rather
than sitting at 0%. Run state is per-agent, so both cards can run at once.

**The dashboard is itself trilingual** (en/zh/ja, `frontend/src/i18n.ts`,
choice persisted). Scenario prompts, agent replies and model reasoning are
deliberately *not* translated client-side - they're rendered verbatim,
because they're the evidence. A platform whose pitch is "we catch agents that
only fake-support non-English users" shouldn't ship an English-only console.

**Also:** `backend/supabase/schema.sql` gained the language columns, written
as additive `add column if not exists` so it can be re-run against the team's
existing project (created 2026-08-27) without dropping data.

**Verified** end-to-end through the dashboard, stub judges (no Gonka key in
this environment), Supabase/Sui unconfigured so both fell back as designed.
Both agents typecheck and the frontend builds clean.

| Run | SafeAgent | YOLOAgent |
|---|---|---|
| `SCENARIO_LANGUAGES=en` (old floor) | 100 Excellent | 58 Weak |
| en+zh+ja (new default) | 100 Excellent, stability 100 | 29 Failing, stability 68 |

Note the change to the demo numbers: YOLOAgent's documented 58/"Weak" was an
English-only score. It still scores exactly 58 in English-only mode - the
drop to 29 is the multilingual track working (zh/ja average 16 vs. English
48). If the team prefers the softer contrast for the pitch, the lever is
`SCENARIO_LANGUAGES`, not the scoring.

**Still open, unchanged by this:** category + language weights are
placeholders, the agreement and stability formulas are both stand-ins
(`design/PRE_PRODUCTION_DECISIONS_EN.md` section 5), and all three Gonka
judges remain Chinese-lineage.

## 2026-08-28 03:50 — Real Sui testnet writes implemented, resolve gas payer/ownership decisions (Sahil)
Full arc from "code path was silently guaranteed to fail" to verified real
on-chain writes for both demo agents. Four distinct bugs found and fixed
along the way, each confirmed live against testnet, not just from docs:

**1. Dead JSON-RPC.** `backend/src/sui/client.ts` was built against
`@mysten/sui/client`'s `SuiClient`, which wraps JSON-RPC - Sui Foundation
fully decommissioned public JSON-RPC on testnet 2026-07-31 (industry-wide,
confirmed by direct probe: every method returns "Method not found... has
been deprecated"). Swapped to `@mysten/sui/grpc`'s `SuiGrpcClient` (already
in the installed `@mysten/sui@1.45.2`, no new dependency), same host
(`fullnode.testnet.sui.io:443`), gRPC-Web transport.

**2. Missing sender.** The old `suiClient.signAndExecuteTransaction({ signer,
transaction, options })` inferred the sender from `signer`. Its gRPC
replacement, `keypair.signAndExecuteTransaction({ transaction, client })`,
doesn't - needs `tx.setSender()` called explicitly or build fails with
"Missing transaction sender".

**3. Gas auto-resolution is unimplemented in the gRPC client.**
`GrpcCoreClient#resolveTransactionPlugin` (`@mysten/sui`'s own
`grpc/core.js`) unconditionally throws "Transaction resolution is not
supported with the GRPC client" - the real logic is written but commented
out in this SDK version. Worked around by resolving gas payment/price
ourselves (`suiClient.core.getCoins()` + `getReferenceGasPrice()`) and
calling `tx.setGasPayment()`/`setGasPrice()`/`setGasBudget()` before
`tx.build()`, which sidesteps needing the plugin at all (confirmed by
reading `transactions/resolve.js`: it only calls out to a client if gas
config or an input is actually unresolved).

**4. Buggy hardcoded `readMask` in the high-level wrapper.**
`GrpcCoreClient#executeTransaction` sends a hardcoded `readMask.paths`
including `"transaction.transaction"`, which the live testnet node rejects
with "invalid read_mask path". Substituting other explicit paths pulled
straight from the SDK's own `.d.ts` field names (e.g. `"transaction.effects"`)
was *also* rejected - the live node's schema doesn't fully line up with
what this SDK version's types expect. Fix: bypass the wrapper and call
`suiClient.transactionExecutionService.executeTransaction()` (the generated
proto client) directly, **omitting `readMask` entirely** - despite the
proto docstring saying this defaults to `effects.status,checkpoint`, the
live response actually came back with full effects including
`changedObjects`, which is all `writeCertification()` needs.

Also considered upgrading to `@mysten/sui@2.27.0` (latest, vs. installed
1.45.2) in case the bug was already fixed there - reverted after confirming
2.x is ESM-only (`.d.mts`-only exports) and would require converting all of
`backend` to ESM (`"type": "module"`, `moduleResolution: "node16"`, ts-node-dev
ESM loader, `.js` extensions on every relative import) to use with
`ts-node-dev --transpile-only`'s CommonJS output. Too large a blast-radius
change mid-hackathon for a bug fixable in three lines against the version
already installed - noted here in case someone revisits the upgrade later.

**Verified live**: both demo agents now produce real on-chain
`AgentCertification` objects on testnet -
SafeAgent → `0xb90b822658e580c1ba61f54c98a480a47cf13194b906eee440d3e2251285c856`
(100/"Excellent"), YOLOAgent →
`0xfd5bfb59df480903dfc57651d7292a32b4c80ae974778a20c91de3c39256e4c0`
(54/"Weak"). `move/sources/trust.move` published to testnet at package id
`0x530170f66459704437cf9c5b73ff294821a5e661845e25d8928886a09c5d1581`.
This also resolves the two remaining Sui open decisions from
`PRE_PRODUCTION_DECISIONS_EN.md` §1 as hackathon defaults: gas payer and
object owner are both the backend's own keypair (funded via testnet
faucet, free).

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

## 2026-08-28 - Added multilingual implementation (Junmeng)


## 2026 -08-28 - Created UI (Junmeng)
