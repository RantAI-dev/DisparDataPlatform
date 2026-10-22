/**
 * Render komponen asli Next.js di Node untuk skrip golden portal.
 * `alias.ts` wajib sudah diimpor (stub chart/peta, rekaman memo dan state).
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerenderToNodeStream } from "react-dom/static";
import { mulaiRender } from "./alias";

/** Render sinkron komponen client; `gantiState` mengganti nilai awal useState ke-i. */
export function renderSinkron(el: ReactElement, gantiState: Record<number, unknown> = {}): string {
  mulaiRender(gantiState);
  return renderToStaticMarkup(el);
}

/** Render server component async (halaman indikator, IndicatorShell) sampai selesai. */
export async function renderAsync(el: ReactElement, gantiState: Record<number, unknown> = {}): Promise<string> {
  mulaiRender(gantiState);
  const { prelude } = await prerenderToNodeStream(el);
  let html = "";
  for await (const potong of prelude) html += potong;
  return html;
}

const ENTITAS: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** `&#39;` (desimal) dan `&#x27;` (heksadesimal, dipakai React untuk apostrof). */
function kodeKarakter(e: string): string {
  return String.fromCodePoint(e[0] === "x" || e[0] === "X" ? parseInt(e.slice(1), 16) : Number(e));
}

/** Teks markup per simpul teks, berurutan, sudah di-trim; simpul kosong dibuang. */
export function simpulTeks(html: string): string[] {
  return html
    .replace(/<!--.*?-->/gs, "")
    .split(/<[^>]+>/)
    .map((s) => s.replace(/&(#?\w+);/g, (_m, e: string) => ENTITAS[e] ?? (e.startsWith("#") ? kodeKarakter(e.slice(1)) : _m)).trim())
    .filter(Boolean);
}

/** Potongan markup tiap elemen `<a href="…">…</a>` (tidak bersarang). */
export function tautan(html: string): { href: string; html: string }[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs)].map((m) => ({ href: m[1], html: m[2] }));
}
