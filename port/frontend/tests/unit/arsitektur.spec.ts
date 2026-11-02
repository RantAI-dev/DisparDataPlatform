// Aturan pemisahan frontend (SPEC §5.3): pages tanpa $fetch/useFetch, dan ESLint menolak impor
// antar-layer — dibuktikan dengan layer palsu di folder sementara (mutation check).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
import { aturanLayer } from "../../eslint.config.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function semuaBerkas(dir: string): string[] {
  let out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    out = statSync(p).isDirectory() ? out.concat(semuaBerkas(p)) : out.concat(p);
  }
  return out;
}

/** Berkas di `layers/<x>/pages/**` yang memanggil $fetch/useFetch (harus lewat composable fitur). */
function pemanggilLangsung(root: string): string[] {
  const layers = join(root, "layers");
  return readdirSync(layers)
    .map((l) => join(layers, l, "pages"))
    .filter((p) => statSync(p, { throwIfNoEntry: false })?.isDirectory())
    .flatMap(semuaBerkas)
    .filter((f) => /\.(vue|ts)$/.test(f) && /\$fetch\b|\buseFetch\b|\buseLazyFetch\b/.test(readFileSync(f, "utf8")))
    .map((f) => relative(root, f));
}

const tmp = mkdtempSync(join(tmpdir(), "arsitektur-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
function tulis(rel: string, isi: string) {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), isi);
}

describe("arsitektur frontend", () => {
  it("halaman di layer tidak memanggil $fetch/useFetch", () => {
    expect(pemanggilLangsung(ROOT)).toEqual([]);
  });

  it("pemindai pages benar-benar menangkap $fetch/useFetch (mutation check)", () => {
    tulis("layers/dataset/pages/sdi.vue", "<script setup>const d = await useFetch('/x')</script>");
    tulis("layers/dataset/pages/ok.vue", "<script setup>const d = await useDataset()</script>");
    tulis("layers/atlas/pages/x.ts", "export default () => $fetch('/y')");
    expect(pemanggilLangsung(tmp).sort()).toEqual(["layers/atlas/pages/x.ts", "layers/dataset/pages/sdi.vue"]);
  });

  it("ESLint menolak impor fitur→fitur dan shared→fitur, lewat path relatif maupun alias", async () => {
    tulis(".nuxt/tsconfig.app.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "#layers/*": ["../layers/*"] } } }));
    tulis("layers/shared/utils/a.ts", "import { b } from '../../dataset/utils/b';\nexport const a = b;\n");
    tulis("layers/dataset/utils/b.ts", "export const b = 1;\n");
    tulis("layers/dataset/utils/c.ts", "import { d } from '#layers/atlas/utils/d';\nexport const c = d;\n");
    tulis("layers/atlas/utils/d.ts", "export const d = 1;\n");
    tulis("layers/atlas/components/K.vue", "<script setup lang=\"ts\">\nimport { b } from '../../dataset/utils/b';\nconst x = b;\n</script>\n<template><i>{{ x }}</i></template>\n");
    tulis("layers/dataset/utils/ok.ts", "import { e } from '../../shared/utils/e';\nimport { b } from './b';\nexport const ok = e + b;\n");
    tulis("layers/shared/utils/e.ts", "export const e = 1;\n");

    const eslint = new ESLint({ cwd: tmp, overrideConfigFile: true, overrideConfig: [aturanLayer(tmp)] });
    const hasil = await eslint.lintFiles(["layers/**/*.{ts,vue}"]);
    const galat = Object.fromEntries(
      hasil.filter((r) => r.errorCount).map((r) => [relative(tmp, r.filePath), r.messages.map((m) => m.ruleId)]),
    );
    expect(galat).toEqual({
      "layers/shared/utils/a.ts": ["import/no-restricted-paths"],
      "layers/dataset/utils/c.ts": ["import/no-restricted-paths"],
      "layers/atlas/components/K.vue": ["import/no-restricted-paths"],
    });
  }, 30_000);
});
