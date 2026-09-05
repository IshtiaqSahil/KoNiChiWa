import { createHmac } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

// zkLogin identity for MUBA Hacks Track 02 ("Use Sui for ownership,
// identity, payments or on-chain execution"). Derives a real Sui address
// from a Google-signed identity, without needing the ZK-proof/prover
// service: this platform's design never has the user sign a transaction
// themselves (the backend's own key still signs and pays gas for every
// on-chain write - sui/client.ts), it only needs to know *whose* address
// should own the resulting certification object. @mysten/sui/zklogin's
// jwtToAddress(jwt, salt) derives that address from the JWT's claims plus a
// salt alone (confirmed by reading the installed package's source,
// backend/node_modules/@mysten/sui/dist/cjs/zklogin/{address,utils}.js) -
// the proof is a separate step only required for the user to sign
// something themselves, which never happens here.
//
// jwtToAddress itself never checks the JWT's cryptographic signature (it
// just parses claims via decodeJwt) - verifying the signature here, before
// handing back a salt tied to those claims, is what stops a caller from
// requesting the canonical address for a Google identity they don't
// actually control.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const SALT_SECRET = process.env.ZKLOGIN_SALT_SECRET;

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface VerifiedIdentity {
  sub: string;
  iss: string;
  aud: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedIdentity> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");
  }

  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: GOOGLE_CLIENT_ID,
  });

  if (typeof payload.sub !== "string" || typeof payload.iss !== "string" || typeof payload.aud !== "string") {
    throw new Error("Google ID token missing required claims");
  }

  return { sub: payload.sub, iss: payload.iss, aud: payload.aud };
}

/**
 * Deterministic salt for a given verified identity: HMAC-SHA256(secret,
 * iss|aud|sub), first 16 bytes read as a big-endian unsigned integer,
 * returned as a decimal string (the format jwtToAddress/genAddressSeed
 * expect - confirmed against the installed SDK source, see module doc).
 *
 * Deliberately deterministic and stateless rather than a random salt
 * persisted per-user (the standard pattern for a real wallet, where losing
 * the salt permanently loses the address): this address is only ever used
 * as the public owner of an on-chain certification object, never to sign
 * anything, so there's no private key material or fund-loss risk riding on
 * it, and no anonymity property to preserve either - it's meant to be
 * publicly linkable to the certification it owns. A leaked SALT_SECRET
 * would let someone precompute other users' addresses; it would not let
 * them do anything with those addresses, since owning a Sui object
 * requires no signature.
 */
export function deriveSalt(identity: VerifiedIdentity): string {
  if (!SALT_SECRET) {
    throw new Error("ZKLOGIN_SALT_SECRET not configured");
  }

  const digest = createHmac("sha256", SALT_SECRET)
    .update(`${identity.iss}|${identity.aud}|${identity.sub}`)
    .digest();

  return BigInt(`0x${digest.subarray(0, 16).toString("hex")}`).toString(10);
}
