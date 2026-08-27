# Scope Floor Proposal — Hackathon MVP

Draft for team discussion. Goal: pick the smallest scope that still sells
the three-pillar pitch (Sui / Gonka / multilingual) live to judges, so we
can start building instead of designing.

---

## Must-Have (no demo without these)

1. **Two demo agents** — SafeAgent (solid system prompt + validation) and
   YOLOAgent (deliberately weak). Simple LangChain wrappers, no real
   wallet integration needed.
2. **~10 scenarios, 3 categories** — Instruction Accuracy, Permission
   Compliance, Prompt-Injection Resistance. These three tell the clearest
   pass/fail story and cover the "safe vs unsafe" contrast.
3. **Gonka 3-model parallel evaluation** — this is the core differentiator
   (#2 of 3 pillars). Cutting it guts the pitch. Real model IDs on Gonka
   Router need confirming this week regardless of scope.
4. **Sui on-chain certification** — at minimum, one `AgentCertification`
   object per test run, written after scoring completes. This is the
   other core differentiator; can't be cut.
5. **English only** for the live demo path. Multilingual is pillar #3 but
   can be demonstrated as a secondary flow (see Should-Have) rather than
   running through every scenario.
6. **Minimal dashboard** — shows scores per category, model agreement %,
   and a link to the Sui explorer for the certification object. Static
   refresh is fine; doesn't need to be real-time.

## Should-Have (cut top-down if time runs short, in this order)

1. **Per-test Sui writes** (not just the final object) — this is what
   makes "real-time" visible instead of asserted. Upgrade from Must-Have
   #4 if time allows; it's the single highest-leverage demo moment.
2. **Chinese as a second language** — run the same 10 scenarios once more
   in Chinese, show the score delta live. Proves pillar #3 without needing
   Japanese too.
3. **WebSocket live dashboard** — replace static refresh with the
   test-in-progress view described in the proposal doc.
4. **Remaining 6 test categories** (Transaction Accuracy, Hallucination
   Resistance, Ambiguity Handling, Risk Awareness, Unauthorized Action
   Resistance, Consistency) — adds depth but not narrative.

## Won't-Have (explicitly out of scope for this hackathon)

- Japanese language track
- Real Sui testnet wallet transactions (mock the agent's wallet actions)
- Certification expiration / retest-on-version-change logic
- On-chain access-control integration ("wallets only accept score ≥ 90")
- CI/CD-triggered re-certification
- Agent registration/auth flow beyond a hardcoded endpoint for the two
  demo agents

---

## Why this floor

The demo narrative that sells itself is: *same test, two agents, wildly
different scores, and you can click through to prove it's on-chain.* That
only needs one language, 3 categories, and a final (not per-test) Sui
write. Everything in Should-Have makes the demo more impressive but isn't
load-bearing — if we're out of time on the last day, we still have a
complete, honest demo without them.

## Open items this doesn't resolve

Still need answers on: agent connection interface (protocol/auth),
Sui object ownership model, who pays gas, actual Gonka model names, and
the submission deadline itself — see
`PRE_PRODUCTION_DECISIONS_EN.md` for the full list.
