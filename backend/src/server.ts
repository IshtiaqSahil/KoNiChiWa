import cors from "cors";
import express from "express";
import testRunsRouter from "./routes/testRuns";
import zkLoginRouter from "./routes/zklogin";

const app = express();

// Frontend is deployed as a separate static site (different origin), so it
// needs an explicit CORS allowance - comma-separated so both a preview and
// a production frontend URL can be allowed at once. Left unset, cross-origin
// requests are rejected rather than defaulting to allow-all.
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : false }));

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(testRunsRouter);
app.use(zkLoginRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`backend listening on :${port}`);
});
