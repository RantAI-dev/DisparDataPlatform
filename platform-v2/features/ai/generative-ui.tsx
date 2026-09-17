"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

/* OpenUI-style generative-UI renderer: agent emits a fenced ```ui block
 * holding a JSON array of components, rendered as interactive UI. Prose
 * outside the block is rendered as markdown. */

type Tone = "sky" | "green" | "amber" | "red" | "purple" | "dim";

interface Comp {
  type: string;
  text?: string;
  title?: string;
  tone?: Tone;
  items?: unknown[];
  columns?: string[];
  rows?: string[][];
  children?: Comp[];
  prompt?: string;
  options?: { label: string; value?: string }[];
  href?: string;
}

const TONE_VAR: Record<string, string> = {
  sky: "var(--brand-sky)",
  green: "var(--accent-green)",
  amber: "var(--accent-orange)",
  red: "var(--destructive)",
  purple: "var(--accent-purple)",
  dim: "var(--muted-foreground)",
};
const toneVar = (t?: string) => TONE_VAR[t || ""] || TONE_VAR.sky;

const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

type Segment =
  | { kind: "md"; text: string }
  | { kind: "ui"; comps: Comp[] }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "uiPartial"; text: string };

const OPEN = "```ui";

export function parseSegments(content: string): Segment[] {
  const segs: Segment[] = [];
  let idx = 0;
  while (true) {
    const open = content.indexOf(OPEN, idx);
    if (open === -1) {
      const tail = content.slice(idx);
      if (tail) segs.push({ kind: "md", text: tail });
      break;
    }
    if (open > idx) segs.push({ kind: "md", text: content.slice(idx, open) });
    const afterOpen = open + OPEN.length;
    const close = content.indexOf("```", afterOpen);
    if (close === -1) {
      segs.push({ kind: "uiPartial", text: content.slice(afterOpen).replace(/^\s*\n?/, "") });
      break;
    }
    const inner = content.slice(afterOpen, close).replace(/^\s*\n?/, "").trim();
    try {
      const parsed = JSON.parse(inner);
      segs.push({ kind: "ui", comps: Array.isArray(parsed) ? parsed : [parsed] });
    } catch {
      segs.push({ kind: "code", text: inner });
    }
    idx = close + 3;
  }
  return segs;
}

function UiComposing() {
  return (
    <div className="gu-composing">
      <span className="dots"><i /><i /><i /></span>
      Menyusun interface…
    </div>
  );
}

function Component({ c, onAction }: { c: Comp; onAction?: (value: string) => void }) {
  switch (c.type) {
    case "heading":
      return <div className="gu-heading">{asText(c.text)}</div>;
    case "text":
      return <div className="prose">{asText(c.text)}</div>;
    case "divider":
      return <hr className="gu-hr" />;
    case "card":
      return (
        <div className="gu-card" style={{ ["--gu-accent" as string]: toneVar(c.tone) } as React.CSSProperties}>
          {c.title && (
            <div className="gu-card-title">
              <span className="cdot" />
              {c.title}
            </div>
          )}
          {(c.children || []).map((child, i) => (
            <Component key={i} c={child} onAction={onAction} />
          ))}
        </div>
      );
    case "metrics":
      return (
        <div className="stat-strip">
          {(c.items || []).map((it, i) => {
            const item = it as { label?: string; value?: string; tone?: string };
            return (
              <div className="stat-cell" key={i}>
                <div className="s-fig" style={{ color: item.tone ? toneVar(item.tone) : undefined }}>
                  {asText(item.value)}
                </div>
                <div className="s-lab">{asText(item.label)}</div>
              </div>
            );
          })}
        </div>
      );
    case "keyvalue":
      return (
        <div className="kv">
          {(c.items || []).map((it, i) => {
            const item = it as { k?: string; v?: string };
            return (
              <div className="kv-row" key={i}>
                <span className="k">{asText(item.k)}</span>
                <span className="v">{asText(item.v)}</span>
              </div>
            );
          })}
        </div>
      );
    case "table":
      return (
        <table className="gu-table">
          {c.columns && c.columns.length > 0 && (
            <thead>
              <tr>
                {c.columns.map((col, i) => (
                  <th key={i}>{asText(col)}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {(c.rows || []).map((row, i) => (
              <tr key={i}>
                {(row || []).map((cell, j) => (
                  <td key={j}>{asText(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "list":
      return (
        <div className="prose">
          <ul>
            {(c.items || []).map((it, i) => (
              <li key={i}>{asText(it)}</li>
            ))}
          </ul>
        </div>
      );
    case "badges":
      return (
        <div className="chips">
          {(c.items || []).map((it, i) => {
            const item = it as { label?: string; tone?: string };
            const t = (["green", "sky", "amber", "red", "dim"] as const).includes(item.tone as never)
              ? item.tone
              : "sky";
            return (
              <span className={"badge " + t} key={i}>
                <span className="bd" /> {asText(item.label)}
              </span>
            );
          })}
        </div>
      );
    case "callout":
      return (
        <div
          className="gu-callout"
          style={{ ["--gu-accent" as string]: toneVar(c.tone) } as React.CSSProperties}
        >
          {asText(c.text)}
        </div>
      );
    case "choices":
      return (
        <div>
          {c.prompt && <div className="gu-choice-prompt">{c.prompt}</div>}
          <div className="gu-choices">
            {(c.options || []).map((o, i) => (
              <button
                key={i}
                className="cchip active"
                onClick={() => onAction?.(o.value || o.label)}
                disabled={!onAction}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    case "sparkles":
      return (
        <div className="ce-mark" style={{ width: 44, height: 44 }}>
          <Sparkles className="size-5" />
        </div>
      );
    default:
      return null;
  }
}

export function GenerativeMessage({
  content,
  onAction,
  streaming,
}: {
  content: string;
  onAction?: (value: string) => void;
  streaming?: boolean;
}) {
  const segments = React.useMemo(() => parseSegments(content), [content]);
  const lastKind = segments[segments.length - 1]?.kind;
  const showCursor = streaming && (lastKind === "md" || segments.length === 0);

  return (
    <div className="prose" style={{ position: "relative" }}>
      {segments.map((seg, i) => {
        if (seg.kind === "md") {
          return seg.text.trim() ? <Markdown key={i} text={seg.text} /> : null;
        }
        if (seg.kind === "uiPartial") {
          return streaming ? (
            <UiComposing key={i} />
          ) : (
            <pre key={i} className="code-block"><code>{seg.text}</code></pre>
          );
        }
        if (seg.kind === "code") {
          return (
            <pre key={i} className="code-block"><code>{seg.text}</code></pre>
          );
        }
        return (
          <div className="gu-wrap" key={i}>
            {seg.comps.map((c, j) => (
              <Component key={j} c={c} onAction={onAction} />
            ))}
          </div>
        );
      })}
      {showCursor && <span className="cursor" />}
    </div>
  );
}

/* =============================================================================
 * Markdown renderer — GFM-ish (tables, headings, lists, code, blockquote, hr,
 * links, bold, italic, inline code, ordered/unordered lists). Unsafe HTML is
 * stripped; we escape everything then inject tags via a small set of regex
 * rules. Good enough for LLM outputs without pulling in react-markdown.
 * ============================================================================= */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMd(s: string): string {
  let out = escapeHtml(s);
  // Inline code first to protect content
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code class="md-code">${code}</code>`);
  // Links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, text, url) =>
      `<a class="md-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );
  // Bold then italic (italic must run after bold to avoid eating **)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="md-bold">$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="md-em">$2</em>');
  return out;
}

type Table = { head: string[]; rows: string[][] };

function parseTable(headerLine: string, sepLine: string, bodyLines: string[]): Table | null {
  // Strip outer pipes then split. Using replace on /^\|/ + /\|$/ so trailing
  // and leading empty cells (from `| a | b |`) don't fail the dashes-only check.
  const stripSplit = (line: string) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const sepCells = stripSplit(sepLine);
  if (!sepCells.every((c) => /^:?-{2,}:?$/.test(c))) return null;
  const head = stripSplit(headerLine);
  const rows = bodyLines.filter((l) => l.trim().startsWith("|")).map(stripSplit);
  return { head, rows };
}

function renderTable(t: Table): string {
  const headHtml = t.head
    .map((c) => `<th class="md-th">${inlineMd(c)}</th>`)
    .join("");
  const rowsHtml = t.rows
    .map(
      (r) =>
        `<tr class="md-tr">${r
          .map((c, i) => {
            const isNum = i > 0 && /^[\d.,\s%+\-]+$/.test(c) && c.length > 0;
            return `<td class="md-td ${isNum ? "md-td-num" : ""}">${inlineMd(c)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<div class="md-table-wrap fade-up"><table class="md-table"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function Markdown({ text }: { text: string }) {
  const html = React.useMemo(() => renderMd(text), [text]);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMd(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // ---- Fenced code block ```lang ----
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const langLabel = lang
        ? `<span class="md-code-lang">${escapeHtml(lang)}</span>`
        : "";
      out.push(
        `<div class="code-block fade-up">${langLabel}<pre><code>${escapeHtml(
          body.join("\n"),
        )}</code></pre></div>`,
      );
      continue;
    }

    // ---- GFM Table ----
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
    ) {
      const headerLine = line;
      const sepLine = lines[i + 1];
      const bodyLines: string[] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        bodyLines.push(lines[i]);
        i++;
      }
      const tbl = parseTable(headerLine, sepLine, bodyLines);
      if (tbl) {
        out.push(renderTable(tbl));
      } else {
        // fall through — treat as paragraph
        out.push(`<p>${inlineMd(headerLine)}</p>`);
      }
      continue;
    }

    // ---- Headings ----
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const size =
        lvl === 1 ? "19px" : lvl === 2 ? "16px" : lvl === 3 ? "14.5px" : "14px";
      out.push(
        `<p class="md-h md-h${lvl}" style="font-size:${size};font-weight:600;margin:16px 0 8px;letter-spacing:-0.01em;line-height:1.3;">${inlineMd(h[2])}</p>`,
      );
      i++;
      continue;
    }

    // ---- Horizontal rule ----
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // ---- Blockquote ----
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="md-bq">${inlineMd(body.join(" "))}</blockquote>`);
      continue;
    }

    // ---- Unordered list ----
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        `<ul class="md-ul">${items.map((it) => `<li class="md-li">${inlineMd(it)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    // ---- Ordered list ----
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol class="md-ol">${items.map((it) => `<li class="md-li">${inlineMd(it)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    // ---- Paragraph ----
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(lines[i].trim().startsWith("|") && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || ""))
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length > 0) {
      out.push(`<p class="md-p">${inlineMd(para.join(" "))}</p>`);
    } else {
      i++;
    }
  }
  return out.join("");
}
