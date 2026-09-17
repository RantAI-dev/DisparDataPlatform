const LLM_URL = process.env.LLM_URL ?? "https://api.minimax.io/v1";
const LLM_MODEL = process.env.LLM_MODEL ?? "Minimax-M2.7";
const LLM_KEY = process.env.LLM_KEY ?? process.env.MINIMAX_API_KEY ?? "";

export type LlmMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export async function chat(
  messages: { role: string; content: string }[],
  opts: { signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${LLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: opts.temperature ?? 0,
      max_tokens: 1200,
      stream: false,
    }),
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const msg = json?.choices?.[0]?.message;
  if (!msg) throw new Error("LLM returned no message");
  let content: string = msg.content ?? "";
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!content && typeof msg.reasoning_content === "string") {
    content = msg.reasoning_content;
  }
  return content;
}

export function llmConfigured(): { url: string; model: string } {
  return { url: LLM_URL, model: LLM_MODEL };
}
