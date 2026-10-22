import { runAgent, type AgentEvent, type AiMode, type HistoryMsg } from "@/lib/ai/agent";
import { llmConfigured } from "@/lib/ai/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Info model untuk UI (tanpa membocorkan key). */
export async function GET() {
  const c = llmConfigured();
  return Response.json({ model: c.model, configured: c.hasKey });
}

/**
 * POST {mode: "ask"|"bi", messages: [{role, content, queries?}]}
 * → stream NDJSON, satu AgentEvent per baris, diakhiri {type:"done"} atau {type:"error"}.
 */
export async function POST(req: Request) {
  let body: { mode?: string; messages?: HistoryMsg[]; session?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON {mode, messages}" }, { status: 400 });
  }
  const mode: AiMode = body.mode === "bi" ? "bi" : "ask";
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
      queries: Array.isArray(m.queries) ? m.queries.map(String).slice(0, 4) : undefined,
    }));
  if (!history.length || history[history.length - 1].role !== "user" || !history[history.length - 1].content.trim())
    return Response.json({ error: "Pesan terakhir harus pertanyaan user" }, { status: 400 });

  // ID sesi dari browser (satu per percakapan); dibersihkan supaya aman jadi header.
  const session = typeof body.session === "string" ? body.session.replace(/[^\w-]/g, "").slice(0, 64) : undefined;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent | { type: "error"; message: string }) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* klien sudah putus */
        }
      };
      // Cloudflare memutus koneksi yang diam >100 dtk; kirim ping selama LLM berpikir.
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode('{"type":"ping"}\n'));
        } catch {
          /* klien sudah putus */
        }
      }, 15000);
      try {
        await runAgent({ mode, history, signal: req.signal, session }, send);
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* sudah tertutup */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
