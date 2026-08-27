# Pre-Production Decision Checklist
## Ultimate AI Agent Trust Platform

Before moving into implementation, these are the open decisions across 10 areas. Each item includes a recommended default where applicable, flagged by how urgently it needs a decision.

---

## 🔷 1. Sui Design

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Network | Testnet (not a production deployment) | Confirm |
| Language | Move | ✅ Fixed |
| On-chain vs off-chain | Only scores, hashes, and metadata go on-chain. Detailed reasoning logs stay off-chain (IPFS or DB) with only a hash recorded on-chain | Confirm |
| Gas cost model | ~~Who pays~~ → **Resolved**: testnet SUI is free via faucet, so there's no real cost either way. The backend's own keypair pays, funded by `sui client faucet`. See `design/IMPLEMENTATION_NOTES_EN.md` "Testnet Sui setup." | ✅ Resolved |
| Wallet integration | ~~Sui Wallet Standard (`@mysten/dapp-kit`)~~ → **cut**, not needed (see `TECH_STACK_EN.md` "Corrections" #3) | ✅ Resolved |
| Object ownership | ~~Is `TestResult` owned by the test engine? Is `AgentCertification` transferred to the agent owner?~~ → **Defaulted**: both are transferred to the test engine's own address for the hackathon floor (no real agent-owner wallet exists, since wallet integration was cut). Revisit if the team wants certifications transferred to agent developers later. | 🟡 Defaulted, not team-confirmed |

---

## 🔶 2. Gonka Design

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Models to use | Kimi-K2.6 + MiniMax + a Chinese-strong model (**need to verify actual model names available on Gonka Router**) | **Needs verification** |
| Parallel execution | `Promise.all` to fire requests to all models simultaneously | ✅ Fixed |
| Timeout strategy | 15 seconds per model; anything over that is treated as "no response" and excluded from scoring | Confirm |
| Retry policy | Up to 3 retries with exponential backoff | Confirm |
| Cost management | Need to estimate per-certification cost (test count × language count × model count) | **Needs estimate** |

---

## 🔷 3. Test Engine Design

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Number of scenarios | 3-5 scenarios per category × 9 categories ≈ 30-40 scenarios total | **Decision needed** |
| Normal : Adversarial ratio | Roughly 6:4 (sufficient adversarial coverage) | Confirm |
| Scenario authoring | Hand-write core scenarios, then generate variations with AI assistance | Confirm |
| **Agent connection interface** | How does the platform actually talk to a candidate agent? REST API? Webhook? A standard protocol? | **Highest priority — decision needed** |
| Agent authentication | API key? OAuth? | Decision needed |

---

## 🌐 4. Multilingual Strategy

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Target languages | English, Chinese, and Japanese — confirmed as final set? | **Confirm** |
| Scenario translation | AI translation with human review for native-level quality | Confirm |
| Cultural context | Should scenarios reflect language-specific fraud/scam patterns rather than literal translation? (ambitious option) | Confirm |

---

## 📊 5. Scoring Logic

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Category weights | Weighting across the 9 categories (e.g., weight Permission Compliance most heavily) | **Decision needed** |
| Agreement formula | Standard deviation based, or variance based? | Decision needed |
| Certification thresholds | 90-100 / 75-89 / 60-74 / 40-59 / 0-39 (keep as in original Prithvi proposal?) | Confirm |
| Retest trigger conditions | What version-change conditions automatically flag "RETEST REQUIRED"? | Decision needed |

---

## 🤖 6. Demo Agents

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Build vs use existing OSS | Build in-house (simple LangChain implementation) | Confirm |
| SafeAgent implementation | Solid system prompt + validation layer | Confirm |
| YOLOAgent implementation | Deliberately vulnerable (minimal system prompt) | Confirm |
| Wallet operations | Real Sui testnet transactions, or mocked? | **Decision needed** |

---

## 🛠️ 7. Technology Stack

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Frontend | React + TypeScript | Per earlier discussion |
| Backend | Node.js + Express | Per earlier discussion |
| Real-time communication | WebSocket (Socket.io) | **Decision needed** |
| Sui SDK | `@mysten/sui.js` | ✅ Fixed |
| Off-chain database | PostgreSQL or MongoDB | Confirm |

---

## 🎨 8. UI/UX

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Dashboard | Real-time progress display (as in the Prithvi proposal) | Confirm |
| Public verification page | Per-agent shareable URL | Confirm |
| Design direction | What tone — fintech-style, blockchain-native style, something else? | Confirm |

---

## 👥 9. Team Structure

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Role division | Sui lead / Gonka lead / Frontend lead | **Depends on team size and skillset** |

---

## 🎯 10. Scope Definition

| Topic | Recommended Default | Needs Confirmation? |
|---|---|---|
| Must-have | Sui recording, Gonka multi-model, basic UI, single-language support is acceptable as a floor | **Decision needed** |
| Nice-to-have | Full multilingual support, real-time dashboard, polished UI | Confirm |
| Submission deadline | When is the hackathon deadline? | **Confirm** |

---

## Summary of Highest-Priority Open Items

These items block downstream design work and should be resolved first:

1. **Actual Gonka model availability** — confirm real model names/IDs on Gonka Router, especially the Chinese-strong model
2. **Category weighting formula** — needed before scoring logic can be implemented
3. **Scope floor (must-have vs nice-to-have)** — needed to sequence implementation
4. **Submission deadline** — needed to plan backward

Resolved since this list was first written: agent connection interface
(REST/JSON, see `AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md`), Sui gas cost
model and object ownership (see above — testnet faucet + test-engine-owns
default), wallet operations in demo (cut entirely, mocked by design).

---

**Last updated:** August 27, 2026
