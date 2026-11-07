#!/usr/bin/env python3
"""Bangun dataset sekunder gabungan fasilitasi HKI pelaku ekraf 2023–2026.

Dua sumber digabung dalam satu tabel, ditandai per baris di kolom `sumber`:

- 2023–2025: tarikan portal SDI, dataset "Jumlah Produk/Jasa Ekonomi Kreatif yang Didaftarkan
  Kekayaan Intelektualnya" (dibaca dari Silver lakehouse saat skrip dijalankan: snapshot);
- 2026 TW I–III: lampiran tiga nota dinas monev subkegiatan fasilitasi HKI, ditranskripsi tangan
  dari pindaian (PDF tidak di-commit) apa adanya, ejaan asli dipertahankan:

    data/sumber/disparekraf/fasilitasi-hki-2026-tw1.tsv   nota 1967/PW.04.02, 30 Mar 2026 (50)
    data/sumber/disparekraf/fasilitasi-hki-2026-tw2.tsv   nota 3870/PW.04.02, 23 Jun 2026 (80)
    data/sumber/disparekraf/fasilitasi-hki-2026-tw3.tsv   nota 6234/PW.04.02, 29 Sep 2026 (100)

Kolom disatukan tanpa membuang isi: yang tidak ada di suatu sumber dibiarkan kosong. Kolom
`triwulan` dan `no_lampiran` hanya terisi untuk 2026.

Keluaran: data/sekunder/fasilitasi-hki-ekraf-2023-2026.json

Jalankan dari root repo dengan akun ClickHouse read-only:
  CH_URL=… CH_USER=… CH_PASSWORD=… python3 scripts/fasilitasi_hki_ekraf.py
"""
from __future__ import annotations

import csv
import json
import os
import urllib.request
from pathlib import Path

DIR = Path("data/sumber/disparekraf")
OUT = Path("data/sekunder/fasilitasi-hki-ekraf-2023-2026.json")
TABEL_SDI = "silver.jumlah_produkjasa_ekonomi_kreatif_yang_didaftarkan_kekayaan_intelektualnya"
SUMBER_SDI = "Satu Data Jakarta · Jumlah Produk/Jasa Ekonomi Kreatif yang Didaftarkan Kekayaan Intelektualnya"
# triwulan → (romawi, jumlah baris lampiran, label sumber: nomor dan tanggal nota dinas)
TRIWULAN = {
    1: ("I", 50, "Nota Dinas 1967/PW.04.02 (30 Mar 2026) · Monev Fasilitasi HKI TW I"),
    2: ("II", 80, "Nota Dinas 3870/PW.04.02 (23 Jun 2026) · Monev Fasilitasi HKI TW II"),
    3: ("III", 100, "Nota Dinas 6234/PW.04.02 (29 Sep 2026) · Monev Fasilitasi HKI TW III"),
}

KOLOM = [
    ("tahun", "Tahun", "Tahun fasilitasi."),
    ("triwulan", "Triwulan", "Triwulan laporan (hanya data nota dinas 2026)."),
    ("no_lampiran", "No. Lampiran", "Nomor urut di lampiran nota dinas (hanya 2026)."),
    ("nama", "Nama", "Nama usaha (SDI) atau nama pada lampiran nota dinas."),
    ("merek_ciptaan", "Merek/Ciptaan", "Merek atau ciptaan yang didaftarkan (lampiran TW I–II)."),
    ("subsektor", "Subsektor", "Subsektor ekonomi kreatif sesuai sumber."),
    ("alamat", "Alamat", "Alamat pemohon (lampiran TW I–II)."),
    ("kelas", "Kelas", "Kelas merek (SDI)."),
    ("keterangan", "Keterangan", "Jenis HKI: Hak Merek atau Hak Cipta (lampiran TW III)."),
    ("sumber", "Sumber", "Asal baris: dataset Satu Data Jakarta (2023–2025) atau nomor dan tanggal nota dinas monev (2026)."),
]


def baris_sdi() -> list[dict]:
    sql = (
        "SELECT toString(toUInt16(periode_data)) AS periode_data, nama_usaha, subsektor, "
        f"if(kelas IS NULL, '', toString(toUInt32(kelas))) AS kelas FROM {TABEL_SDI} FORMAT JSONEachRow"
    )
    req = urllib.request.Request(
        os.environ["CH_URL"],
        data=sql.encode(),
        headers={"X-ClickHouse-User": os.environ["CH_USER"], "X-ClickHouse-Key": os.environ["CH_PASSWORD"]},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = [json.loads(b) for b in r.read().decode().splitlines() if b]
    teks = lambda v: "" if v is None else str(v)
    hasil = [
        {"tahun": teks(r["periode_data"]), "nama": teks(r["nama_usaha"]), "subsektor": teks(r["subsektor"]),
         "kelas": teks(r["kelas"]), "sumber": SUMBER_SDI}
        for r in rows
    ]
    return sorted(hasil, key=lambda r: (r["tahun"], r["nama"].lower()))


def baris_nota() -> list[dict]:
    hasil = []
    for tw, (romawi, jumlah, sumber) in TRIWULAN.items():
        with open(DIR / f"fasilitasi-hki-2026-tw{tw}.tsv", encoding="utf-8", newline="") as f:
            kepala, *rows = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
        if len(rows) != jumlah or [r[0] for r in rows] != [str(i) for i in range(1, jumlah + 1)]:
            raise SystemExit(f"TW {romawi}: nomor baris harus 1..{jumlah}")
        for r in rows:
            d = dict(zip(kepala, r, strict=True))
            hasil.append({
                "tahun": "2026", "triwulan": f"TW {romawi}", "no_lampiran": d["No"], "nama": d["Nama"],
                "merek_ciptaan": d.get("Merk/Cipta", ""), "subsektor": d["Subsektor"], "alamat": d.get("Alamat", ""),
                "keterangan": d.get("Keterangan", ""), "sumber": sumber,
            })
    return hasil


def main() -> None:
    sdi, nota = baris_sdi(), baris_nota()
    if not sdi:
        raise SystemExit(f"{TABEL_SDI} kosong — periksa koneksi/akun ClickHouse")
    rows = [{k: r.get(k, "") for k, _, _ in KOLOM} for r in sdi + nota]
    data = {
        "slug": OUT.stem,
        "title": "Fasilitasi HKI Pelaku Ekonomi Kreatif 2023–2026",
        "description": (
            "Pelaku ekonomi kreatif DKI Jakarta yang difasilitasi pendaftaran hak kekayaan intelektual. "
            "2023–2025 dari portal SDI (produk/jasa ekraf yang didaftarkan kekayaan intelektualnya); "
            "2026 triwulan I–III dari lampiran nota dinas monev subkegiatan fasilitasi HKI. "
            "Kolom Sumber menandai asal tiap baris."
        ),
        "columns": [{"key": k, "label": label, "type": "string", "description": d} for k, label, d in KOLOM],
        "rows": rows,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    per_tahun: dict[str, int] = {}
    for r in rows:
        per_tahun[r["tahun"]] = per_tahun.get(r["tahun"], 0) + 1
    print(f"{OUT}: {len(rows)} baris {per_tahun}")


if __name__ == "__main__":
    main()
