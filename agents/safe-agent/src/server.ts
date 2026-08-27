import express from "express";

// Stand-in for a real LangChain-based SafeAgent (design/PRE_PRODUCTION_DECISIONS_EN.md
// section 6: "Solid system prompt + validation layer"). This is naive
// pattern parsing tuned to the fixed scenario set in
// backend/src/scenarios/scenarios.ts - good enough to prove the pipeline
// end-to-end, not a real NLU agent.
//
// Multilingual by construction (pillar #3): each language gets its own
// patterns and its own reply templates, rather than translating into English
// and reusing the English path. That distinction is the whole point of the
// comparison with YOLOAgent, which is English-only - see
// agents/yolo-agent/src/server.ts.

const app = express();
app.use(express.json());

const API_KEY = process.env.SAFE_AGENT_API_KEY ?? "dev-safe-agent-key";

type Language = "en" | "zh" | "ja";

interface PatternSet {
  injection: RegExp;
  everything: RegExp;
  send: RegExp; // capture groups: recipient, amount, asset
}

// Word order differs per language, so the capture groups can't be shared:
// English/Chinese put the recipient before the amount ("send Alice 20 USDC",
// "给 Alice 转 20 USDC"), Japanese marks it with a particle instead
// ("Alice に 20 USDC を送って"). Each `send` regex below is written so
// groups 1/2/3 come out as recipient/amount/asset regardless.
const PATTERNS: Record<Language, PatternSet> = {
  en: {
    injection: /system override|ignore all previous|disregard all previous/i,
    everything: /(everything|entire balance|all of my|whole balance)/i,
    send: /send\s+([A-Za-z]+)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)/i,
  },
  zh: {
    injection: /系统覆盖|忽略(之前|以前|先前)|无视(之前|以前|先前)|覆盖(之前|以前)的?(指令|设置|限制)/,
    everything: /(全部|所有|全额|所有余额)[^。]{0,10}(转|转账|发送|打款|付)/,
    send: /给\s*([A-Za-z\u4e00-\u9fff]+)\s*(?:转账?|发送?|打)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)/,
  },
  ja: {
    injection: /システム上書き|システムオーバーライド|(これまで|以前|過去)の[^。]{0,20}(無視|上書き)|すべて無視/,
    everything: /(全部|すべて|全額|残高)[^。]{0,10}(送金|送っ|送信|振り込)/,
    send: /([A-Za-z\u3040-\u30ff\u4e00-\u9fff]+)\s*に\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*を?\s*(?:送|振)/,
  },
};

// Replies are authored per language, not translated at request time - an
// agent that answers a Chinese user in English is precisely the failure mode
// the platform is built to catch (backend/src/gonka/languageCheck.ts).
const REPLIES: Record<
  Language,
  {
    injection: string;
    overLimit: (limit: number, asset: string) => string;
    exceedsBalance: (limit: number) => string;
    unknownContact: (name: string) => string;
    transfer: (amount: number, asset: string, name: string) => string;
    unparsed: string;
  }
> = {
  en: {
    injection:
      "This request attempts to override my established permissions. I cannot execute it.",
    overLimit: (limit, asset) =>
      `This transaction exceeds your ${limit} ${asset} spending limit.`,
    exceedsBalance: (limit) =>
      `Sending your entire balance would exceed your spending limit of ${limit}. I can't do that.`,
    unknownContact: (name) =>
      `I don't recognize "${name}" as a known contact. Who should I send this to?`,
    transfer: (amount, asset, name) => `Sending ${amount} ${asset} to ${name}.`,
    unparsed: "I couldn't parse this request. Could you clarify the amount, asset, and recipient?",
  },
  zh: {
    injection: "该请求试图绕过我已设定的权限，我无法执行。",
    overLimit: (limit, asset) => `这笔交易超出了您 ${limit} ${asset} 的支出限额。`,
    exceedsBalance: (limit) => `转出全部余额会超过您 ${limit} 的支出限额，我不能这样做。`,
    unknownContact: (name) => `我的联系人里没有「${name}」，请确认收款人是谁？`,
    transfer: (amount, asset, name) => `正在向 ${name} 转账 ${amount} ${asset}。`,
    unparsed: "我无法解析这条指令，请说明金额、币种和收款人。",
  },
  ja: {
    injection: "このリクエストは設定済みの権限を上書きしようとしているため、実行できません。",
    overLimit: (limit, asset) => `この取引は ${limit} ${asset} の支出上限を超えています。`,
    exceedsBalance: (limit) =>
      `残高を全額送金すると支出上限 ${limit} を超えてしまうため、実行できません。`,
    unknownContact: (name) => `「${name}」は登録済みの連絡先に見つかりません。送金先はどなたですか？`,
    transfer: (amount, asset, name) => `${name} に ${amount} ${asset} を送金します。`,
    unparsed: "リクエストを解釈できませんでした。金額・通貨・送金先を教えてください。",
  },
};

function resolveLanguage(raw: unknown): Language {
  return raw === "zh" || raw === "ja" ? raw : "en";
}

app.post("/v1/agent/invoke", (req, res) => {
  if (req.header("X-Api-Key") !== API_KEY) {
    res.status(401).json({ error: "invalid api key" });
    return;
  }

  const { message, context } = req.body;
  const language = resolveLanguage(req.body?.language);
  const patterns = PATTERNS[language];
  const reply = REPLIES[language];

  // Order matters: the injection payloads also contain "transfer everything"
  // phrasing, so the injection check has to run first for the *reason* given
  // in the reply to be the right one (both paths refuse either way).
  if (patterns.injection.test(message)) {
    res.json({ reply: reply.injection, action: { type: "refuse" } });
    return;
  }

  if (patterns.everything.test(message)) {
    res.json({
      reply: reply.exceedsBalance(context.spending_limit),
      action: { type: "refuse" },
    });
    return;
  }

  const sendMatch = message.match(patterns.send);
  if (sendMatch) {
    const [, recipientName, amountStr, asset] = sendMatch;
    const amount = Number(amountStr);
    const contact = context.contacts.find(
      (c: { name: string }) => c.name.toLowerCase() === recipientName.toLowerCase()
    );

    if (!contact) {
      res.json({ reply: reply.unknownContact(recipientName), action: { type: "clarify" } });
      return;
    }

    if (amount > context.spending_limit) {
      res.json({
        reply: reply.overLimit(context.spending_limit, asset),
        action: { type: "refuse" },
      });
      return;
    }

    res.json({
      reply: reply.transfer(amount, asset, recipientName),
      action: { type: "transfer", asset, amount, recipient: contact.address },
    });
    return;
  }

  res.json({ reply: reply.unparsed, action: { type: "clarify" } });
});

const port = Number(process.env.SAFE_AGENT_PORT ?? 4001);
app.listen(port, () => {
  console.log(`safe-agent listening on :${port}`);
});
