/** Logika murni tampilan indikator (diuji Vitest unit). */
import { WARNA_BATANG_SETENGAH } from "../constants";
import type { Blok } from "../composables/useIndikator";

export type KelompokBlok = { full?: Blok; half?: { blok: Blok; warna?: string }[] };

/**
 * Blok berurutan; blok setengah lebar yang berurutan digabung dalam satu grid dua kolom. Batang
 * setengah lebar ke-1 dan ke-2 berwarna hijau lalu kuning (BaMice/CiIc/CiHr/CiNl v2).
 */
export function kelompokkanBlok(blocks: Blok[]): KelompokBlok[] {
  const hasil: KelompokBlok[] = [];
  for (const b of blocks) {
    if (b.layout !== "half") {
      hasil.push({ full: b });
      continue;
    }
    let g = hasil[hasil.length - 1];
    if (!g?.half) hasil.push((g = { half: [] }));
    const nBatang = g.half!.filter((x) => x.blok.type === "bar").length;
    g.half!.push({ blok: b, warna: b.type === "bar" ? WARNA_BATANG_SETENGAH[nBatang] : undefined });
  }
  return hasil;
}

/** Sel peringkat "Drake ✓ · Kanada" → nama artis, sudah tampil di Jakarta, negara. */
export function uraiSelArtis(teks: string): { artis: string; ceklis: boolean; negara: string | null } {
  const [kiri, ...negara] = teks.split(" · ");
  const ceklis = kiri!.endsWith(" ✓");
  return { artis: ceklis ? kiri!.slice(0, -2) : kiri!, ceklis, negara: negara.join(" · ") || null };
}
