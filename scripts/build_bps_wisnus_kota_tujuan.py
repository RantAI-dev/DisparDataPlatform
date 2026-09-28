"""Konversi CSV tabel statistik BPS DKI → dataset sekunder JSON.

Tabel yang didukung (diunduh manual dari jakarta.bps.go.id, satu CSV per tahun):
  - "Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan di DKI Jakarta"
      → data/sekunder/wisnus-perjalanan-per-kota-tujuan.json
  - "Wisatawan Mancanegara Yang Datang ke DKI Jakarta Menurut Pintu Masuk dan Bulan"
      → data/sekunder/wisman-per-pintu-masuk-bulanan-bps.json

Pemakaian (dari root repo):
    python3 scripts/build_bps_wisnus_kota_tujuan.py <folder-berisi-csv> [<folder> ...]

Pemeriksaan yang dipaksa (gagal = berhenti):
  - jumlah 12 bulan per kota == kolom "Tahunan" (bila ada),
  - jumlah semua kota per bulan == baris "DKI Jakarta",
  - jumlah pintu per bulan == kolom "Jumlah"; total per pintu == baris "Jumlah".
Baris agregat "DKI Jakarta" tidak disimpan (dihitung dari kota). Nilai "-" = belum rilis, dilewati.
Hasil ditulis ke data/sekunder/ DAN disalin ke platform-v2/data/ (mirror yang dibaca app).
"""

from __future__ import annotations

import csv
import glob
import json
import os
import shutil
import sys

BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
         "Agustus", "September", "Oktober", "November", "Desember"]


def num(s: str) -> int | None:
    s = s.strip()
    if s in ("-", "", "…", "..."):
        return None
    return int(float(s.replace(",", "")))


def baca(folders: list[str]):
    wisnus, pintu = {}, {}  # kunci unik → baris (tahun berulang = file terbaru menang)
    for folder in folders:
        for f in sorted(glob.glob(os.path.join(folder, "*.csv"))):
            r = list(csv.reader(open(f, encoding="utf-8-sig")))
            if len(r) < 4 or len(r[1]) < 2:
                continue
            judul = r[1][1]
            if "Kabupaten/Kota Tujuan" in judul:
                th = int(r[2][1])
                assert r[3][1:13] == BULAN and r[3][13] == "Tahunan", (f, r[3])
                total, per_bulan = None, [0] * 12
                for line in r[4:]:
                    if not line or not line[0].strip():
                        continue
                    kota = line[0].strip()
                    vals = [num(x) for x in line[1:13]]
                    if kota == "DKI Jakarta":
                        total = vals
                        continue
                    tahunan = num(line[13])
                    if tahunan is not None:
                        assert sum(v for v in vals if v is not None) == tahunan, (th, kota)
                    for i, v in enumerate(vals):
                        if v is None:
                            continue
                        per_bulan[i] += v
                        wisnus[(th, i + 1, kota)] = {
                            "tahun": str(th), "bulan": str(i + 1), "periode": f"{th}-{i + 1:02d}",
                            "kota_tujuan": kota, "jumlah_perjalanan": v,
                        }
                assert total is not None, f"baris 'DKI Jakarta' tidak ada: {f}"
                for i, v in enumerate(total):
                    assert v is None or v == per_bulan[i], (th, i + 1, v, per_bulan[i])
                print(f"  wisnus {th}: {sum(1 for v in total if v is not None)} bulan")
            elif "Pintu Masuk dan Bulan" in judul:
                nama = [p.strip() for p in r[2][1:4]]
                th = int(r[3][1])
                jumlah = [0, 0, 0]
                for line in r[4:]:
                    if line and line[0] in BULAN:
                        b = BULAN.index(line[0]) + 1
                        vals = [num(x) for x in line[1:4]]
                        if any(v is None for v in vals):
                            continue
                        assert sum(vals) == num(line[4]), (th, b)
                        for p, v in zip(nama, vals):
                            pintu[(th, b, p)] = {
                                "tahun": str(th), "bulan": str(b), "periode": f"{th}-{b:02d}",
                                "pintu_masuk": p, "jumlah_kunjungan": v,
                            }
                        jumlah = [a + v for a, v in zip(jumlah, vals)]
                    elif line and line[0] == "Jumlah":
                        tot = [num(x) for x in line[1:4]]
                        assert None in tot or tot == jumlah, (th, tot, jumlah)
                print(f"  pintu masuk {th}: total {sum(jumlah):,}")
    return wisnus, pintu


def tulis(slug: str, title: str, desc: str, columns: list, rows: list) -> None:
    ds = {"slug": slug, "title": title, "description": desc, "columns": columns, "rows": rows}
    path = f"data/sekunder/{slug}.json"
    json.dump(ds, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    shutil.copy(path, f"platform-v2/data/{slug}.json")
    print(f"→ {path} ({len(rows)} baris) + mirror platform-v2/data/")


def col(key, label, typ, desc=None):
    return {"key": key, "label": label, "type": typ, "description": desc}


def main(folders: list[str]) -> None:
    wisnus, pintu = baca(folders)
    if wisnus:
        rows = sorted(wisnus.values(), key=lambda r: (r["periode"], r["kota_tujuan"]))
        tahun = sorted({r["tahun"] for r in rows})
        tulis(
            "wisnus-perjalanan-per-kota-tujuan",
            "Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan di DKI Jakarta",
            "Perjalanan wisnus bulanan menurut kota/kabupaten TUJUAN di DKI Jakarta (mobile positioning data). "
            f"Sumber: tabel statistik BPS Provinsi DKI Jakarta (var 1330), diunduh manual. Tahun: {', '.join(tahun)}. "
            "Baris agregat 'DKI Jakarta' tidak disimpan — dihitung dari kota.",
            [col("tahun", "Tahun", "string"), col("bulan", "Bulan", "string"),
             col("periode", "Periode", "string", "YYYY-MM"),
             col("kota_tujuan", "Kota/Kabupaten Tujuan", "string"),
             col("jumlah_perjalanan", "Jumlah Perjalanan", "number", "perjalanan")],
            rows,
        )
    if pintu:
        rows = sorted(pintu.values(), key=lambda r: (r["periode"], r["pintu_masuk"]))
        tahun = sorted({r["tahun"] for r in rows})
        tulis(
            "wisman-per-pintu-masuk-bulanan-bps",
            "Wisatawan Mancanegara yang Datang ke DKI Jakarta Menurut Pintu Masuk dan Bulan",
            "Kunjungan wisman bulanan per pintu masuk DKI Jakarta (Soekarno-Hatta, Halim Perdana Kusuma, "
            f"Tanjung Priok). Sumber: tabel statistik BPS Provinsi DKI Jakarta, diunduh manual. Tahun: {', '.join(tahun)}.",
            [col("tahun", "Tahun", "string"), col("bulan", "Bulan", "string"),
             col("periode", "Periode", "string", "YYYY-MM"),
             col("pintu_masuk", "Pintu Masuk", "string"),
             col("jumlah_kunjungan", "Jumlah Kunjungan", "number", "kunjungan")],
            rows,
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
