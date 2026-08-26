import { TrustScore } from "../scoring/score";

export interface CertificationRecord {
  test_run_id: string;
  agent_id: string;
  overall_score: number;
  model_agreement: number;
  category_scores: Record<string, number>;
  certified_at: string;
  // null until a real Sui write happens - see TODO below.
  sui_object_id: string | null;
}

// TODO: real Sui integration is blocked on two open decisions
// (design/PRE_PRODUCTION_DECISIONS_EN.md section 1):
//   1. Object ownership model - who owns TestResult, who receives
//      AgentCertification (the test engine? transferred to the agent
//      owner's address?).
//   2. Gas payer - the platform's key (SUI_PUBLISHER_PRIVATE_KEY in
//      .env.example) or a sponsored-transaction flow.
// Once resolved, this becomes an @mysten/sui.js call that publishes a
// TestResult object per scenario (or at minimum one AgentCertification
// object per run, per the Must-Have floor) against the package id in
// move/sources/trust.move. For now it mocks a Sui object id so the rest
// of the pipeline (scoring -> dashboard) can be built and demoed against
// a stable shape.
export async function writeCertification(
  agentId: string,
  testRunId: string,
  score: TrustScore
): Promise<CertificationRecord> {
  const mockObjectId = `0xMOCK_${testRunId}`;

  return {
    test_run_id: testRunId,
    agent_id: agentId,
    overall_score: score.overall_score,
    model_agreement: score.model_agreement,
    category_scores: score.category_scores,
    certified_at: new Date().toISOString(),
    sui_object_id: mockObjectId,
  };
}
