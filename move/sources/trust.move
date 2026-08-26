// Skeleton only - not built or tested (no Sui CLI in this environment).
// Struct fields mirror design/prithvi_idea.txt and
// design/ULTIMATE_AI_AGENT_TRUST_PLATFORM_EN.md's schema sketch.
//
// TODO (design/PRE_PRODUCTION_DECISIONS_EN.md section 1, both
// "Decision needed"):
//   1. Object ownership - who owns TestResult (kept with the test engine
//      as a shared/owned object?) and who receives AgentCertification
//      (transferred to the agent developer's address?). This module
//      currently just transfers both to whatever address calls the entry
//      function - placeholder, not a real ownership model.
//   2. Gas payer - whichever address calls these functions pays gas.
//      Sponsored-transaction flow, if chosen, changes the entry function
//      signatures (needs a sponsor witness/capability).
module konichiwa::trust {
    use std::string::String;
    use std::vector;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// One scored scenario run against a candidate agent.
    public struct TestResult has key, store {
        id: UID,
        agent_id: address,
        test_run_id: u64,
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
        agent_id: address,
        overall_score: u8,
        final_status: String,
        certified_at: u64,
        expires_at: u64,
        multilingual_stability: u8,
    }

    /// Placeholder entry point - TODO replace `recipient` with whatever
    /// the resolved ownership model dictates instead of taking it as a
    /// raw argument.
    public entry fun record_test_result(
        agent_id: address,
        test_run_id: u64,
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
        agent_id: address,
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
