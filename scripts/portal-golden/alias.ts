/**
 * Alias modul dan perekam untuk skrip golden portal (SPEC §3.6 lapis 1).
 *
 * Komponen client Next.js dirender di Node. Tiga jenis modul tidak bisa dimuat di luar
 * browser, jadi diarahkan ke stub lewat `module.registerHooks` (sinkron, berlaku untuk
 * `require` dan `import`):
 *   - `echarts-for-react` → stub yang MEREKAM prop `option` (sumber angka chart);
 *   - `leaflet`, `leaflet.markercluster` → stub (peta hanya dibuat di effect);
 *   - `next/navigation` → router netral (navigasi hanya terjadi saat interaksi);
 *   - berkas `.css` → modul kosong.
 * Tipe asli paket tetap dipakai `tsc`; alias ini hanya berlaku saat skrip dijalankan.
 *
 * Selain itu `React.useMemo` dan `React.useState` dibungkus:
 *   - setiap nilai `useMemo` direkam, sehingga angka yang DIHITUNG komponen asli
 *     (stat, KPI, seri chart) bisa dibaca tanpa ditulis ulang di skrip;
 *   - nilai awal `useState` bisa diganti per urutan panggilan, sehingga komponen asli
 *     bisa dirender dalam keadaan non-default (tahun, periode, tab lain).
 * Modul ini wajib diimpor paling awal, sebelum komponen apa pun.
 */
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import React from "react";

const STUB = path.join(__dirname, "stubs");
const url = (f: string) => pathToFileURL(path.join(STUB, f)).href;

const ALIAS: Record<string, string> = {
  "echarts-for-react": url("echarts-for-react.js"),
  leaflet: url("leaflet.js"),
  "leaflet.markercluster": url("kosong.js"),
  "next/navigation": url("next-navigation.js"),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (ALIAS[specifier]) return { url: ALIAS[specifier], shortCircuit: true };
    if (specifier.endsWith(".css")) return { url: url("kosong.js"), shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

type Global = {
  React?: unknown;
  __rekamanChart?: unknown[];
};
const g = globalThis as Global;

// tsx mengompilasi berkas platform-v2 dengan JSX klasik (`React.createElement`), sedangkan
// komponen app tidak mengimpor `React` (Next.js memakai runtime otomatis).
g.React = React;

let memo: unknown[] = [];
let ganti: Record<number, unknown> = {};
let urutState = 0;
let elemen: Elemen[] = [];

/** Satu elemen komponen fungsi yang dibuat saat render (nama fungsi + props mentah). */
export type Elemen = { nama: string; props: Record<string, unknown> };

const R = React as unknown as {
  useMemo: <T>(f: () => T, d: unknown[] | undefined) => T;
  useState: <T>(awal: T | (() => T)) => [T, (v: T) => void];
  createElement: (type: unknown, props: Record<string, unknown> | null, ...anak: unknown[]) => unknown;
};
// JSX klasik platform-v2 memanggil `React.createElement` global, jadi props yang dikirim
// halaman/komponen asli ke `Kpi`, `ChartCard`, chart, dsb. bisa direkam mentah (sebelum
// diformat), tanpa menghitung ulang apa pun.
const createElementAsli = R.createElement;
R.createElement = (type, props, ...anak) => {
  const grid2 = type === "div" && typeof props?.className === "string" && props.className.includes("md:grid-cols-2");
  if (grid2 || (typeof type === "function" && /^[A-Z]/.test(type.name))) {
    const p = { ...(props ?? {}) };
    if (anak.length) p.children = anak.length === 1 ? anak[0] : anak;
    // `grid2` = wadah dua kolom; dipakai untuk membaca tata letak setengah lebar blok.
    elemen.push({ nama: grid2 ? "grid2" : (type as { name: string }).name, props: p });
  }
  return createElementAsli(type, props, ...anak);
};
const useMemoAsli = R.useMemo;
const useStateAsli = R.useState;
R.useMemo = (f, d) => {
  const v = useMemoAsli(f, d);
  memo.push(v);
  return v;
};
R.useState = (awal) => {
  const i = urutState++;
  return useStateAsli(i in ganti ? (ganti[i] as typeof awal) : awal);
};

/**
 * Siapkan satu render: kosongkan rekaman, dan (opsional) ganti nilai awal `useState`
 * ke-i (urutan panggilan dalam render itu, mulai 0).
 */
export function mulaiRender(gantiState: Record<number, unknown> = {}): void {
  memo = [];
  elemen = [];
  g.__rekamanChart = [];
  ganti = gantiState;
  urutState = 0;
}

/** Props semua elemen komponen bernama `nama` yang dibuat selama render, berurutan. */
export function propsElemen<T = Record<string, unknown>>(nama: string): T[] {
  return elemen.filter((e) => e.nama === nama).map((e) => e.props as T);
}

/** Semua elemen terekam (untuk pemeta generik, mis. kartu chart beserta anaknya). */
export function semuaElemen(): Elemen[] {
  return elemen;
}

/** Nilai `option` chart yang terekam, sesuai urutan render. */
export function rekamanChart(): EChartsOption[] {
  return (g.__rekamanChart ?? []) as EChartsOption[];
}

/** Nilai `useMemo` terekam yang berupa objek dan punya semua kunci `kunci`. */
export function memoDengan<T>(...kunci: string[]): T {
  const hit = memo.find(
    (v) => v && typeof v === "object" && !Array.isArray(v) && kunci.every((k) => k in (v as object)),
  );
  if (!hit) throw new Error(`memo dengan kunci ${kunci.join(",")} tidak terekam`);
  return hit as T;
}

/** Nilai `useMemo` terekam ke-i (urutan panggilan). */
export function memoKe<T>(i: number): T {
  if (!(i in memo)) throw new Error(`memo ke-${i} tidak terekam`);
  return memo[i] as T;
}

/** Bentuk minimal opsi ECharts yang dibaca pemeta. */
export type EChartsOption = {
  xAxis?: { data?: string[] } | { data?: string[] }[];
  yAxis?: { data?: string[] } | { data?: string[] }[];
  series?: { name?: string; type?: string; data?: unknown[] }[];
};
