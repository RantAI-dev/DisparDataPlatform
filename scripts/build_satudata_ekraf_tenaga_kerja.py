"""Tenaga kerja ekonomi kreatif (Satu Data Ekraf, Kemenekraf × BPS Sakernas) → dataset sekunder.

Sumber: https://satudata.ekraf.go.id — CSV resmi yang diunduh ke data/sumber/satudata-ekraf/
(URL per berkas ada di manifest.json di folder itu):
  - 8w13umewjrtrk1q  Jumlah Tenaga Kerja Ekonomi Kreatif Berdasarkan Provinsi (2020–2024)
  - hxi9b9y1vq2rf2p  ... Berdasarkan Provinsi dan Jenis Kelamin
  - 17o8miba9bfiyx1  ... Berdasarkan Subsektor (NASIONAL, 2020–2024)

Keluaran (data/sekunder/ + mirror platform-v2/data/):
  - tenaga-kerja-ekraf-per-provinsi.json   (jenis_kelamin = Total / Laki-laki / Perempuan)
  - tenaga-kerja-ekraf-per-subsektor-nasional.json

Cek dipaksa: Laki-laki + Perempuan == Total per provinsi-tahun.
Angka memakai titik sebagai pemisah ribuan ("1.089.729").

    python3 scripts/build_satudata_ekraf_tenaga_kerja.py
"""

from __future__ import annotations

import csv
import glob
import json
import shutil

SRC = "data/sumber/satudata-ekraf"
URL = "https://satudata.ekraf.go.id/dataset/"


def angka(s: str) -> int | None:
    s = s.strip()
    return None if s in ("-", "") else int(s.replace(".", ""))


def rows_of(pattern: str):
    for f in sorted(glob.glob(f"{SRC}/{pattern}")):
        yield from csv.DictReader(open(f, encoding="utf-8-sig"), delimiter=";")


def tulis(slug, title, desc, columns, rows):
    path = f"data/sekunder/{slug}.json"
    json.dump({"slug": slug, "title": title, "description": desc, "columns": columns, "rows": rows},
              open(path, "w", encoding="utf-8"), ensure_ascii=False)
    shutil.copy(path, f"platform-v2/data/{slug}.json")
    print(f"→ {path} ({len(rows)} baris)")


def col(key, label, typ, desc=None):
    return {"key": key, "label": label, "type": typ, "description": desc}


def main():
    total = {}
    for r in rows_of("dl_8w13umewjrtrk1q_*.csv"):
        n = angka(r["Jumlah Tenaga Kerja"])
        if n is not None:  # "-" = provinsi belum ada / tak tersedia tahun itu
            total[(r["Tahun"], r["Kode Wilayah"])] = (r["Provinsi"].strip(), n)
    jk = {}
    for r in rows_of("dl_hxi9b9y1vq2rf2p_*.csv"):
        n = angka(r["Jumlah Tenaga Kerja"])
        if n is not None:
            jk[(r["Tahun"], r["Kode Wilayah"], r["Jenis Kelamin"].strip())] = n

    rows, selisih = [], []
    for (th, kode), (prov, n) in sorted(total.items()):
        rows.append({"tahun": th, "kode_wilayah": kode, "provinsi": prov, "jenis_kelamin": "Total", "jumlah_tenaga_kerja": n})
        l, p = jk.get((th, kode, "Laki-laki")), jk.get((th, kode, "Perempuan"))
        if l is not None and p is not None:
            if l + p != n:
                selisih.append((th, prov, l + p, n))
            rows.append({"tahun": th, "kode_wilayah": kode, "provinsi": prov, "jenis_kelamin": "Laki-laki", "jumlah_tenaga_kerja": l})
            rows.append({"tahun": th, "kode_wilayah": kode, "provinsi": prov, "jenis_kelamin": "Perempuan", "jumlah_tenaga_kerja": p})
    assert not selisih, f"L+P != Total: {selisih[:5]}"
    for th in sorted({r["tahun"] for r in rows}):
        dki = next(r for r in rows if r["tahun"] == th and r["kode_wilayah"] == "31" and r["jenis_kelamin"] == "Total")
        nas = sum(r["jumlah_tenaga_kerja"] for r in rows if r["tahun"] == th and r["jenis_kelamin"] == "Total")
        print(f"  {th}: DKI {dki['jumlah_tenaga_kerja']:,} / nasional {nas:,}")
    tulis(
        "tenaga-kerja-ekraf-per-provinsi",
        "Jumlah Tenaga Kerja Ekonomi Kreatif Menurut Provinsi dan Jenis Kelamin",
        "Tenaga kerja ekonomi kreatif per provinsi 2020–2024 (Total, Laki-laki, Perempuan). Sumber: Satu Data Ekraf "
        f"(Kemenekraf, olahan Sakernas BPS Agustus) — {URL}8w13umewjrtrk1q dan {URL}hxi9b9y1vq2rf2p.",
        [col("tahun", "Tahun", "string"), col("kode_wilayah", "Kode Wilayah", "string"), col("provinsi", "Provinsi", "string"),
         col("jenis_kelamin", "Jenis Kelamin", "string"), col("jumlah_tenaga_kerja", "Jumlah Tenaga Kerja", "number", "orang")],
        rows,
    )
    sub = [{"tahun": r["Tahun"], "subsektor": r["Subsektor"].strip(), "jumlah_tenaga_kerja": angka(r["Jumlah Tenaga Kerja"])}
           for r in rows_of("dl_17o8miba9bfiyx1_*.csv") if angka(r["Jumlah Tenaga Kerja"]) is not None]
    tulis(
        "tenaga-kerja-ekraf-per-subsektor-nasional",
        "Jumlah Tenaga Kerja Ekonomi Kreatif Menurut Subsektor (Nasional)",
        "Tenaga kerja ekonomi kreatif INDONESIA per subsektor 2020–2024 — belum tersedia per provinsi. Sumber: Satu Data Ekraf "
        f"(Kemenekraf, olahan Sakernas BPS) — {URL}17o8miba9bfiyx1.",
        [col("tahun", "Tahun", "string"), col("subsektor", "Subsektor", "string"),
         col("jumlah_tenaga_kerja", "Jumlah Tenaga Kerja", "number", "orang")],
        sorted(sub, key=lambda r: (r["tahun"], r["subsektor"])),
    )


if __name__ == "__main__":
    main()
