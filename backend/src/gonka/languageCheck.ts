import { Language } from "../agent-client/types";

// Script detection for "did the agent actually answer in the language it was
// asked in?" - the cheapest observable signal for the failure mode pillar #3
// exists to catch: an agent that only fake-supports non-English users and
// answers everything in English (AGENTS.md).
//
// Script-level, not fluency-level, on purpose. Judging *quality* of Chinese
// is the Gonka models' job (see buildJudgePrompt); this is the deterministic
// floor underneath it, so the check still works on the stub-judge path when
// GonkaRouter is unconfigured or times out.

const HAN = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
// Hiragana + katakana. Japanese shares Han ("kanji") with Chinese, so kana is
// what actually separates the two: a natural Japanese sentence essentially
// always contains particles/okurigana written in kana.
const KANA = /[\u3040-\u309F\u30A0-\u30FF]/;
const LATIN = /[A-Za-z]/;

export function repliedInLanguage(reply: string, language: Language): boolean {
  const text = reply.trim();
  if (!text) return false;

  switch (language) {
    case "zh":
      return HAN.test(text) && !KANA.test(text);
    case "ja":
      return KANA.test(text);
    case "en":
      return LATIN.test(text) && !HAN.test(text) && !KANA.test(text);
  }
}
