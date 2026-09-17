import { NextResponse } from "next/server";
import { q } from "@/lib/ch/client";
import { chat } from "@/lib/ai/llm";
import { schemaContext } from "@/lib/ai/schema-context";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SYSTEM = `Kamu ahli SQL ClickHouse untuk lakehouse pariwisata DKI Jakarta.
Ubah pertanyaan pengguna jadi SATU query SELECT ClickHouse yang valid.
Aturan:
- HANYA gunakan tabel/kolom dari skema yang diberikan. Jangan mengarang.
- Utamakan tabel serving.mart_* untuk agregasi.
- Selalu SELECT (baca saja). Jangan INSERT/ALTER/DROP.
- Batasi hasil dengan LIMIT wajar (<=100) kecuali diminta lain.
- Balas HANYA JSON valid: {"sql": "...", "explanation": "...", "assumptions": ["..."]}`;

const REPAIR_SYSTEM = `Kamu ahli SQL ClickHouse untuk lakehouse pariwisata DKI Jakarta.
Tugasmu: PERBAIKI query SQL yang sebelumnya GAGAL dijalankan di ClickHouse.
Gunakan pesan error + skema untuk menemukan kolom/tabel yang benar (mis. nama
kolom 'tahun' mungkin sebenarnya 'periode' atau 'tahun_data'; cek tipe & ejaan).
Jangan mengubah tujuan query — hanya perbaiki agar bisa dieksekusi.
Aturan:
- HANYA gunakan tabel/kolom dari skema yang diberikan. Jangan mengarang.
- Utamakan tabel serving.mart_* untuk agregasi.
- Selalu SELECT (baca saja). Jangan INSERT/ALTER/DROP.
- Batasi hasil dengan LIMIT wajar (<=100) kecuali diminta lain.
- Balas HANYA JSON valid: {"sql": "...", "explanation": "...", "assumptions": ["..."]}`;

function extractJson(text: string): { sql: string; explanation: string; assumptions: string[] } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (typeof o.sql === "string") {
      return {
        sql: o.sql.trim(),
        explanation: String(o.explanation ?? ""),
        assumptions: Array.isArray(o.assumptions) ? o.assumptions.map(String) : [],
      };
    }
  } catch { /* not JSON */ }
  return null;
}

function isSafeSelect(sql: string): boolean {
  return (
    /^\s*(with|select)\b/i.test(sql) &&
    !/\b(insert|alter|drop|delete|update|create|truncate|attach|detach|rename|grant|revoke)\b/i.test(sql)
  );
}

export async function POST(req: Request) {
  // `run` boleh di body atau di query string (?run=true) — biar kompatibel.
  const url = new URL(req.url);
  let question = "";
  let run = url.searchParams.get("run") === "true";
  try {
    const body = await req.json();
    question = String(body.question ?? "");
    if (typeof body.run === "boolean") run = body.run;
  } catch {
    return NextResponse.json({ error: "Body harus JSON {question, run?}" }, { status: 400 });
  }
  if (!question.trim()) return NextResponse.json({ error: "question wajib" }, { status: 400 });

  let schema: string;
  try {
    schema = await schemaContext();
  } catch (e) {
    return NextResponse.json({ error: `Gagal baca skema: ${e}` }, { status: 503 });
  }

  /* ---------- 1) Generate initial SQL ---------- */
  let out: { sql: string; explanation: string; assumptions: string[] } | null = null;
  let llmError: string | null = null;
  try {
    const content = await chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `SKEMA:\n${schema}\n\nPERTANYAAN: ${question}` },
      ],
      { signal: req.signal, temperature: 0 },
    );
    out = extractJson(content);
    if (!out) llmError = "LLM tak mengembalikan JSON SQL yang valid.";
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
  }

  if (!out) {
    return NextResponse.json(
      { error: "Agent LLM tak tersedia", detail: llmError },
      { status: 503 },
    );
  }

  /* ---------- 2) Static guard: SELECT-only ---------- */
  if (!isSafeSelect(out.sql)) {
    return NextResponse.json(
      { ...out, error: "SQL ditolak (hanya SELECT diizinkan)." },
      { status: 422 },
    );
  }

  const repairLog: { attempt: number; sql: string; error: string; fixed?: boolean }[] = [];
  const MAX_REPAIR_ATTEMPTS = 2;

  /* ---------- 3) Run SQL; on failure, self-repair ---------- */
  if (run) {
    let attempt = 0;
    let currentSql = out.sql;
    let explanation = out.explanation;
    let assumptions = out.assumptions;
    let currentRows: Record<string, unknown>[] | null = null;
    let currentRunError: string | null = null;
    let repaired = false;

    while (attempt <= MAX_REPAIR_ATTEMPTS) {
      try {
        currentRows = await q<Record<string, unknown>>(currentSql);
        currentRunError = null;
        break;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        currentRunError = errMsg;
        repairLog.push({ attempt: attempt + 1, sql: currentSql, error: errMsg });

        // Try to repair
        if (attempt >= MAX_REPAIR_ATTEMPTS) break;

        try {
          const repairContent = await chat(
            [
              { role: "system", content: REPAIR_SYSTEM },
              {
                role: "user",
                content:
                  `SKEMA:\n${schema}\n\n` +
                  `PERTANYAAN ASAL: ${question}\n\n` +
                  `SQL GAGAL (percobaan ${attempt + 1}):\n${currentSql}\n\n` +
                  `ERROR DARI CLICKHOUSE:\n${errMsg}\n\n` +
                  `Perbaiki SQL di atas agar berjalan. Balas JSON {"sql","explanation","assumptions"}.`,
              },
            ],
            { signal: req.signal, temperature: 0 },
          );
          const fixed = extractJson(repairContent);
          if (
            fixed &&
            isSafeSelect(fixed.sql) &&
            fixed.sql.trim().toLowerCase() !== currentSql.trim().toLowerCase()
          ) {
            currentSql = fixed.sql;
            explanation = fixed.explanation || explanation;
            assumptions = fixed.assumptions?.length ? fixed.assumptions : assumptions;
            repaired = true;
            repairLog[repairLog.length - 1].fixed = true;
          } else {
            // No improvement possible — stop trying.
            break;
          }
        } catch (repairEx) {
          // Repair call itself failed — give up gracefully.
          repairLog.push({
            attempt: attempt + 1,
            sql: "(repair call failed)",
            error: repairEx instanceof Error ? repairEx.message : String(repairEx),
          });
          break;
        }
        attempt++;
      }
    }

    // Build the final response. If we have rows, success. Otherwise error.
    const resp: Record<string, unknown> = {
      sql: currentSql,
      explanation,
      assumptions,
      repaired,
      repairAttempts: repairLog.length,
      repairLog,
    };
    if (currentRows) {
      resp.rows = currentRows;
      resp.rowCount = currentRows.length;
      resp.columns = currentRows.length > 0 ? Object.keys(currentRows[0]) : [];
    }
    if (currentRunError && !currentRows) {
      resp.runError = currentRunError;
    }
    return NextResponse.json(resp);
  }

  // run=false — just return the generated SQL without executing.
  return NextResponse.json(out);
}
