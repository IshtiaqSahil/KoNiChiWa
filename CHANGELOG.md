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

## 2026-08-27 15:30 — Repo skeleton scaffolded (Claude Code)
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
