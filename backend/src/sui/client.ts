import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
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

// Read-only network handle - safe to construct regardless of the open
// decisions below, since it doesn't sign or send anything. Lets any
// read-side work (e.g. verifying an object once one exists, or a future
// "check package is published" health check) start now instead of waiting
// on the write-path decisions.
const network = (process.env.SUI_NETWORK as "testnet" | "mainnet" | "devnet" | "localnet") ?? "testnet";
export const suiClient = new SuiClient({
  url: process.env.SUI_RPC_URL ?? getFullnodeUrl(network),
});

// Object ownership + gas payer are resolved for the hackathon floor (see
// move/sources/trust.move module doc): the backend's own keypair
// (SUI_PUBLISHER_PRIVATE_KEY, a bech32 string from `sui keytool export`)
// both pays gas (free on testnet, via faucet) and receives the
// AgentCertification object. Setup steps: design/IMPLEMENTATION_NOTES_EN.md
// "Testnet Sui setup".
function loadPublisherKeypair(): Ed25519Keypair | null {
  const raw = process.env.SUI_PUBLISHER_PRIVATE_KEY;
  if (!raw) return null;
  const { secretKey } = decodeSuiPrivateKey(raw);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// Per-test TestResult writes (record_test_result) are a Should-Have (see
// design/SCOPE_FLOOR_PROPOSAL_EN.md) and not wired up here - only the
// Must-Have final AgentCertification write.
export async function writeCertification(
  agentId: string,
  testRunId: string,
  score: TrustScore
): Promise<CertificationRecord> {
  const certified_at = new Date().toISOString();
  const packageId = process.env.SUI_PACKAGE_ID;
  const keypair = loadPublisherKeypair();

  if (packageId && keypair) {
    try {
      const recipient = keypair.getPublicKey().toSuiAddress();
      const tx = new Transaction();

      tx.moveCall({
        target: `${packageId}::trust::issue_certification`,
        arguments: [
          tx.pure.string(agentId),
          tx.pure.u8(score.overall_score),
          tx.pure.string(score.certification_tier),
          tx.pure.u64(Date.now()),
          tx.pure.u64(0), // expires_at - no expiry/retest model yet (Won't-Have)
          tx.pure.u8(100), // multilingual_stability - unused until multilingual scenarios exist (English-only floor)
          tx.pure.address(recipient),
        ],
      });

      const result = await suiClient.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showObjectChanges: true },
      });

      const created = result.objectChanges?.find(
        (change) =>
          change.type === "created" && change.objectType.endsWith("::trust::AgentCertification")
      );

      if (created && "objectId" in created) {
        return {
          test_run_id: testRunId,
          agent_id: agentId,
          overall_score: score.overall_score,
          model_agreement: score.model_agreement,
          category_scores: score.category_scores,
          certified_at,
          sui_object_id: created.objectId,
        };
      }

      console.error("[sui] issue_certification succeeded but no AgentCertification object found in effects");
    } catch (err) {
      console.error("[sui] on-chain write failed, falling back to mock:", err instanceof Error ? err.message : err);
    }
  }

  // Fallback: SUI_PACKAGE_ID/SUI_PUBLISHER_PRIVATE_KEY not set (package not
  // published or keypair not configured yet), or the write above failed.
  // Keeps the rest of the pipeline (scoring -> dashboard) demoable without
  // a live testnet dependency.
  return {
    test_run_id: testRunId,
    agent_id: agentId,
    overall_score: score.overall_score,
    model_agreement: score.model_agreement,
    category_scores: score.category_scores,
    certified_at,
    sui_object_id: `0xMOCK_${testRunId}`,
  };
}
