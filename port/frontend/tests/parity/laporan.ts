/**
 * Reporter paritas (plan 17): membaca lampiran `paritas-hasil` tiap tes lalu menulis
 * `port/docs/paritas/laporan-<YYYY-MM-DD>.md` (tanggal WIB). HTML Playwright tetap dibuat reporter
 * `html` sebagai artefak (playwright-report/, di-gitignore).
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { FullConfig, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { AMBANG_PIKSEL, PENGECUALIAN, PRODUKSI, type HasilEkspor, type HasilParitas } from "./bantu";

type Redirect = { path: string; redirect: Record<"produksi" | "portal", { status: number; lokasi: string | null }> };
type Baris = {
  id: string;
  judul: string;
  proyek: Record<string, { status: TestResult["status"]; galat?: string; hasil?: HasilParitas | Redirect | HasilEkspor }>;
};

const persen = (r?: number) => (r === undefined ? "—" : `${(r * 100).toFixed(3)}%`);
const kb = (b: number) => `${Math.round(b / 1024).toLocaleString("id-ID")} KB`;
const PROYEK = ["desktop", "mobile"] as const;
const LEBAR: Record<string, string> = { desktop: "1440", mobile: "390" };

export default class LaporanParitas implements Reporter {
  private baris = new Map<string, Baris>();
  private folder = "";
  private mulai = new Date();

  onBegin(config: FullConfig) {
    this.folder = join(dirname(config.configFile ?? join(process.cwd(), "x")), "..", "docs", "paritas");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const proyek = test.parent.project()?.name ?? "?";
    const lampiran = result.attachments.find((a) => a.name === "paritas-hasil");
    const b = this.baris.get(test.title) ?? { id: test.title.split(" ")[0]!, judul: test.title, proyek: {} };
    // Percobaan ulang menimpa percobaan sebelumnya.
    b.proyek[proyek] = {
      status: result.status,
      galat: result.errors[0]?.message?.split("\n")[0]?.replace(/\u001b\[[0-9;]*m/g, ""),
      hasil: lampiran?.body ? JSON.parse(lampiran.body.toString()) : undefined,
    };
    if (result.status === "skipped") b.proyek[proyek].galat = result.annotations.find((a) => a.type === "skip")?.description;
    this.baris.set(test.title, b);
  }

  /** SHA portal (+ tanda berkas belum di-commit) dan versi produksi (build ID Next.js dari HTML). */
  private async versi() {
    const git = (c: string) => execSync(`git ${c}`, { cwd: this.folder.replace(/docs[/\\]paritas$/, ""), encoding: "utf8" }).trim();
    let portal = "tidak terbaca";
    try {
      const kotor = git("status --porcelain -- .").split("\n").filter(Boolean).length;
      portal = `\`${git("rev-parse --short HEAD")}\` (${git("rev-parse --abbrev-ref HEAD")})${kotor ? ` + ${kotor} berkas belum di-commit` : ""}`;
    } catch {
      /* bukan repo git */
    }
    let produksi = "build ID tidak terbaca";
    try {
      const html = await (await fetch(PRODUKSI)).text();
      // App Router: build ID ada di payload RSC sebagai "b":"<id>" (di HTML ter-escape \").
      const id = html.match(/\\?"b\\?":\\?"([A-Za-z0-9_-]{8,})/)?.[1];
      if (id) produksi = `build ID Next.js \`${id}\``;
    } catch {
      /* produksi tak terjangkau */
    }
    // Waktu portal:sinkron terakhir dari riwayat job (butuh token admin; tanpa itu dicatat tidak terbaca).
    let sinkron = "tidak terbaca (PARITAS_LARAVEL_URL/PARITAS_ADMIN_TOKEN tidak diisi)";
    const url = process.env.PARITAS_LARAVEL_URL, token = process.env.PARITAS_ADMIN_TOKEN;
    if (url && token) {
      try {
        const j = await (await fetch(`${url}/api/v1/sistem/job`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })).json();
        const daftar: { job: string; status: string; mulai: string; selesai: string | null; ringkasan: unknown }[] = Array.isArray(j.data) ? j.data : (j.data?.items ?? []);
        const s = daftar.find((x) => /sinkron/.test(x.job));
        sinkron = s ? `${s.selesai ?? s.mulai} (status ${s.status}, ${JSON.stringify(s.ringkasan)})` : "tidak ada riwayat sinkron";
      } catch (e) {
        sinkron = `tidak terbaca (${String(e)})`;
      }
    }
    return { portal, produksi, sinkron };
  }

  async onEnd() {
    const v = await this.versi();
    const tanggal = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(this.mulai);
    const jam = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", timeStyle: "short" }).format(this.mulai);
    const semua = [...this.baris.values()];
    const halaman = semua.filter((b) => !/^(RD|IX|EK)-/.test(b.id));
    const ekspor = semua.filter((b) => b.id.startsWith("EK-"));
    const interaksi = semua.filter((b) => b.id.startsWith("IX-"));
    const redirect = semua.filter((b) => b.id.startsWith("RD-"));

    const hitung = (daftar: Baris[]) => {
      let lulus = 0, gagal = 0, lewat = 0;
      for (const b of daftar) for (const p of Object.values(b.proyek)) {
        if (p.status === "passed") lulus++;
        else if (p.status === "skipped") lewat++;
        else gagal++;
      }
      return `${lulus} lulus, ${gagal} gagal, ${lewat} dilewati`;
    };

    const status = (b: Baris) => {
      const gagal = PROYEK.filter((p) => b.proyek[p] && !["passed", "skipped"].includes(b.proyek[p]!.status));
      const lewat = PROYEK.filter((p) => b.proyek[p]?.status === "skipped");
      if (gagal.length) return `**gagal** (${gagal.map((p) => LEBAR[p]).join(", ")})`;
      if (lewat.length) return `lulus; ${lewat.map((p) => LEBAR[p]).join(", ")} dilewati: ${b.proyek[lewat[0]!]!.galat ?? ""}`;
      return "lulus";
    };

    const tabelHalaman = (daftar: Baris[]) => {
      const out = ["| ID | Rute | Piksel 1440 | Piksel 390 | Angka 1440 / 390 | Hasil | Pengecualian |", "|---|---|---|---|---|---|---|"];
      for (const b of daftar) {
        const h = (p: string) => b.proyek[p]?.hasil as HasilParitas | undefined;
        const angka = PROYEK.map((p) => (h(p) ? (h(p)!.angkaSama ? "sama" : "**beda**") : "—")).join(" / ");
        const pengecualian = [...new Set(PROYEK.flatMap((p) => h(p)?.pengecualian ?? []))].join(", ") || "—";
        const path = h("desktop")?.path ?? h("mobile")?.path ?? b.judul.split(" ")[1];
        out.push(`| ${b.id} | \`${path}\`${b.id.startsWith("IX-") ? ` — ${b.judul.split(" — ")[1] ?? ""}` : ""} | ${persen(h("desktop")?.rasioPiksel)} | ${persen(h("mobile")?.rasioPiksel)} | ${angka} | ${status(b)} | ${pengecualian} |`);
      }
      return out.join("\n");
    };

    const rincianGagal = semua.flatMap((b) =>
      PROYEK.filter((p) => b.proyek[p] && !["passed", "skipped"].includes(b.proyek[p]!.status)).map((p) => {
        const x = b.proyek[p]!;
        const ek = (x.hasil as HasilEkspor | undefined)?.ekspor;
        if (ek) return `- ${b.judul} @${LEBAR[p]}: nama ${ek.namaProduksi} vs ${ek.namaPortal}; header ${ek.headerSama ? "sama" : "beda"}; baris ${ek.barisProduksi} vs ${ek.barisPortal}; sel beda ${ek.selBeda} (tanpa urutan ${ek.selBedaTanpaUrutan}). ${ek.contoh.join("; ")}`;
        const h = x.hasil as HasilParitas | undefined;
        const angka = h && h.angkaSama === false ? ` Angka hanya di produksi: ${h.angkaHanyaProduksi.join(" ") || "—"}; hanya di portal: ${h.angkaHanyaPortal.join(" ") || "—"}.` : "";
        return `- ${b.judul} @${LEBAR[p]}: ${x.galat ?? x.status}.${angka}`;
      }),
    );

    const tabelRedirect = ["| ID | Dari | Produksi | Portal | Hasil |", "|---|---|---|---|---|"];
    for (const b of redirect) {
      const h = (b.proyek.desktop?.hasil ?? b.proyek.mobile?.hasil) as Redirect | undefined;
      const f = (s?: { status: number; lokasi: string | null }) => (s ? `${s.status}${s.lokasi ? ` → \`${s.lokasi}\`` : ""}` : "—");
      tabelRedirect.push(`| ${b.id} | \`${h?.path ?? b.judul.split(" ")[1]}\` | ${f(h?.redirect.produksi)} | ${f(h?.redirect.portal)} | ${status(b)} |`);
    }

    const tabelEkspor = ["| ID | Halaman — berkas | Nama (produksi / portal) | BOM | Header | Baris produksi / portal | Sel beda (posisi / tanpa urutan) | Hasil | Pengecualian |", "|---|---|---|---|---|---|---|---|---|"];
    for (const b of ekspor) {
      const e = (b.proyek.desktop?.hasil as HasilEkspor | undefined)?.ekspor;
      const sama = (x?: boolean) => (x === undefined ? "—" : x ? "sama" : "**beda**");
      tabelEkspor.push(`| ${b.id} | ${b.judul.split(" ").slice(1).join(" ")} | ${e ? `\`${e.namaProduksi}\` / \`${e.namaPortal}\`` : "—"} | ${sama(e?.bomSama)} | ${sama(e?.headerSama)} | ${e ? `${e.barisProduksi} / ${e.barisPortal}` : "—"} | ${e ? `${e.selBeda} / ${e.selBedaTanpaUrutan}` : "—"} | ${status(b)} | ${(b.proyek.desktop?.hasil as HasilEkspor | undefined)?.pengecualian?.join(", ") || "—"} |`);
    }

    const tabelPerf = ["| ID | Rute | Lebar | LCP produksi | LCP portal | Transfer produksi | Transfer portal | > 2× |", "|---|---|---|---|---|---|---|---|"];
    const lambat: string[] = [];
    for (const b of [...halaman, ...interaksi]) for (const p of PROYEK) {
      const h = b.proyek[p]?.hasil as HasilParitas | undefined;
      if (!h) continue;
      const { produksi: a, portal: o } = h.perf;
      const tanda = [o.lcpMs > 2 * a.lcpMs ? "LCP" : "", o.transferByte > 2 * a.transferByte ? "transfer" : ""].filter(Boolean).join(", ");
      if (tanda) lambat.push(`${b.id} \`${h.path}\` @${LEBAR[p]} (${tanda})`);
      tabelPerf.push(`| ${b.id} | \`${h.path}\` | ${LEBAR[p]} | ${a.lcpMs} ms | ${o.lcpMs} ms | ${kb(a.transferByte)} | ${kb(o.transferByte)} | ${tanda ? `**${tanda}**` : ""} |`);
    }

    const md = `# Laporan paritas portal — ${tanggal}

Dibangkitkan otomatis oleh \`frontend/tests/parity/laporan.ts\` dari \`npm run paritas\` (mulai ${jam} WIB).

- Portal: ${v.portal}.
- Produksi: \`${PRODUKSI}\` pada ${tanggal} ${jam} WIB, ${v.produksi}.
- \`portal:sinkron\` terakhir sebelum run: ${v.sinkron}.

Pembanding: produksi \`${PRODUKSI}\`. Definisi lulus (SPEC §7): beda piksel ≤ ${AMBANG_PIKSEL * 100}% per halaman
pada 1440×900 dan 390×844, himpunan angka DOM identik (kecuali whitelist P4), interaksi lulus. Tangkapan
produksi, portal, dan peta beda ada di HTML Playwright (\`frontend/playwright-report/parity/\`, artefak).

Pengecualian yang diizinkan hanya P1–P5 dan item Nav "AI"/"Jakpar AI" (SPEC §5.4–5.5). Tile peta
Leaflet dan iframe Google Maps selalu di-mask (SPEC §7.1). Label di kolom "Pengecualian":

${Object.entries(PENGECUALIAN).map(([k, a]) => `- **${k}**: ${a}`).join("\n")}

## Ringkasan

- Halaman: ${hitung(halaman)} (rute × lebar).
- Interaksi: ${hitung(interaksi)}.
- Redirect: ${hitung(redirect)}.
- Ekspor: ${hitung(ekspor)} (hanya desktop; isi berkas tidak bergantung lebar).
- Performa lebih dari 2× produksi: ${lambat.length ? lambat.length : "tidak ada"}.

${rincianGagal.length ? `### Gagal ambang (menunggu persetujuan pemilik di PR)\n\n${rincianGagal.join("\n")}\n` : "Semua rute lulus ambang.\n"}
## Halaman

${tabelHalaman(halaman)}

## Interaksi

${tabelHalaman(interaksi)}

## Ekspor

Isi berkas unduhan produksi vs portal: pola nama (tanggal unduh disamakan), BOM, header kolom, jumlah
baris, dan isi tiap sel. "Tanpa urutan" = sel beda setelah baris diurutkan (0 berarti isi sama dan
hanya urutan baris yang berbeda).

${tabelEkspor.join("\n")}

## Redirect lama

${tabelRedirect.join("\n")}

## Performa (dicatat, bukan gate)

LCP = \`largest-contentful-paint\` terakhir (PerformanceObserver) saat halaman tenang; transfer = jumlah
header + body ter-encode semua respons (Playwright \`request.sizes()\`), cache dingin. Produksi dibuka
lewat internet (Cloudflare), portal di mesin lokal, keduanya serentak; angka hanya untuk membandingkan
orde besaran.${lambat.length ? `\n\nLebih dari 2× produksi: ${lambat.join("; ")}.` : ""}

${tabelPerf.join("\n")}
`;
    mkdirSync(this.folder, { recursive: true });
    const berkas = join(this.folder, `laporan-${tanggal}.md`);
    writeFileSync(berkas, md);
    console.log(`Laporan paritas: ${relative(process.cwd(), berkas)}`);
  }
}
