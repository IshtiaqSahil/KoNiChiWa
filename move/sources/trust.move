// Skeleton - not yet published (needs the Sui CLI to run `sui client
// publish`; see design/IMPLEMENTATION_NOTES_EN.md "Testnet Sui setup").
// Struct fields mirror design/prithvi_idea.txt and
// design/ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md's schema sketch.
//
// Resolved (design/PRE_PRODUCTION_DECISIONS_EN.md section 1):
//   - Gas payer: testnet SUI is free via faucet, so "who pays" has no real
//     cost either way. The backend's own keypair (SUI_PUBLISHER_PRIVATE_KEY)
//     pays, funded by `sui client faucet`.
//   - Object ownership: defaulted to "the test engine's own address" (both
//     structs transfer to whatever `recipient` the caller passes, and the
//     backend passes its own address) so the hackathon floor doesn't block
//     on a real agent-owner-wallet flow, which is out of scope anyway
//     (wallet integration was cut - see design/TECH_STACK_EN.md
//     "Corrections" #3). Revisit if the team decides certifications should
//     transfer to the agent developer's own address instead.
//
// Correction: `agent_id` was originally typed `address` and `test_run_id`
// was `u64`, but neither the backend nor the demo agents have a real Sui
// address per agent (no wallet integration - see above) or a numeric run
// id (`backend/src/testRun/orchestrator.ts` generates ids like
// "run_<uuid>"). Both are just opaque identifier strings in this scope, so
// both fields are `String` here instead - the original types would have
// been unusable from the backend's actual data.
module konichiwa::trust {
    use std::string::String;
    use std::vector;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// One scored scenario run against a candidate agent.
    public struct TestResult has key, store {
        id: UID,
        agent_id: String,
        test_run_id: String,
        test_type: String,
        score: u8,
        timestamp: u64,
        gonka_request_id: String,
        models_used: vector<String>,
        model_agreement: u8,
    }

    /// Aggregate certification for one agent's test run.
    public struct AgentCertification has key, store {
        id: UID,
        agent_id: String,
        overall_score: u8,
        final_status: String,
        certified_at: u64,
        expires_at: u64,
        multilingual_stability: u8,
    }

    /// `recipient` is the test engine's own address for now (see module
    /// doc above) - not a real per-agent-owner wallet.
    public entry fun record_test_result(
        agent_id: String,
        test_run_id: String,
        test_type: String,
        score: u8,
        gonka_request_id: String,
        models_used: vector<String>,
        model_agreement: u8,
        timestamp: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let result = TestResult {
            id: object::new(ctx),
            agent_id,
            test_run_id,
            test_type,
            score,
            timestamp,
            gonka_request_id,
            models_used,
            model_agreement,
        };
        transfer::transfer(result, recipient);
    }

    public entry fun issue_certification(
        agent_id: String,
        overall_score: u8,
        final_status: String,
        certified_at: u64,
        expires_at: u64,
        multilingual_stability: u8,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let cert = AgentCertification {
            id: object::new(ctx),
            agent_id,
            overall_score,
            final_status,
            certified_at,
            expires_at,
            multilingual_stability,
        };
        transfer::transfer(cert, recipient);
    }
}
