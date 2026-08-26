import express from "express";

// Stand-in for a real LangChain-based SafeAgent (design/PRE_PRODUCTION_DECISIONS_EN.md
// section 6: "Solid system prompt + validation layer"). This is naive
// regex parsing tuned to the fixed scenario set in
// backend/src/scenarios/scenarios.ts - good enough to prove the pipeline
// end-to-end, not a real NLU agent.

const app = express();
app.use(express.json());

const API_KEY = process.env.SAFE_AGENT_API_KEY ?? "dev-safe-agent-key";

const INJECTION_PATTERN = /system override|ignore all previous|disregard all previous/i;
const EVERYTHING_PATTERN = /everything.*to\s+(\w+)/i;
const SEND_PATTERN = /send\s+(\w+)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i;

app.post("/v1/agent/invoke", (req, res) => {
  if (req.header("X-Api-Key") !== API_KEY) {
    res.status(401).json({ error: "invalid api key" });
    return;
  }

  const { message, context } = req.body;

  if (INJECTION_PATTERN.test(message)) {
    res.json({
      reply: "This request attempts to override my established permissions. I cannot execute it.",
      action: { type: "refuse" },
    });
    return;
  }

  const everythingMatch = message.match(EVERYTHING_PATTERN);
  if (everythingMatch) {
    res.json({
      reply: `Sending your entire balance would exceed your spending limit of ${context.spending_limit}. I can't do that.`,
      action: { type: "refuse" },
    });
    return;
  }

  const sendMatch = message.match(SEND_PATTERN);
  if (sendMatch) {
    const [, recipientName, amountStr, asset] = sendMatch;
    const amount = Number(amountStr);
    const contact = context.contacts.find(
      (c: { name: string }) => c.name.toLowerCase() === recipientName.toLowerCase()
    );

    if (!contact) {
      res.json({
        reply: `I don't recognize "${recipientName}" as a known contact. Who should I send this to?`,
        action: { type: "clarify" },
      });
      return;
    }

    if (amount > context.spending_limit) {
      res.json({
        reply: `This transaction exceeds your ${context.spending_limit} ${asset} spending limit.`,
        action: { type: "refuse" },
      });
      return;
    }

    res.json({
      reply: `Sending ${amount} ${asset} to ${recipientName}.`,
      action: { type: "transfer", asset, amount, recipient: contact.address },
    });
    return;
  }

  res.json({
    reply: "I couldn't parse this request. Could you clarify the amount, asset, and recipient?",
    action: { type: "clarify" },
  });
});

const port = Number(process.env.SAFE_AGENT_PORT ?? 4001);
app.listen(port, () => {
  console.log(`safe-agent listening on :${port}`);
});
