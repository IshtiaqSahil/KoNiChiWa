import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentityScript, deriveZkLoginAddress } from "../zklogin";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface Props {
  signedInLabel: (shortAddress: string) => string;
  errorPrefix: string;
  onAddressChange: (address: string | null) => void;
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Renders nothing if VITE_GOOGLE_CLIENT_ID isn't set - certifications just
// default to backend-owned, same as before this existed (see
// sui/client.ts's ownerOverride fallback).
export function ZkLoginButton({ signedInLabel, errorPrefix, onAddressChange }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            deriveZkLoginAddress(response.credential)
              .then((derived) => {
                if (cancelled) return;
                setAddress(derived);
                setError(null);
                onAddressChange(derived);
              })
              .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "zkLogin failed");
              });
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          size: "medium",
          theme: "outline",
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Google Sign-In");
      });

    return () => {
      cancelled = true;
    };
    // onAddressChange is a setState setter from the parent (stable identity) -
    // intentionally not re-running this effect (and re-rendering Google's
    // button) on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <span className="zklogin">
      {address ? (
        <span className="chip" title={address}>
          {signedInLabel(shorten(address))}
        </span>
      ) : (
        <div ref={buttonRef} />
      )}
      {error && (
        <span className="chip zklogin-error" title={error}>
          {errorPrefix}
        </span>
      )}
    </span>
  );
}
