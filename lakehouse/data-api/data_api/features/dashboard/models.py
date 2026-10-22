"""Model respons fitur dashboard (bentuk `data`; kontrak lengkap di `openapi.yaml`).

Dipasang sebagai `response_model` dengan `response_model_exclude_unset=True`: `delta` pada KPI hanya
muncul bila halaman Next.js mengirimnya, sama dengan golden.
"""

from __future__ import annotations

from pydantic import BaseModel

Angka = int | float


class Kpi(BaseModel):
    """Props `Kpi`/`KpiStat` Next.js: `value` angka mentah atau teks siap tampil."""

    label: str
    value: str | Angka
    sub: str | None
    delta: float | None = None


class Titik(BaseModel):
    label: str
    value: Angka


class Seri(BaseModel):
    name: str
    data: list[Titik]


class Persen(BaseModel):
    periode: str
    persen: float


class WismanRingkas(BaseModel):
    tahun: str
    jumlah: int | None
    target: Angka | None


class PdrbRingkas(BaseModel):
    tahun: str
    kontribusi_pct: Angka
    target_tahun: str
    target_pct: Angka | None
    adhb_ekraf_miliar: Angka
    tumbuh_ekraf_pct: Angka
    tumbuh_dki_pct: Angka


class Ringkasan(BaseModel):
    wisman: WismanRingkas
    pdrb: PdrbRingkas
    kpi: list[Kpi]


class Rentang(BaseModel):
    dari: str | None
    sampai: str | None


class TahunWisman(BaseModel):
    tahun: str
    label: str
    jumlah: int
    target: Angka | None


class Pertumbuhan(BaseModel):
    label: str
    persen: float | None
    sub: str | None


class WismanTahunan(BaseModel):
    data_tersedia: Rentang
    tahun: list[TahunWisman]
    pertumbuhan: Pertumbuhan
    tahun_default: str | None
    kpi: list[Kpi]


class Bulan(BaseModel):
    periode: str
    jumlah: int


class Yoy(BaseModel):
    kategori: list[str]
    seri: list[Seri]


class WismanBulanan(BaseModel):
    rows: list[Bulan]
    yoy: Yoy
    pertumbuhan: list[Persen]
    periode: str
    kpi: list[Kpi]


class Kebangsaan(BaseModel):
    periode: str
    label: str
    items: list[Titik]


class PintuMasuk(BaseModel):
    sumber: str
    label: str
    semester: str | None
    items: list[Titik]


class NilaiPeriode(BaseModel):
    periode: str
    nilai: Angka


class LamaMenginapRataRata(BaseModel):
    wisman: list[NilaiPeriode]
    wisnus: list[NilaiPeriode]


class Tabel(BaseModel):
    header: list[str]
    rows: list[list[str]]


class LamaMenginapPerKelas(BaseModel):
    periode_list: list[str]
    periode: str
    label: str
    tabel: Tabel


class DaftarSeri(BaseModel):
    seri: list[Seri]


class WisnusMeta(BaseModel):
    kota: list[str]
    tahun: list[str]
    tahun_hilang_teks: str | None
    tahun_default: str | None


class WisnusTahunan(BaseModel):
    tahun: list[Titik]
    kpi: list[Kpi]


class PerKota(BaseModel):
    label: str
    items: list[Titik]


class WisnusYoy(BaseModel):
    kategori: list[str]
    seri: list[Seri]
    pertumbuhan: list[Persen]


class TkBaris(BaseModel):
    tahun: str
    total: int
    porsi_pct: float | None
    laki: int
    perempuan: int


class TenagaKerjaDki(BaseModel):
    rows: list[TkBaris]
    kpi: list[Kpi]


class TenagaKerjaSubsektor(BaseModel):
    tahun_list: list[str]
    tahun: str
    items: list[Titik]


class Sertifikasi(BaseModel):
    per_tahun: list[Titik]
    bidang: list[str]
    seri: list[Seri]


class PdrbBaris(BaseModel):
    periode: str
    label: str
    adhb_ekraf: Angka
    adhb_dki: Angka
    kontribusi_pct: Angka
    adhk_ekraf: Angka
    tumbuh_ekraf_pct: Angka
    tumbuh_non_ekraf_pct: Angka
    tumbuh_dki_pct: Angka


class KontribusiTarget(BaseModel):
    label: str
    capaian: Angka | None
    target: Angka | None


class TargetKontribusi(BaseModel):
    tahun: str
    target_pct: Angka


class PdrbMakro(BaseModel):
    sumber: str
    rows: list[PdrbBaris]
    kontribusi_vs_target: list[KontribusiTarget]
    target_kontribusi: list[TargetKontribusi]


class Distribusi(BaseModel):
    label: str
    nama: str
    pct: Angka


class PdrbSebaran(BaseModel):
    periode_list: list[str]
    periode: str
    label: str
    distribusi: list[Distribusi]
    nilai_top10: list[Titik]


class PdrbPertumbuhan(BaseModel):
    periode_list: list[str]
    periode: str
    label: str
    items: list[Titik]
