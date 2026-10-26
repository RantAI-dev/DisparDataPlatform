"use client";

import { useState } from "react";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { VerticalBars } from "@/components/charts/VerticalBars";
import type { DestinasiRow } from "@/lib/dashboard/data";
import { BULAN, ModeToggle, idNum } from "./Kit";

const SEMUA = "Semua destinasi";
const NAMA = { Wisnus: "wisatawan nusantara", Wisman: "wisatawan mancanegara" } as const;

type Ringkas = { destinasi: string; jumlah: number; bulan: number };

/**
 * Kunjungan satu jenis wisatawan ke destinasi wisata (SDI Disparekraf); halaman wisnus dan
 * wisman masing-masing memakai jenisnya. Bulan tanpa angka = tidak dilaporkan pengelola, bukan
 * nol. Tahun berjalan parsial dan tidak semua destinasi melapor tiap bulan, jadi tidak
 * ditampilkan persentase pertumbuhan.
 */
export function DestinasiStat({ rows: semua, jenis }: { rows: DestinasiRow[]; jenis: DestinasiRow["jenis"] }) {
  const rows = semua.filter((r) => r.jenis === jenis && r.jumlah != null);
  const years = [...new Set(rows.map((r) => r.tahun))].sort();
  const bulanTahun = (y: string) => new Set(rows.filter((r) => r.tahun === y).map((r) => r.bulan));
  const [year, setYear] = useState(years.filter((y) => bulanTahun(y).size === 12).pop() ?? years[years.length - 1] ?? "");
  const [dest, setDest] = useState(SEMUA);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Data kunjungan {NAMA[jenis]} ke destinasi wisata belum dapat ditampilkan. Coba muat ulang halaman.
      </div>
    );
  }

  const nama = NAMA[jenis];
  // Destinasi yang ada di sumber tetapi tak pernah melaporkan jenis ini (mis. wisman di Ancol/TMII).
  const destList = [...new Set(rows.map((r) => r.destinasi))].sort();
  const tanpaLapor = [...new Set(semua.map((r) => r.destinasi))].filter((d) => !destList.includes(d)).sort();
  const yLabel = (y: string) => {
    const b = bulanTahun(y);
    return b.size < 12 ? `${y} (s/d ${BULAN[Math.max(...b) - 1]})` : y;
  };

  const perDest: Ringkas[] = destList
    .map((d) => {
      const own = rows.filter((r) => r.tahun === year && r.destinasi === d);
      return { destinasi: d, jumlah: own.reduce((a, r) => a + (r.jumlah ?? 0), 0), bulan: new Set(own.map((r) => r.bulan)).size };
    })
    .filter((r) => r.bulan > 0)
    .sort((a, b) => b.jumlah - a.jumlah);
  const total = perDest.reduce((a, r) => a + r.jumlah, 0);
  const pilih = dest === SEMUA ? null : perDest.find((r) => r.destinasi === dest) ?? null;
  const peringkat = pilih ? perDest.indexOf(pilih) + 1 : 0;

  // Deret bulanan seluruh periode; bulan tanpa angka dilaporkan tidak digambar (bukan nol).
  const bulanan = () => {
    const m = new Map<string, number>();
    for (const r of rows) if (dest === SEMUA || r.destinasi === dest) m.set(r.periode, (m.get(r.periode) ?? 0) + (r.jumlah ?? 0));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
  };
  const labelBulan = (periode: string) => {
    const [y, m] = periode.split("-");
    return `${BULAN[Number(m) - 1] ?? m} ${y}`;
  };

  // Bulan ketika wisman > wisnus di destinasi yang di hampir semua bulan lain didominasi wisnus:
  // pola angka yang diduga tertukar di sumber. Ditampilkan apa adanya dengan catatan; catatan
  // hilang sendiri bila sumber sudah dibetulkan.
  const tertukar = destList.flatMap((d) => {
    const own = semua.filter((r) => r.destinasi === d && r.jumlah != null);
    const pasangan = [...new Set(own.map((r) => r.periode))].flatMap((p) => {
      const wn = own.find((r) => r.periode === p && r.jenis === "Wisnus")?.jumlah;
      const wm = own.find((r) => r.periode === p && r.jenis === "Wisman")?.jumlah;
      return wn != null && wm != null ? [{ destinasi: d, periode: p, wn, wm }] : [];
    });
    const janggal = pasangan.filter((x) => x.wm > x.wn);
    if (janggal.length * 4 > pasangan.length) return []; // wisman memang sering dominan: bukan anomali
    return janggal.filter((x) => x.periode.startsWith(year));
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Tahun</span>
        <ModeToggle value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: yLabel(y) }))} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Destinasi</span>
        <select
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm"
        >
          {[SEMUA, ...destList].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <KpiRow>
        <Kpi
          label={`Kunjungan ${nama} · ${yLabel(year)}`}
          value={pilih ? pilih.jumlah : dest === SEMUA ? total : "—"}
          sub={pilih ? `${pilih.bulan} bulan dilaporkan` : dest === SEMUA ? "kunjungan" : "tidak dilaporkan di tahun ini"}
        />
        {pilih ? (
          <>
            <Kpi label="Porsi dari seluruh destinasi" value={total ? `${idNum((pilih.jumlah / total) * 100, 1)}%` : "—"} sub={yLabel(year)} />
            <Kpi label="Peringkat kunjungan" value={`${peringkat} dari ${perDest.length}`} sub={yLabel(year)} />
          </>
        ) : (
          <>
            <Kpi label="Destinasi melapor" value={`${perDest.length} dari ${destList.length + tanpaLapor.length}`} sub={yLabel(year)} />
            <Kpi label="Destinasi teramai" value={perDest[0]?.destinasi ?? "—"} sub={perDest[0] ? `${idNum(perDest[0].jumlah)} kunjungan` : undefined} />
          </>
        )}
      </KpiRow>
      {tanpaLapor.length > 0 && (
        <p className="mt-2 apple-fine text-ink-muted-48">
          Tidak melaporkan kunjungan {nama}: {tanpaLapor.join(", ")}. Total di atas tidak memuat destinasi tersebut.
        </p>
      )}
      {tertukar.length > 0 && (
        <p className="mt-2 apple-fine text-ink-muted-80">
          <span className="font-semibold">Catatan data:</span> angka nusantara dan mancanegara diduga tertukar di sumber
          untuk{" "}
          {tertukar
            .map((x) => `${x.destinasi} ${labelBulan(x.periode)} (nusantara ${idNum(x.wn)}, mancanegara ${idNum(x.wm)})`)
            .join("; ")}
          . Angka ditampilkan apa adanya sesuai Satu Data Jakarta.
        </p>
      )}

      <div className="mt-4">
        <ChartGrid cols={2}>
          <ChartCard title={`Kunjungan ${nama} per destinasi · ${yLabel(year)}`} sub="kunjungan">
            <BarBreakdown data={perDest.map((r) => ({ label: r.destinasi, value: r.jumlah }))} />
          </ChartCard>
          <ChartCard title={`Kunjungan ${nama} per bulan · ${dest}`} sub="kunjungan; bulan yang tidak dilaporkan tidak digambar">
            <VerticalBars data={bulanan()} unit=" kunjungan" labelFmt={labelBulan} />
          </ChartCard>
        </ChartGrid>
      </div>

      <div className="mt-4">
        <ChartCard title={`Rincian per destinasi · ${yLabel(year)}`} sub={`kunjungan ${nama}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] tabular-nums">
              <caption className="sr-only">Kunjungan {nama} per destinasi, {yLabel(year)}</caption>
              <thead className="text-ink-muted-48">
                <tr>
                  <th scope="col" className="py-2 pr-3">Destinasi</th>
                  <th scope="col" className="py-2 px-2 text-right">Kunjungan</th>
                  <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">% dari total</th>
                  <th scope="col" className="py-2 pl-2 text-right whitespace-nowrap">Bulan dilaporkan</th>
                </tr>
              </thead>
              <tbody>
                {perDest.map((r) => (
                  <tr key={r.destinasi} className={`border-t border-hairline ${r.destinasi === dest ? "bg-orange-50" : ""}`}>
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">{r.destinasi}</th>
                    <td className="py-2 px-2 text-right font-semibold">{idNum(r.jumlah)}</td>
                    <td className="py-2 px-2 text-right">{total ? `${idNum((r.jumlah / total) * 100, 1)}%` : "—"}</td>
                    <td className="py-2 pl-2 text-right">{r.bulan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
