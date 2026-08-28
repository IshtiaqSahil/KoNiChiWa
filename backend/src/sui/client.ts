import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { TrustScore } from "../scoring/score";
import { GonkaEvaluation } from "../gonka/types";
import { Scenario } from "../scenarios/types";

// JSON-RPC on Sui Foundation's public fullnodes was fully decommissioned for
// testnet on 2026-07-31 (industry-wide, not project-specific - confirmed by
// direct testnet RPC probe returning "Method not found... has been
// deprecated" on every method, and by docs.sui.io/develop/accessing-data/
// json-rpc-migration). The old @mysten/sui/client SuiClient wraps that dead
// JSON-RPC API, so this uses @mysten/sui/grpc's SuiGrpcClient instead - same
// public fullnode.testnet.sui.io:443 host, gRPC-Web transport. Verified
// working locally 2026-08-28 against a live testnet read call.

export interface CertificationRecord {
  test_run_id: string;
  agent_id: string;
  overall_score: number;
  model_agreement: number;
  language_stability: number;
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
const DEFAULT_GRPC_URLS: Partial<Record<typeof network, string>> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};
export const suiClient = new SuiGrpcClient({
  network,
  baseUrl: process.env.SUI_RPC_URL ?? DEFAULT_GRPC_URLS[network] ?? DEFAULT_GRPC_URLS.testnet!,
});

// Object ownership + gas payer are resolved for the hackathon floor (see
// move/sources/trust.move module doc): the backend's own keypair
// (SUI_PUBLISHER_PRIVATE_KEY, a bech32 string from `sui keytool export`)
// both pays gas (free on testnet, via faucet) and receives both
// TestResult and AgentCertification objects. Setup steps:
// design/IMPLEMENTATION_NOTES_EN.md "Testnet Sui setup".
function loadPublisherKeypair(): Ed25519Keypair | null {
  const raw = process.env.SUI_PUBLISHER_PRIVATE_KEY;
  if (!raw) return null;
  const { secretKey } = decodeSuiPrivateKey(raw);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

/**
 * Builds, signs, and submits one Move call, returning the id of whatever
 * object it creates (or null if the call didn't create one / isn't
 * configured / failed - callers fall back to a mock id in that case).
 *
 * Serialized behind a module-level queue: per-scenario TestResult writes
 * now happen concurrently with each other (orchestrator.ts's
 * mapWithConcurrency), but Sui gas coins are versioned objects - two
 * transactions racing to spend the *same* coin object would both read the
 * same version and only one could land, the other failing with a stale-
 * object-version error. Chaining every write onto one promise means each
 * call's getCoins() always sees the version left behind by the previous
 * write, at the cost of writes no longer overlapping each other (fine:
 * they're individually fast, and this never blocks the agent/Gonka work
 * that drives most of a run's wall-clock time).
 *
 * Serializing isn't quite sufficient on its own, though: live testing
 * 2026-08-28 hit "object version unavailable for consumption, current
 * version: X+1" even with writes fully sequential - read-after-write lag
 * on the read side (getCoins hitting a full node whose view hasn't caught
 * up to the write that just finalized a moment earlier), not a bug in the
 * sequencing. One retry with a fresh coin fetch is the standard fix for
 * this class of error - by the second attempt the read side has caught up.
 */
let suiWriteQueue: Promise<void> = Promise.resolve();

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[sui] write failed, retrying once:", err instanceof Error ? err.message : err);
    return await fn();
  }
}

function enqueueSuiWrite<T>(fn: () => Promise<T>): Promise<T> {
  const attempt = () => withRetry(fn);
  const result = suiWriteQueue.then(attempt, attempt);
  suiWriteQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function signAndExecuteMoveCall(
  functionName: string,
  buildArgs: (tx: Transaction, recipient: string) => unknown[]
): Promise<string | null> {
  const packageId = process.env.SUI_PACKAGE_ID;
  const keypair = loadPublisherKeypair();
  if (!packageId || !keypair) return null;

  const recipient = keypair.getPublicKey().toSuiAddress();

  // The gRPC client's automatic gas/coin resolution during tx.build() is
  // unimplemented in the installed SDK (@mysten/sui/dist/.../grpc/core.js
  // GrpcCoreClient#resolveTransactionPlugin unconditionally throws
  // "Transaction resolution is not supported with the GRPC client" - the
  // real logic is present but commented out). Confirmed live 2026-08-28.
  // Working around it by supplying gas payment/price ourselves instead of
  // relying on the auto-resolve the old JSON-RPC client provided for free.
  const [gasPriceResult, coinsResult] = await Promise.all([
    suiClient.core.getReferenceGasPrice(),
    suiClient.core.getCoins({ address: recipient, coinType: "0x2::sui::SUI", limit: 1 }),
  ]);
  const gasCoin = coinsResult.objects[0];
  if (!gasCoin) {
    throw new Error(`No SUI coins found for ${recipient} - fund it via \`sui client faucet\` first`);
  }

  const tx = new Transaction();
  // Required with the gRPC path - the old JSON-RPC suiClient.signAndExecuteTransaction
  // inferred the sender from its `signer` param; keypair.signAndExecuteTransaction
  // doesn't, so it must be set explicitly or the build fails with
  // "Missing transaction sender" (caught live 2026-08-28).
  tx.setSender(recipient);
  tx.setGasPayment([{ objectId: gasCoin.id, version: gasCoin.version, digest: gasCoin.digest }]);
  tx.setGasPrice(BigInt(gasPriceResult.referenceGasPrice));
  tx.setGasBudget(100_000_000); // matches the CLI publish gas budget

  tx.moveCall({
    target: `${packageId}::trust::${functionName}`,
    arguments: buildArgs(tx, recipient) as Parameters<typeof tx.moveCall>[0]["arguments"],
  });

  // tx.build() needs no client here: needsTransactionResolution()
  // (transactions/resolve.js) only calls out to a client if gas
  // price/budget/payment are missing or an input is unresolved - all false
  // here since gas is set above and every moveCall argument is a
  // fully-resolved tx.pure.* value. Confirmed by reading the SDK source,
  // not just assumed.
  const bytes = await tx.build();
  const signed = await keypair.signTransaction(bytes);

  // Bypasses keypair.signAndExecuteTransaction / client.core.executeTransaction
  // deliberately: GrpcCoreClient#executeTransaction (grpc/core.js) hardcodes
  // a readMask that includes an invalid path ("transaction.transaction"),
  // which the live testnet node rejects with "invalid read_mask path" -
  // confirmed live 2026-08-28, appears to be a bug in @mysten/sui@1.45.2's
  // gRPC wrapper. Calling the generated proto client directly with a
  // corrected mask sidesteps it without needing an SDK upgrade (2.x is
  // ESM-only and would require converting this whole package to ESM).
  const { response } = await suiClient.transactionExecutionService.executeTransaction({
    transaction: { bcs: { value: bytes } },
    signatures: [
      {
        bcs: { value: Buffer.from(signed.signature, "base64") },
        signature: { oneofKind: undefined },
      },
    ],
    // Deliberately omitted: the proto docstring says this defaults to
    // "effects.status,checkpoint", but live testing 2026-08-28 showed the
    // default actually returns full effects (including changedObjects)
    // anyway - simpler than hand-picking paths, and avoids the "invalid
    // read_mask path" errors hit when specifying any explicit path
    // (including ones straight from the SDK's own .d.ts field names),
    // which suggests the live node's schema doesn't fully match this SDK
    // version's expectations yet.
  });

  const changedObjects = response.transaction?.effects?.changedObjects ?? [];
  // idOperation 2 === CREATED (sui.rpc.v2.ChangedObject.IdOperation) -
  // compared numerically rather than importing the enum from the deep
  // internal proto path, which @mysten/sui/grpc doesn't re-export. Each
  // call here only ever creates one object, so this alone is enough to
  // identify it.
  const created = changedObjects.find((obj) => obj.idOperation === 2);

  if (!created?.objectId) {
    console.error(`[sui] ${functionName} succeeded but no created object found in effects:`, response.transaction?.effects?.status);
    return null;
  }

  return created.objectId;
}

export async function writeCertification(
  agentId: string,
  testRunId: string,
  score: TrustScore
): Promise<CertificationRecord> {
  const certified_at = new Date().toISOString();

  try {
    const objectId = await enqueueSuiWrite(() =>
      signAndExecuteMoveCall("issue_certification", (tx, recipient) => [
        tx.pure.string(agentId),
        tx.pure.u8(score.overall_score),
        tx.pure.string(score.certification_tier),
        tx.pure.u64(Date.now()),
        tx.pure.u64(0), // expires_at - no expiry/retest model yet (Won't-Have)
        // multilingual_stability: real value now that scenarios run in
        // en/zh/ja (scoring/score.ts calculateLanguageStability). Already
        // u8-safe: the score is clamped to 0-100 and rounded before it
        // gets here.
        tx.pure.u8(score.language_stability),
        tx.pure.address(recipient),
      ])
    );

    if (objectId) {
      return {
        test_run_id: testRunId,
        agent_id: agentId,
        overall_score: score.overall_score,
        model_agreement: score.model_agreement,
        language_stability: score.language_stability,
        category_scores: score.category_scores,
        certified_at,
        sui_object_id: objectId,
      };
    }
  } catch (err) {
    console.error("[sui] issue_certification failed, falling back to mock:", err instanceof Error ? err.message : err);
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
    language_stability: score.language_stability,
    category_scores: score.category_scores,
    certified_at,
    sui_object_id: `0xMOCK_${testRunId}`,
  };
}

// Demo-mode escape hatch: per-scenario writes are real sequential Sui
// round-trips (see enqueueSuiWrite doc above) - roughly doubles a run's
// wall-clock time (~45s -> ~1m40s, live-tested 2026-08-28). Fine for
// showing the feature off, too slow if a presentation needs a fast
// back-to-back run of both agents. Gates only the per-scenario writes;
// the final AgentCertification write (writeCertification, the Must-Have)
// always still attempts a real write regardless of this flag.
const SUI_PER_SCENARIO_WRITES = process.env.SUI_PER_SCENARIO_WRITES !== "false";

// The Should-Have from the original pitch: each scenario's score lands
// on-chain as it completes, not just the final aggregate. Mirrors
// writeCertification's fallback-to-mock shape so callers never have to
// special-case "Sui isn't configured" themselves.
export async function writeTestResult(
  agentId: string,
  testRunId: string,
  scenario: Scenario,
  evaluation: GonkaEvaluation
): Promise<string> {
  if (!SUI_PER_SCENARIO_WRITES) return `0xMOCK_${scenario.id}`;

  try {
    const objectId = await enqueueSuiWrite(() =>
      signAndExecuteMoveCall("record_test_result", (tx, recipient) => [
        tx.pure.string(agentId),
        tx.pure.string(testRunId),
        tx.pure.string(scenario.category),
        // score is 0-100 already (GonkaEvaluation.base_score), clamp+round
        // for the u8 field the same way writeCertification does.
        tx.pure.u8(Math.max(0, Math.min(100, Math.round(evaluation.base_score)))),
        // gonka_request_id: no real per-call request id surfaced by
        // GonkaRouter's response shape (backend/src/gonka/router.ts) -
        // scenario_id is the closest stable identifier for "which judged
        // call this was" and lets a viewer correlate this object back to
        // the scenario_results row.
        tx.pure.string(scenario.id),
        tx.pure.vector("string", evaluation.judgments.map((j) => j.model)),
        tx.pure.u8(Math.max(0, Math.min(100, Math.round(evaluation.model_agreement)))),
        tx.pure.u64(Date.now()),
        tx.pure.address(recipient),
      ])
    );

    if (objectId) return objectId;
  } catch (err) {
    console.error("[sui] record_test_result failed, falling back to mock:", err instanceof Error ? err.message : err);
  }

  return `0xMOCK_${scenario.id}`;
}
