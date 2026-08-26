# KoNiChiWa — Team Brief for AI Agents

Read this file first. It applies to every AI coding agent working in this
repo (Claude Code, Cursor, Copilot, etc.), regardless of which team member
is driving.

## Team

4 people building this together for the hackathon. If you are an AI agent
working on behalf of one teammate, assume the other three are doing the
same in parallel — coordinate through this repo, not tribal knowledge.

## The Idea

Summary below (the full detailed proposal doc is kept locally, not in
this repo — ask a teammate if you need it).

We're building an AI Agent Trust/Certification
platform that evaluates candidate AI agents (e.g. payment/DeFi agents) for
safety and reliability, then records the results on-chain. Three pillars:

1. **Sui** — every individual test result is written as its own on-chain
   object the moment it completes (sub-second finality), so certification
   progress is visible live instead of only at the end, and results can't
   be altered after the fact.
2. **Gonka** — each test scenario is judged in parallel by three different
   models (Kimi-K2.6, MiniMax, a Chinese-optimized model). Cross-model
   agreement becomes a trust signal on its own: high agreement = high
   confidence, low agreement = flag for review.
3. **Multilingual testing** — every scenario runs in English, Chinese, and
   Japanese, with Chinese weighted heavily because its complexity best
   exposes agents that only fake-support non-English users (e.g. via a
   thin translation layer). Score variance across languages becomes a
   "multilingual stability" metric.

Final trust score = base score (avg across models) × model-agreement
factor × language-stability factor, all backed by an immutable Sui
certification object. See the full doc for the Sui object schema, scoring
formula, architecture diagram, and demo scripts.

## Working agreement

- **Document every change in [`CHANGELOG.md`](./CHANGELOG.md).** One file,
  newest entry on top. Before you start work, skim it to see what
  changed since you last looked. When you finish a change — code, docs,
  design decisions, anything non-trivial — add an entry: what changed,
  why, and who/which agent made it. This is how four parallel
  agents+humans stay in sync without stepping on each other.
- Keep this file (`AGENTS.md`) as the entry point. If the idea evolves,
  update the summary here too, not just the detailed doc.
