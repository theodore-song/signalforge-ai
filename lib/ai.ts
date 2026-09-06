import type { StockPick } from "./types";

export async function makeCommitteeBrief(picks: StockPick[], regime: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    const leaders = picks.slice(0, 3).map((pick) => pick.ticker).join(", ");
    return `${leaders} lead a ${regime.toLowerCase()} tape. The ranking rewards agreement across durable fundamentals, price confirmation, filings and attention signals; position sizing stays diversified because these indicators can be delayed or wrong.`;
  }

  const payload = picks.slice(0, 6).map(({ ticker, score, thesis, risk, signals }) => ({
    ticker, score, thesis, risk, factors: signals.slice(0, 4).map((signal) => `${signal.label}: ${signal.score}`)
  }));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        instructions: "You are the risk-aware chair of an investment research committee. Summarize the supplied quantitative rankings in 70 words or fewer. Never promise returns, never issue personalized financial advice, distinguish evidence from inference, and mention the largest portfolio-level risk.",
        input: JSON.stringify({ regime, candidates: payload }),
        text: { verbosity: "low" },
        store: false
      })
    });
    if (!response.ok) throw new Error("OpenAI request failed");
    const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    return json.output_text || json.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "The committee brief is temporarily unavailable.";
  } catch {
    return "The quantitative ranking is available, but the AI committee brief could not be refreshed. Treat every signal as research—not a prediction—and review the factor evidence before adding a paper position.";
  }
}
