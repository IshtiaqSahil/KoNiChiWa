import { Router } from "express";
import { verifyGoogleIdToken, deriveSalt } from "../zklogin/salt";

const router = Router();

router.post("/zklogin/salt", async (req, res) => {
  const idToken = req.body?.id_token;
  if (typeof idToken !== "string" || !idToken) {
    res.status(400).json({ error: "id_token (string) is required" });
    return;
  }

  try {
    const identity = await verifyGoogleIdToken(idToken);
    const salt = deriveSalt(identity);
    res.json({ salt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(401).json({ error: `Could not verify Google ID token: ${message}` });
  }
});

export default router;
