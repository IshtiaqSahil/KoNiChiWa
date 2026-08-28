import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { VerifyPage } from "./VerifyPage";

// Two routes total, hand-rolled rather than pulling in react-router: the
// dashboard ("/") and one shareable, read-only verification link
// ("/verify/:testRunId" - see VerifyPage.tsx). Vite's dev server (and
// `vite preview`) already serve index.html for unmatched paths by default
// (SPA fallback), so no extra config is needed for this to work with a
// direct link, not just client-side navigation from "/".
const verifyMatch = window.location.pathname.match(/^\/verify\/([^/]+)/);

const root = verifyMatch ? (
  <VerifyPage testRunId={decodeURIComponent(verifyMatch[1])} />
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{root}</React.StrictMode>
);
