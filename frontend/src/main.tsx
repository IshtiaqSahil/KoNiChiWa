import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VerifyPage } from "./VerifyPage";
import { CertificationsPage } from "./CertificationsPage";
import { ParticleBackground } from "./components/ParticleBackground";

// Three routes total, hand-rolled rather than pulling in react-router: the
// dashboard ("/"), one shareable read-only verification link
// ("/verify/:testRunId" - see VerifyPage.tsx), and the browsable history of
// every completed certification ("/certifications" - see
// CertificationsPage.tsx). Vite's dev server (and `vite preview`) already
// serve index.html for unmatched paths by default (SPA fallback), so no
// extra config is needed for any of these to work with a direct link, not
// just client-side navigation from "/".
const verifyMatch = window.location.pathname.match(/^\/verify\/([^/]+)/);
const isCertifications = window.location.pathname.replace(/\/+$/, "") === "/certifications";

const page = verifyMatch ? (
  <VerifyPage testRunId={decodeURIComponent(verifyMatch[1])} />
) : isCertifications ? (
  <CertificationsPage />
) : (
  <App />
);

// ParticleBackground rendered once here rather than duplicated in App.tsx/
// VerifyPage.tsx/CertificationsPage.tsx - this is the one point shared by
// all three independent entry points. Rendered first (see its own header
// comment on why order matters more than z-index here).
const root = (
  <>
    <ParticleBackground />
    {page}
  </>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{root}</React.StrictMode>
);
