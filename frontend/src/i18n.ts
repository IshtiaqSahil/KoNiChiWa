import { Language } from "./api";

// The dashboard itself speaks the three languages the platform tests in.
// Not decoration: a certification platform whose pitch is "we catch agents
// that only fake-support non-English users" cannot credibly ship an
// English-only console, and judges at this hackathon may well read the
// Chinese or Japanese track more comfortably than the English one.
//
// Hand-rolled rather than react-i18next: one flat dictionary, three locales,
// no plurals or date formatting anywhere in this UI - a library would be
// more setup than the whole feature. Swap it in if the string count grows.
//
// Note what is NOT translated here: scenario prompts, agent replies and
// model reasoning all arrive from the backend already in their own language
// and are rendered verbatim. Translating those in the client would hide the
// exact thing the dashboard exists to show.

export const UI_LANGUAGES: Language[] = ["en", "zh", "ja"];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
};

// Short tags for the per-scenario badges, kept ASCII so they stay legible at
// 0.68rem regardless of which UI locale is active.
export const LANGUAGE_TAGS: Record<Language, string> = {
  en: "EN",
  zh: "ZH",
  ja: "JA",
};

interface Strings {
  tagline: string;
  localeLabel: string;

  statusLive: string;
  statusLiveOff: string;
  statusGonka: string;
  statusSui: string;
  statusLanguages: string;

  run: string;
  running: string;
  rerun: string;
  progress: (done: number, total: number) => string;
  waiting: string;

  overall: string;
  baseScore: string;
  agreement: string;
  stability: string;
  stabilityUntested: string;
  formula: string;

  categories: string;
  languages: string;
  scenarios: string;
  certificate: string;

  judgesToggle: (n: number) => string;
  wrongLanguage: string;
  weakestLanguage: string;
  requestIdLabel: string;

  certOnChain: string;
  certMock: string;
  explorer: string;
  certifiedAt: string;
  walrusTrace: string;
  walrusTraceLoading: string;
  walrusTraceError: string;

  categoryNames: Record<string, string>;
  // Keyed by the canonical English tier label the backend returns
  // (scoring/weights.ts CERTIFICATION_TIERS). Only the display is localised -
  // the label written into the Sui AgentCertification object stays English,
  // since that's the certification's canonical identity on-chain.
  tierNames: Record<string, string>;
  agentNotes: Record<string, string>;
  footnote: string;

  verifyIntro: string;
  verifyBack: string;
  verifyLoading: string;
  verifyNotFound: string;
  verifyNotConfigured: string;
  verifyRunning: string;
  verifyFailed: (reason: string) => string;
  copyLink: string;
  linkCopied: string;

  certificationsLink: string;
  certificationsIntro: string;
  certificationsEmpty: string;

  zkLoginSignedIn: (shortAddress: string) => string;
  zkLoginError: string;

  safetyFloorNote: (category: string, cappedScore: number) => string;
}

const en: Strings = {
  tagline:
    "Certification for AI payment agents. Every scenario is judged by three Gonka models, run in English, Chinese and Japanese, and the final score is written on-chain to Sui.",
  localeLabel: "Interface language",

  statusLive: "Live progress on",
  statusLiveOff: "Live progress off (Supabase not configured)",
  statusGonka: "3 Gonka judges per scenario",
  statusSui: "Sui testnet certification",
  statusLanguages: "3 languages per scenario",

  run: "Run certification",
  running: "Running…",
  rerun: "Run again",
  progress: (done, total) => `${done} of ${total} scenarios`,
  waiting: "Waiting for the first scenario…",

  overall: "Trust score",
  baseScore: "Base score",
  agreement: "Model agreement",
  stability: "Language stability",
  stabilityUntested: "single language — not measured",
  formula: "base × agreement × stability",

  categories: "By category",
  languages: "By language",
  scenarios: "Scenarios",
  certificate: "On-chain certification",

  judgesToggle: (n) => `${n} model judgments`,
  wrongLanguage: "answered in the wrong language",
  weakestLanguage: "weakest language",
  requestIdLabel: "Gonka request ID",

  certOnChain: "AgentCertification object",
  certMock: "Mock id — Sui write not configured (SUI_PACKAGE_ID / SUI_PUBLISHER_PRIVATE_KEY).",
  explorer: "View on Suiscan",
  certifiedAt: "Certified",
  walrusTrace: "View full reasoning trace (Walrus)",
  walrusTraceLoading: "Loading reasoning trace from Walrus…",
  walrusTraceError: "Couldn't load — click to retry",

  categoryNames: {
    instruction_accuracy: "Instruction accuracy",
    permission_compliance: "Permission compliance",
    prompt_injection_resistance: "Prompt-injection resistance",
  },
  tierNames: {
    Excellent: "Excellent",
    Strong: "Strong",
    Adequate: "Adequate",
    Weak: "Weak",
    Failing: "Failing",
  },
  agentNotes: {
    "safe-agent": "Validation layer, multilingual by construction",
    "yolo-agent": "Minimal guardrails, English-only parsing",
    "naive-agent": "Multilingual, but zero guardrails in any language",
    "llm-careful-agent": "Real LLM, careful system prompt",
    "llm-reckless-agent": "Same real LLM, no safety instructions",
  },
  footnote:
    "Language stability is 100 minus the spread between the best and worst language average. It multiplies into the final score, and is written on-chain as AgentCertification.multilingual_stability.",

  verifyIntro: "Independently verifiable certification result — anyone with this link can check it.",
  verifyBack: "← Back to dashboard",
  verifyLoading: "Loading…",
  verifyNotFound: "No certification found for this link.",
  verifyNotConfigured: "Supabase isn't configured, so this link can't be resolved here.",
  verifyRunning: "This test run is still in progress — check back shortly.",
  verifyFailed: (reason) => `This test run failed: ${reason}`,
  copyLink: "Copy verification link",
  linkCopied: "Link copied",

  certificationsLink: "All certifications",
  certificationsIntro: "Every completed certification, most recent first — anyone can browse the full history.",
  certificationsEmpty: "No certifications yet — run a certification from the dashboard first.",

  zkLoginSignedIn: (address) => `Certifying as ${address} (zkLogin)`,
  zkLoginError: "zkLogin sign-in failed",

  safetyFloorNote: (category, cappedScore) =>
    `Safety floor applied: ${category} scored too low to certify above this tier, regardless of other categories — capped to ${cappedScore}.`,
};

const zh: Strings = {
  tagline:
    "面向 AI 支付代理的可信认证平台。每个测试场景由三个 Gonka 模型并行评判，并以英文、中文、日文各运行一次，最终分数写入 Sui 链上。",
  localeLabel: "界面语言",

  statusLive: "实时进度已开启",
  statusLiveOff: "实时进度未开启（Supabase 未配置）",
  statusGonka: "每个场景 3 个 Gonka 评判模型",
  statusSui: "Sui 测试网认证",
  statusLanguages: "每个场景 3 种语言",

  run: "开始认证",
  running: "运行中…",
  rerun: "重新运行",
  progress: (done, total) => `${total} 个场景中的第 ${done} 个`,
  waiting: "等待第一个场景…",

  overall: "信任分数",
  baseScore: "基础分",
  agreement: "模型一致度",
  stability: "多语言稳定性",
  stabilityUntested: "仅一种语言 — 未测量",
  formula: "基础分 × 一致度 × 稳定性",

  categories: "按类别",
  languages: "按语言",
  scenarios: "测试场景",
  certificate: "链上认证",

  judgesToggle: (n) => `${n} 条模型评判`,
  wrongLanguage: "回复语言不符",
  weakestLanguage: "最薄弱语言",
  requestIdLabel: "Gonka 请求 ID",

  certOnChain: "AgentCertification 对象",
  certMock: "模拟 ID — 未配置 Sui 写入（SUI_PACKAGE_ID / SUI_PUBLISHER_PRIVATE_KEY）。",
  explorer: "在 Suiscan 查看",
  certifiedAt: "认证时间",
  walrusTrace: "查看完整推理记录（Walrus）",
  walrusTraceLoading: "正在从 Walrus 加载推理记录…",
  walrusTraceError: "加载失败 — 点击重试",

  categoryNames: {
    instruction_accuracy: "指令准确性",
    permission_compliance: "权限合规性",
    prompt_injection_resistance: "提示注入抵抗力",
  },
  tierNames: {
    Excellent: "优秀",
    Strong: "良好",
    Adequate: "合格",
    Weak: "薄弱",
    Failing: "不合格",
  },
  agentNotes: {
    "safe-agent": "带校验层，原生多语言支持",
    "yolo-agent": "几乎无防护，仅支持英文解析",
    "naive-agent": "支持多语言，但任何语言下都毫无防护",
    "llm-careful-agent": "真实 LLM，配有谨慎的系统提示词",
    "llm-reckless-agent": "同一真实 LLM，但没有任何安全提示词",
  },
  footnote:
    "多语言稳定性 = 100 减去最高与最低语言均分之差，直接参与最终分数计算，并作为 AgentCertification.multilingual_stability 写入链上。",

  verifyIntro: "可独立验证的认证结果 — 任何持有此链接的人都可以查看。",
  verifyBack: "← 返回仪表盘",
  verifyLoading: "加载中…",
  verifyNotFound: "未找到该链接对应的认证结果。",
  verifyNotConfigured: "Supabase 未配置，无法在此解析该链接。",
  verifyRunning: "该测试运行仍在进行中 — 请稍后再查看。",
  verifyFailed: (reason) => `该测试运行失败：${reason}`,
  copyLink: "复制验证链接",
  linkCopied: "链接已复制",

  certificationsLink: "全部认证记录",
  certificationsIntro: "所有已完成的认证，按时间从新到旧排列 — 任何人都可以浏览完整历史记录。",
  certificationsEmpty: "暂无认证记录 — 请先在仪表盘运行一次认证。",

  zkLoginSignedIn: (address) => `以 ${address} 身份认证（zkLogin）`,
  zkLoginError: "zkLogin 登录失败",

  safetyFloorNote: (category, cappedScore) =>
    `已触发安全底线：${category} 得分过低，无论其他类别表现如何，认证等级都不能高于此档 — 已封顶为 ${cappedScore} 分。`,
};

const ja: Strings = {
  tagline:
    "AI 決済エージェント向けの信頼性認証プラットフォーム。各シナリオを 3 つの Gonka モデルが並行して評価し、英語・中国語・日本語で実行したうえで、最終スコアを Sui のチェーン上に記録します。",
  localeLabel: "表示言語",

  statusLive: "リアルタイム進捗: 有効",
  statusLiveOff: "リアルタイム進捗: 無効（Supabase 未設定）",
  statusGonka: "シナリオごとに 3 モデルで評価",
  statusSui: "Sui テストネットで認証",
  statusLanguages: "シナリオごとに 3 言語",

  run: "認証を実行",
  running: "実行中…",
  rerun: "再実行",
  progress: (done, total) => `${total} 件中 ${done} 件`,
  waiting: "最初のシナリオを待機中…",

  overall: "信頼スコア",
  baseScore: "基礎スコア",
  agreement: "モデル一致度",
  stability: "多言語安定性",
  stabilityUntested: "1 言語のみ — 計測なし",
  formula: "基礎スコア × 一致度 × 安定性",

  categories: "カテゴリ別",
  languages: "言語別",
  scenarios: "シナリオ",
  certificate: "オンチェーン認証",

  judgesToggle: (n) => `モデル評価 ${n} 件`,
  wrongLanguage: "異なる言語で応答",
  weakestLanguage: "最も弱い言語",
  requestIdLabel: "Gonka リクエスト ID",

  certOnChain: "AgentCertification オブジェクト",
  certMock: "モック ID — Sui への書き込みが未設定です（SUI_PACKAGE_ID / SUI_PUBLISHER_PRIVATE_KEY）。",
  explorer: "Suiscan で表示",
  certifiedAt: "認証日時",
  walrusTrace: "完全な推論記録を見る（Walrus）",
  walrusTraceLoading: "Walrus から推論記録を読み込み中…",
  walrusTraceError: "読み込みに失敗しました — クリックして再試行",

  categoryNames: {
    instruction_accuracy: "指示の正確さ",
    permission_compliance: "権限の遵守",
    prompt_injection_resistance: "プロンプトインジェクション耐性",
  },
  tierNames: {
    Excellent: "優秀",
    Strong: "良好",
    Adequate: "合格",
    Weak: "脆弱",
    Failing: "不合格",
  },
  agentNotes: {
    "safe-agent": "検証レイヤーあり・多言語対応",
    "yolo-agent": "ガードレールなし・英語のみ解析",
    "naive-agent": "多言語対応だが、どの言語でもガードレールなし",
    "llm-careful-agent": "実際の LLM・慎重なシステムプロンプト",
    "llm-reckless-agent": "同じ LLM だが安全指示なし",
  },
  footnote:
    "多言語安定性は、最高スコアの言語と最低スコアの言語の差を 100 から引いた値です。最終スコアに乗算され、AgentCertification.multilingual_stability としてチェーン上に記録されます。",

  verifyIntro: "独立して検証可能な認証結果 — このリンクを持つ誰でも確認できます。",
  verifyBack: "← ダッシュボードに戻る",
  verifyLoading: "読み込み中…",
  verifyNotFound: "このリンクに対応する認証結果が見つかりません。",
  verifyNotConfigured: "Supabase が未設定のため、このリンクをここで解決できません。",
  verifyRunning: "このテスト実行はまだ進行中です — しばらくしてから再度ご確認ください。",
  verifyFailed: (reason) => `このテスト実行は失敗しました：${reason}`,
  copyLink: "検証リンクをコピー",
  linkCopied: "リンクをコピーしました",

  certificationsLink: "認証一覧",
  certificationsIntro: "完了したすべての認証を新しい順に表示します — 誰でも全履歴を閲覧できます。",
  certificationsEmpty: "まだ認証がありません — まずダッシュボードで認証を実行してください。",

  zkLoginSignedIn: (address) => `${address} として認証中（zkLogin）`,
  zkLoginError: "zkLogin サインインに失敗しました",

  safetyFloorNote: (category, cappedScore) =>
    `安全下限を適用：${category} のスコアが低すぎるため、他のカテゴリの結果に関わらずこの等級を上回って認証できません — ${cappedScore} 点に制限されました。`,
};

export const STRINGS: Record<Language, Strings> = { en, zh, ja };

// Both fall back to the raw key, so a category or tier added on the backend
// without a translation shows up as itself rather than blank.
export function categoryLabel(strings: Strings, category: string): string {
  return strings.categoryNames[category] ?? category;
}

export function tierLabel(strings: Strings, tier: string): string {
  return strings.tierNames[tier] ?? tier;
}
