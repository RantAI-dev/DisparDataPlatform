"""Ringkasan beranda (P4): angka hidup, menggantikan angka beku halaman beranda Next.js.

Golden `beranda.nextjs.json` merekam angka beku itu (182 / 19.428 / 28 / 2) untuk whitelist uji
paritas; Data API menghitung dari lake.
"""

from __future__ import annotations

from typing import Any

from data_api.shared import hitungan, indikator_sumber
from data_api.shared import queries as sq
from data_api.shared.konteks import Konteks

SUMBER = [sq.META, sq.META_SEC, "lake.bronze_meta*.dataset_sync", "lake.bronze_file.gci_gpci_indicators"]


def ringkasan(k: Konteks) -> dict[str, Any]:
    primer = sum(1 for r in sq.katalog(k) if r["tier"] == "primer")
    sekunder = hitungan.baris_sekunder(k)
    indikator = indikator_sumber.daftar(k)
    per_fw = {fw: sum(1 for i in indikator if i["framework"] == fw) for fw in ("GCI", "GPCI")}
    return {
        "dataset_primer": primer,
        "dataset_sekunder": len(sekunder),
        "baris_sekunder": sum(n for _, n in sekunder),
        "indikator": {"gci": per_fw["GCI"], "gpci": per_fw["GPCI"], "total": len(indikator)},
        "indeks_global": len({i["framework"] for i in indikator}),
    }
