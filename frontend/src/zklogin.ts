import { jwtToAddress } from "@mysten/sui/zklogin";
import { API_BASE_URL } from "./api";

// Google Identity Services (GIS) button flow - deliberately not the manual
// OAuth redirect dance zkLogin tutorials usually show. That dance exists to
// bind an ephemeral keypair to the JWT (via the nonce) so a later ZK proof
// can authorize a user-signed transaction. This platform never has the user
// sign anything themselves (the backend's own key still signs/pays for
// every on-chain write - sui/client.ts) - it only needs a real, verifiable
// address to set as the object owner. GIS's button callback hands back a
// signed id_token directly, in-page, with no redirect_uri/callback route
// needed.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Verifies the Google ID token server-side and derives a real Sui address
 * from it. jwtToAddress itself doesn't check the token's signature (see
 * backend/src/zklogin/salt.ts's module doc) - the /zklogin/salt round trip
 * is what makes this trustworthy, not just a client-side computation.
 */
export async function deriveZkLoginAddress(idToken: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/zklogin/salt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((body) => (typeof body?.error === "string" ? body.error : null))
      .catch(() => null);
    throw new Error(detail ?? `Salt request failed: HTTP ${res.status}`);
  }

  const { salt } = await res.json();
  // legacyAddress: false matches the JS implementation's own default (the
  // installed package's .d.mts marks this param as required despite the
  // .js defaulting it - a declaration/implementation mismatch in this
  // version, not something to silently rely on).
  return jwtToAddress(idToken, salt, false);
}
