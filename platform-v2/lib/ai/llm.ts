/**
 * Klien LLM OpenAI-compatible (chat/completions).
 *
 * Default-nya langganan OpenCode Go + DeepSeek V4.1 Flash. Go mewajibkan header
 * `x-opencode-session` (stabil per percakapan, untuk routing & prompt caching) dan
 * User-Agent yang menamai klien. Untuk OpenCode Zen (bayar per pakai) set
 * LLM_URL=https://opencode.ai/zen/v1. Provider lain yang OpenAI-compatible
 * (MiniMax, llm-node lokal) tetap jalan cukup dengan mengganti LLM_URL/LLM_MODEL.
 */
const LLM_URL = (process.env.LLM_URL ?? "https://opencode.ai/inference/go/openai/v1").replace(/\/+$/, "");
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-v4.1-flash";
const USER_AGENT = "dispar-atlas/1.0 (+https://dispar.rantai.dev)";
const LLM_KEY = process.env.LLM_KEY ?? process.env.OPENCODE_API_KEY ?? process.env.MINIMAX_API_KEY ?? "";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type LlmReply = {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const RETRY_DELAYS = [1500, 4000];

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

async function post(body: Record<string, unknown>, signal?: AbortSignal, session?: string): Promise<Record<string, unknown>> {
  if (!LLM_KEY) throw new Error("LLM_KEY belum di-set di environment server");
  let lastErr = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${LLM_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_KEY}`,
          "User-Agent": USER_AGENT,
          "x-opencode-session": session || `atlas-${Date.now().toString(36)}`,
        },
        body: JSON.stringify(body),
        signal,
        cache: "no-store",
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt], signal);
      continue;
    }
    if (res.ok) return (await res.json()) as Record<string, unknown>;
    lastErr = `LLM ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!RETRY_STATUS.has(res.status) || attempt >= RETRY_DELAYS.length) break;
    await sleep(RETRY_DELAYS[attempt], signal);
  }
  throw new Error(lastErr);
}

/** Pisahkan blok <think>…</think> dari jawaban. */
function splitThink(text: string): { content: string; reasoning: string } {
  const parts: string[] = [];
  const content = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_, r: string) => {
    parts.push(r.trim());
    return "";
  });
  return { content: content.trim(), reasoning: parts.join("\n") };
}

/** Satu putaran chat dengan tool calling. */
export async function chatWithTools(
  messages: LlmMessage[],
  tools: ToolDef[],
  opts: { signal?: AbortSignal; temperature?: number; maxTokens?: number; session?: string } = {},
): Promise<LlmReply> {
  const json = await post(
    {
      model: LLM_MODEL,
      messages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 4096,
      stream: false,
    },
    opts.signal,
    opts.session,
  );
  const choices = json.choices as { message?: Record<string, unknown> }[] | undefined;
  const msg = choices?.[0]?.message;
  if (!msg) throw new Error("LLM tidak mengembalikan pesan");
  const { content, reasoning } = splitThink(typeof msg.content === "string" ? msg.content : "");
  const rc = typeof msg.reasoning_content === "string" ? msg.reasoning_content : "";
  const toolCalls = Array.isArray(msg.tool_calls)
    ? (msg.tool_calls as ToolCall[]).filter((t) => t?.function?.name)
    : [];
  return {
    content,
    reasoning: [rc, reasoning].filter(Boolean).join("\n"),
    toolCalls,
    usage: json.usage as LlmReply["usage"],
  };
}

/** Chat sederhana tanpa tool (dipakai /api/ai/ask & /api/ai/text-to-sql). */
export async function chat(
  messages: { role: string; content: string }[],
  opts: { signal?: AbortSignal; temperature?: number } = {},
): Promise<string> {
  const reply = await chatWithTools(messages as LlmMessage[], [], {
    signal: opts.signal,
    temperature: opts.temperature ?? 0,
    maxTokens: 1200,
  });
  return reply.content || reply.reasoning;
}

export function llmConfigured(): { url: string; model: string; hasKey: boolean } {
  return { url: LLM_URL, model: LLM_MODEL, hasKey: !!LLM_KEY };
}
