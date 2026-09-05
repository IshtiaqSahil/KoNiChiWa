// Real integration against Walrus (https://docs.wal.app) - decentralized
// blob storage, one of the "Helpful Sui Features" named for MUBA Hacks
// Track 02 (AI x Sui). Stores the full per-model reasoning trace for a test
// run - today that text only lives in Supabase, off-chain and mutable; a
// Walrus blob gives it a content-addressed, independently-fetchable copy
// that isn't just "our server's word for it", which is the same
// transparency argument the platform already makes for Sui.
//
// Live-verified 2026-09-04: PUT https://publisher.walrus-testnet.walrus.space/v1/blobs
// with a small JSON body returned a real blobId, and GET
// https://aggregator.walrus-testnet.walrus.space/v1/blobs/<id> round-tripped
// the exact content back. Endpoints and request/response shape confirmed
// against https://docs.wal.app/docs/http-api/storing-blobs, not guessed.
//
// Best-effort, same degrade-gracefully pattern as sui/client.ts and
// gonka/router.ts: a missing/unreachable Walrus never breaks a test run,
// it just means no blob id for that run.
const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL ?? "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL ?? "https://aggregator.walrus-testnet.walrus.space";

// Testnet epoch length is documented as 1 day in some places and 2 in
// others (docs disagree/have changed across testnet redeployments) - 5
// epochs is a "survives the hackathon judging window" guess, not a
// permanence guarantee. Configurable since the real figure matters once
// this stops being a demo.
const WALRUS_EPOCHS = process.env.WALRUS_EPOCHS ?? "5";

const TIMEOUT_MS = 30_000;

export interface ReasoningTraceScenario {
  scenario_id: string;
  category: string;
  language: string;
  message: string;
  reply: string;
  judgments: Array<{ model: string; score: number; reasoning: string; request_id: string }>;
}

export interface ReasoningTraceUpload {
  blob_id: string;
  aggregator_url: string;
}

/**
 * Uploads the full per-model reasoning trace for one test run as a single
 * JSON blob. Returns null (never throws) if Walrus isn't reachable - callers
 * treat a missing blob id the same way they already treat a mock Sui object
 * id: the run still completes and shows real data, just without this one
 * piece of evidence.
 */
export async function uploadReasoningTrace(
  testRunId: string,
  agentId: string,
  scenarios: ReasoningTraceScenario[]
): Promise<ReasoningTraceUpload | null> {
  const payload = JSON.stringify({
    test_run_id: testRunId,
    agent_id: agentId,
    generated_at: new Date().toISOString(),
    scenarios,
  });

  try {
    const res = await fetch(
      `${WALRUS_PUBLISHER_URL.replace(/\/$/, "")}/v1/blobs?epochs=${WALRUS_EPOCHS}&deletable=false`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      throw new Error(`Walrus publisher returned HTTP ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();
    // Either shape means the blob is stored and fetchable either way - see
    // storing-blobs.md: "newlyCreated" the first time a given blob's
    // content is seen, "alreadyCertified" if identical bytes were already
    // stored (each of our uploads embeds generated_at, so a genuine repeat
    // is astronomically unlikely, but a real API from testnet redeploys/
    // retries could still hit this path).
    const blobId: unknown =
      body?.newlyCreated?.blobObject?.blobId ?? body?.alreadyCertified?.blobId;

    if (typeof blobId !== "string") {
      throw new Error(`Unexpected Walrus publisher response shape: ${JSON.stringify(body).slice(0, 200)}`);
    }

    return { blob_id: blobId, aggregator_url: `${WALRUS_AGGREGATOR_URL.replace(/\/$/, "")}/v1/blobs/${blobId}` };
  } catch (err) {
    console.error("[walrus] reasoning trace upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
