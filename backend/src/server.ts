import express from "express";
import testRunsRouter from "./routes/testRuns";
import zkLoginRouter from "./routes/zklogin";

const app = express();
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
