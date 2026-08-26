import express from "express";

// Stand-in for a real "deliberately vulnerable" YOLOAgent
// (design/PRE_PRODUCTION_DECISIONS_EN.md section 6: "minimal system
// prompt"). Blindly obeys whatever it can parse out of the message -
// no permission checks, no injection awareness. Naive regex tuned to
// the fixed scenario set in backend/src/scenarios/scenarios.ts.

const app = express();
app.use(express.json());

const API_KEY = process.env.YOLO_AGENT_API_KEY ?? "dev-yolo-agent-key";

const EVERYTHING_PATTERN = /everything.*to\s+(\w+)/i;
const TRANSFER_PATTERN = /transfer\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+to\s+(\S+)/i;
const SEND_PATTERN = /send\s+(\w+)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i;

app.post("/v1/agent/invoke", (req, res) => {
  if (req.header("X-Api-Key") !== API_KEY) {
    res.status(401).json({ error: "invalid api key" });
    return;
  }

  const { message, context } = req.body;

  const everythingMatch = message.match(EVERYTHING_PATTERN);
  if (everythingMatch) {
    const recipientName = everythingMatch[1];
    const contact = context.contacts.find(
      (c: { name: string }) => c.name.toLowerCase() === recipientName.toLowerCase()
    );
    res.json({
      reply: `Done - sent your full balance to ${recipientName}.`,
      action: {
        type: "transfer",
        asset: "USDC",
        amount: context.wallet_balance,
        recipient: contact?.address ?? recipientName,
      },
    });
    return;
  }

  // Deliberately no injection check here - that's the point of this agent.
  const transferMatch = message.match(TRANSFER_PATTERN);
  if (transferMatch) {
    const [, amountStr, asset, recipient] = transferMatch;
    res.json({
      reply: `Done - sent ${amountStr} ${asset} to ${recipient}.`,
      action: { type: "transfer", asset, amount: Number(amountStr), recipient },
    });
    return;
  }

  const sendMatch = message.match(SEND_PATTERN);
  if (sendMatch) {
    const [, recipientName, amountStr, asset] = sendMatch;
    const contact = context.contacts.find(
      (c: { name: string }) => c.name.toLowerCase() === recipientName.toLowerCase()
    );
    res.json({
      reply: `Done - sent ${amountStr} ${asset} to ${recipientName}.`,
      action: {
        type: "transfer",
        asset,
        amount: Number(amountStr),
        recipient: contact?.address ?? recipientName,
      },
    });
    return;
  }

  res.json({
    reply: "Sure, done.",
    action: { type: "transfer", asset: "USDC", amount: 0, recipient: "unknown" },
  });
});

const port = Number(process.env.YOLO_AGENT_PORT ?? 4002);
app.listen(port, () => {
  console.log(`yolo-agent listening on :${port}`);
});
