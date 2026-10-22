"""Agregasi dashboard — port logika Next.js @ 6b858eb (inventaris B), quirk ditiru (SPEC K-10).

Sumber yang diport:
- `app/dashboard/page.tsx` (ringkasan), `components/dashboard/WismanStat.tsx`, `LosByClass.tsx`,
  `WisnusLos.tsx`, `WisnusStat.tsx`, `TkSubsektor.tsx`, `app/dashboard/tenaga-kerja/page.tsx`,
  `PdrbEkrafStat.tsx`.
- `kpi[]` = props KPI persis seperti dikirim ke komponen tampilan (teks sudah diformat id-ID).

Q21: kegagalan query ClickHouse (yang di Next.js dibungkus `safe()`) menghasilkan baris kosong dan
pesan di `meta.peringatan`, bukan 5xx. PDRB/target dari Bronze dulunya konstanta, jadi kegagalannya
tetap 503.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

from data_api.shared.errors import InvalidParam, Upstream
from data_api.shared.format import id_num, js_round, lokal_id
from data_api.shared.konteks import Konteks

from . import queries

BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
SEMUA = "Semua kota"
SELURUH = "Seluruh Jakarta"
PDRB_SUMBER = "PDRB Ekonomi Kreatif DKI Jakarta 2016–Sem I 2025 (BPS × Disparekraf)"
# Nama pendek legenda donut PDRB (PdrbEkrafStat `PENDEK`).
PENDEK = {
    "Aplikasi dan Pengembang Permainan": "Aplikasi & Game",
    "Televisi dan Radio": "TV & Radio",
    "Film, Animasi, dan Video": "Film & Animasi",
    "Desain Komunikasi Visual": "DKV",
}
# Q11: SQL sertifikasi hanya `ORDER BY tahun`, jadi urutan bidang di Next.js bergantung urutan baris
# ClickHouse. Ditetapkan deterministik = urutan yang tayang 22 Okt 2026; bidang baru menyusul menurut
# tahun kemunculan lalu nama.
URUTAN_BIDANG = ["KEPEMANDUAN", "MICE", "HOTEL DAN RESTORAN", "SPA", "EDUKATOR MUSEUM", "MUSIK", "FOTOGRAFI", "FILM"]

_TANPA = object()


def kpi(label: str, value: Any, sub: str | None = None, delta: Any = _TANPA) -> dict[str, Any]:
    """Props `Kpi`/`KpiStat` seperti direkam golden: `delta` hanya ada bila dikirim (boleh null)."""
    hasil = {"label": label, "value": value, "sub": sub}
    if delta is not _TANPA:
        hasil["delta"] = delta
    return hasil


def _angka(s: Any) -> int | float:
    """`Number(s)` untuk teks angka dari ClickHouse."""
    try:
        return int(s)
    except (TypeError, ValueError):
        try:
            return float(s)
        except (TypeError, ValueError):
            return 0


def label_bulan(periode: str) -> str:
    """`labelBulan`: "2024-01" → "Jan 2024" (bulan tak dikenal ditulis apa adanya)."""
    y, _, m = periode.partition("-")
    try:
        nama = BULAN[int(m) - 1] if 1 <= int(m) <= 12 else m
    except ValueError:
        nama = m
    return f"{nama} {y}"


def title_case(s: str) -> str:
    """`s.toLowerCase().replace(/\\b\\w/g, c => c.toUpperCase())` (batas kata ASCII seperti JS)."""
    return re.sub(r"\b\w", lambda m: m.group().upper(), s.lower(), flags=re.ASCII)


def _pct_bulat(a: float, b: float) -> float:
    return js_round(((a - b) / b) * 1000) / 10


# ── pemuatan (Q21) ────────────────────────────────────────────────────────────


@dataclass
class Muat:
    """Membaca baris query dashboard dengan cache; kegagalan dicatat, bukan dilempar (Q21)."""

    k: Konteks
    peringatan: list[str] = field(default_factory=list)

    def ambil(self, *nama: str) -> list[list[dict[str, Any]]]:
        def satu(n: str) -> list[dict[str, Any]]:
            fungsi, ubah = getattr(queries, n), _UBAH[n]
            try:
                return self.k.cache.ambil(
                    ("dashboard", n), self.k.konf.cache_ttl_default, lambda: [ubah(r) for r in fungsi(self.k)]
                )
            except Upstream:
                self.peringatan.append(f"{n} tidak dapat dibaca; ditampilkan kosong")
                return []

        if len(nama) == 1:
            return [satu(nama[0])]
        # Query satu endpoint dijalankan bersamaan, seperti `Promise.all` Next.js.
        with ThreadPoolExecutor(len(nama)) as ex:
            return list(ex.map(satu, nama))

    def bronze(self, tabel: str) -> list[dict[str, Any]]:
        return self.k.cache.ambil(
            ("dashboard", tabel), self.k.konf.cache_ttl_default, lambda: queries.bronze(self.k, tabel)
        )


# Nama query (fungsi di `queries.py`) → pengubah baris teks ClickHouse ke angka (`Number(...)` Next.js).
_UBAH: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "wisman_bulanan": lambda r: {
        "periode": r["periode"],
        "tahun": r["tahun"],
        "bulan": _angka(r["bulan"]),
        "jumlah": _angka(r["jumlah"]),
    },
    "wisman_negara": lambda r: {"periode": r["periode"], "negara": r["negara"], "jumlah": _angka(r["jumlah"])},
    "wisman_pintu": lambda r: {
        "tahun": r["tahun"],
        "semester": _angka(r["semester"]),
        "pintu": r["pintu"],
        "jumlah": _angka(r["jumlah"]),
    },
    # Q18: apa pun selain MANCANEGARA dianggap Wisnus.
    "lama_menginap": lambda r: {
        "periode": r["periode"],
        "jenisHotel": r["jenis_hotel"],
        "jenisTamu": "Wisman" if re.search("MANCANEGARA", r["jenis_tamu"] or "", re.IGNORECASE) else "Wisnus",
        "rataRata": float(_angka(r["rata"])),
    },
    "sertifikasi": lambda r: {"tahun": r["tahun"], "bidang": r["bidang"], "jumlah": _angka(r["jumlah"])},
    "wisnus_kota": lambda r: {
        "periode": r["periode"],
        "tahun": r["periode"][:4],
        "bulan": _angka(r["periode"][5:7]),
        "kota": r["kota"],
        "jumlah": _angka(r["jumlah"]),
    },
    "pintu_bulanan": lambda r: {"periode": r["periode"], "pintu": r["pintu"], "jumlah": _angka(r["jumlah"])},
    "tk_dki": lambda r: {
        kk: (r[kk] if kk == "tahun" else _angka(r[kk])) for kk in ("tahun", "total", "laki", "perempuan", "nasional")
    },
    "tk_subsektor": lambda r: {"tahun": r["tahun"], "subsektor": r["subsektor"], "jumlah": _angka(r["jumlah"])},
}


def _target_wisman(m: Muat) -> dict[str, int | float]:
    return {r["tahun"]: _angka(r["target_wisman"]) for r in m.bronze("target_wisman")}


# ── ringkasan (app/dashboard/page.tsx) ────────────────────────────────────────


def _makro(m: Muat) -> list[dict[str, Any]]:
    """Baris `pdrb_ekraf_makro` urut periode ("2017" … "2024", "S1 2025")."""
    return sorted(m.bronze("pdrb_ekraf_makro"), key=lambda r: r["periode"])


def _target_kontribusi(m: Muat) -> dict[str, int | float]:
    rows = sorted(m.bronze("target_kontribusi_ekraf_rpjmd"), key=lambda r: r["tahun"])
    return {r["tahun"]: _angka(r["target_kontribusi_persen"]) for r in rows}


def ringkasan(m: Muat) -> dict[str, Any]:
    (bulanan,) = m.ambil("wisman_bulanan")
    t2025 = sum(r["jumlah"] for r in bulanan if r["tahun"] == "2025")
    target = _target_wisman(m).get("2025")
    p = next(r for r in _makro(m) if r["periode"] == "2024")
    tk = _target_kontribusi(m).get("2025")
    kontribusi, adhb = _angka(p["kontribusi"]), _angka(p["adhb_ekraf"])
    tumbuh_ekraf, tumbuh_dki = _angka(p["tumbuh_ekraf"]), _angka(p["tumbuh_dki"])
    return {
        "wisman": {"tahun": "2025", "jumlah": t2025 or None, "target": target},
        "pdrb": {
            "tahun": "2024",
            "kontribusi_pct": kontribusi,
            "target_tahun": "2025",
            "target_pct": tk,
            "adhb_ekraf_miliar": adhb,
            "tumbuh_ekraf_pct": tumbuh_ekraf,
            "tumbuh_dki_pct": tumbuh_dki,
        },
        "kpi": [
            kpi("Wisman 2025", t2025 or "—", f"target RPJMD {lokal_id(target)}"),
            kpi("Kontribusi PDRB Ekraf 2024", f"{lokal_id(kontribusi)}%", f"target 2025 {lokal_id(tk)}%"),
            kpi("Nilai PDRB Ekraf 2024", f"Rp {lokal_id(js_round(adhb / 1000))} T", "ADHB"),
            kpi("Pertumbuhan Ekraf 2024", f"{lokal_id(tumbuh_ekraf)}%", f"DKI {lokal_id(tumbuh_dki)}%"),
        ],
    }


# ── wisman (WismanStat) ───────────────────────────────────────────────────────


@dataclass
class _Wisman:
    bulanan: list[dict[str, Any]]
    years: list[str]

    def total(self, y: str) -> int:
        return sum(r["jumlah"] for r in self.bulanan if r["tahun"] == y)

    def n_months(self, y: str) -> int:
        return sum(1 for r in self.bulanan if r["tahun"] == y)

    def partial(self, y: str) -> bool:
        return self.n_months(y) < 12

    def y_label(self, y: str) -> str:
        # Q8: anggap bulan berurutan dari Januari.
        n = self.n_months(y)
        # Tanpa bulan sama sekali (Q21: data kosong) tidak ada "s/d"; JS akan menulis "undefined".
        return f"{y} (s/d {BULAN[n - 1]})" if self.partial(y) and n else y

    @property
    def tahun_default(self) -> str:
        return "2025" if "2025" in self.years else (self.years[-1] if self.years else "")

    @property
    def periods(self) -> list[str]:
        return [r["periode"] for r in self.bulanan]

    def growth(self) -> tuple[str | None, str | None, float | None]:
        full = [y for y in self.years if not self.partial(y)]
        last_full = full[-1] if full else None
        prev_full = full[-2] if len(full) > 1 else None
        g = (
            (self.total(last_full) - self.total(prev_full)) / self.total(prev_full) * 100
            if last_full and prev_full
            else None
        )
        return last_full, prev_full, g


def _wisman(bulanan: list[dict[str, Any]]) -> _Wisman:
    return _Wisman(bulanan, sorted({r["tahun"] for r in bulanan}))


def top_n(entri: list[tuple[str, int | float]], n: int = 8) -> list[dict[str, Any]]:
    """`topN`: buang label LAINNYA dari peringkat; sisa (termasuk Lainnya sumber) → "Lainnya"."""
    semua = [{"label": lb, "value": v} for lb, v in entri]
    real = sorted((p for p in semua if p["label"].upper() != "LAINNYA"), key=lambda p: -p["value"])
    top = real[:n]
    sisa = sum(p["value"] for p in semua) - sum(p["value"] for p in top)
    return [*top, {"label": "Lainnya", "value": sisa}] if sisa > 0 else top


def _jumlahkan(pasangan: list[tuple[str, int | float]]) -> list[tuple[str, int | float]]:
    """Penjumlahan ke `Map` JS: urutan = kemunculan pertama."""
    peta: dict[str, int | float] = {}
    for kunci, v in pasangan:
        peta[kunci] = peta.get(kunci, 0) + v
    return list(peta.items())


def title_pintu(s: str) -> str:
    return title_case(s).replace("Soekarno Hatta", "Soekarno-Hatta", 1)


def wisman_tahunan(m: Muat) -> dict[str, Any]:
    (bulanan,) = m.ambil("wisman_bulanan")
    target = _target_wisman(m)
    w = _wisman(bulanan)
    last_full, prev_full, growth = w.growth()
    periods = w.periods
    pertumbuhan = {
        "label": f"Pertumbuhan {last_full or ''}",
        "persen": growth,
        "sub": f"vs {prev_full}" if prev_full else None,
    }
    kpis = []
    if bulanan:
        kpis = [
            *(
                kpi(
                    f"Capaian {w.y_label(y)}",
                    w.total(y),
                    f"target RPJMD {id_num(target[y])}" if target.get(y) else "target RPJMD belum ditetapkan",
                )
                for y in w.years
            ),
            kpi(
                f"Pertumbuhan {last_full or ''}",
                f"{id_num(growth, 1)}%" if growth is not None else "—",
                f"vs {prev_full}" if prev_full else None,
                growth,
            ),
        ]
    return {
        "data_tersedia": {"dari": periods[0] if periods else None, "sampai": periods[-1] if periods else None},
        "tahun": [{"tahun": y, "label": w.y_label(y), "jumlah": w.total(y), "target": target.get(y)} for y in w.years],
        "pertumbuhan": pertumbuhan,
        "tahun_default": w.tahun_default or None,
        "kpi": kpis,
    }


def _los_avg(los: list[dict[str, Any]], tamu: str) -> list[dict[str, Any]]:
    """Q2: rata-rata sederhana lintas kelas bintang per periode, 2 desimal."""
    per: dict[str, list[float]] = {}
    for r in los:
        if r["jenisTamu"] == tamu:
            per.setdefault(r["periode"], []).append(r["rataRata"])
    hasil = []
    for periode, v in per.items():
        s = 0.0
        for x in v:  # `reduce` kiri-ke-kanan
            s += x
        hasil.append({"label": periode, "value": js_round((s / len(v)) * 100) / 100})
    return hasil


def _periode_wisman(w: _Wisman, periode: str | None) -> str:
    if periode is None:
        return w.periods[-1] if w.periods else ""
    # Q21: data kosong karena query gagal → parameter tidak divalidasi, respons tetap kosong.
    if w.periods and periode not in w.periods:
        raise InvalidParam(f"periode tidak tersedia: {periode}")
    return periode


def wisman_bulanan(m: Muat, periode: str | None) -> dict[str, Any]:
    bulanan, negara, los = m.ambil("wisman_bulanan", "wisman_negara", "lama_menginap")
    w = _wisman(bulanan)
    month = _periode_wisman(w, periode)

    def pembanding(r: dict[str, Any]) -> dict[str, Any] | None:
        return next((x for x in bulanan if x["tahun"] == str(int(r["tahun"]) - 1) and x["bulan"] == r["bulan"]), None)

    yoy_seri = [
        {
            "name": f"{y} •" if w.partial(y) else y,
            "data": [{"label": BULAN[r["bulan"] - 1], "value": r["jumlah"]} for r in bulanan if r["tahun"] == y],
        }
        for y in w.years
    ]
    pertumbuhan = [
        {"periode": r["periode"], "persen": _pct_bulat(r["jumlah"], p["jumlah"])}
        for r in bulanan
        if (p := pembanding(r))
    ]
    kpis: list[dict[str, Any]] = []
    if bulanan:
        m_row = next((r for r in bulanan if r["periode"] == month), None)
        prev = pembanding(m_row) if m_row else None
        yoy = (m_row["jumlah"] - prev["jumlah"]) / prev["jumlah"] * 100 if m_row and prev else None
        top = top_n(_jumlahkan([(r["negara"], r["jumlah"]) for r in negara if r["periode"] == month]), 1)
        los_bulan = next((p["value"] for p in _los_avg(los, "Wisman") if p["label"] == month), None)
        kpis = [
            kpi(f"Wisman {label_bulan(month)}", m_row["jumlah"] if m_row else 0, "kunjungan"),
            kpi(
                "YoY bulan ini",
                f"{id_num(yoy, 1)}%" if yoy is not None else "—",
                f"vs {label_bulan(prev['periode'])}" if prev else "tak ada pembanding",
                yoy,
            ),
            kpi(
                "Negara terbanyak",
                top[0]["label"] if top else "—",
                f"{id_num(top[0]['value'])} kunjungan" if top else None,
            ),
            kpi(
                "Lama menginap wisman",
                lokal_id(los_bulan) if los_bulan is not None else "—",
                "hari · hotel bintang (rata-rata kelas)",
            ),
        ]
    return {
        "rows": [{"periode": r["periode"], "jumlah": r["jumlah"]} for r in bulanan],
        "yoy": {"kategori": BULAN, "seri": yoy_seri},
        "pertumbuhan": pertumbuhan,
        "periode": month,
        "kpi": kpis,
    }


def _satu_dari(tahun: str | None, periode: str | None) -> None:
    if tahun is not None and periode is not None:
        raise InvalidParam("Pakai `tahun` atau `periode`, tidak keduanya")


def wisman_kebangsaan(m: Muat, tahun: str | None, periode: str | None, top: int) -> dict[str, Any]:
    _satu_dari(tahun, periode)
    bulanan, negara = m.ambil("wisman_bulanan", "wisman_negara")
    w = _wisman(bulanan)
    if periode is not None:
        month = _periode_wisman(w, periode)
        entri = _jumlahkan([(r["negara"], r["jumlah"]) for r in negara if r["periode"] == month])
        return {"periode": month, "label": label_bulan(month), "items": top_n(entri, top)}
    year = _tahun_wisman(w, tahun)
    entri = _jumlahkan([(r["negara"], r["jumlah"]) for r in negara if r["periode"].startswith(year)])
    return {"periode": year, "label": w.y_label(year), "items": top_n(entri, top)}


def _tahun_wisman(w: _Wisman, tahun: str | None) -> str:
    if tahun is None:
        return w.tahun_default
    if w.years and tahun not in w.years:
        raise InvalidParam(f"tahun tidak tersedia: {tahun}")
    return tahun


def wisman_pintu_masuk(m: Muat, tahun: str | None, periode: str | None) -> dict[str, Any]:
    _satu_dari(tahun, periode)
    bulanan, pintu, pintu_bln = m.ambil("wisman_bulanan", "wisman_pintu", "pintu_bulanan")
    w = _wisman(bulanan)
    if periode is None:
        year = _tahun_wisman(w, tahun)
        sem = sorted({r["semester"] for r in pintu if r["tahun"] == year})
        items = _jumlahkan([(title_pintu(r["pintu"]), r["jumlah"]) for r in pintu if r["tahun"] == year])
        return {
            "sumber": "sdi_semester",
            "label": year,
            "semester": " & ".join(str(s) for s in sem) or "—",
            "items": [{"label": lb, "value": v} for lb, v in items],
        }
    month = _periode_wisman(w, periode)
    bps = [
        {"label": re.sub(r"^(Bandara|Pelabuhan) ", "", r["pintu"]), "value": r["jumlah"]}
        for r in pintu_bln
        if r["periode"] == month
    ]
    if bps:
        return {"sumber": "bps_bulanan", "label": label_bulan(month), "semester": None, "items": bps}
    m_row = next((r for r in bulanan if r["periode"] == month), None)
    sem_bulan = 1 if m_row is None or m_row["bulan"] <= 6 else 2
    tahun_bulan = m_row["tahun"] if m_row else ""
    # Q10: `Map.set` menimpa, bukan menjumlah (aman karena SQL sudah GROUP BY).
    per: dict[str, int | float] = {}
    for r in pintu:
        if m_row and r["tahun"] == tahun_bulan and r["semester"] == sem_bulan:
            per[title_pintu(r["pintu"])] = r["jumlah"]
    return {
        "sumber": "sdi_semester",
        "label": f"Semester {sem_bulan} {tahun_bulan}",
        "semester": None,
        "items": [{"label": lb, "value": v} for lb, v in per.items()],
    }


# ── lama menginap (WismanStat RTL, LosByClass, WisnusLos) ─────────────────────


def lama_menginap_rata_rata(m: Muat) -> dict[str, Any]:
    (los,) = m.ambil("lama_menginap")
    return {
        t.lower(): [{"periode": p["label"], "nilai": p["value"]} for p in _los_avg(los, t)]
        for t in ("Wisman", "Wisnus")
    }


def _tamu(tamu: str) -> str:
    if tamu not in ("wisman", "wisnus"):
        raise InvalidParam("tamu harus wisman atau wisnus")
    return tamu.capitalize()


def lama_menginap_per_kelas(m: Muat, tamu: str, periode: str | None) -> dict[str, Any]:
    guest = _tamu(tamu)
    (los,) = m.ambil("lama_menginap")
    rows = [r for r in los if r["jenisTamu"] == guest and math.isfinite(r["rataRata"])]
    periods = sorted({r["periode"] for r in rows})
    if periode is not None and periods and periode not in periods:
        raise InvalidParam(f"periode tidak tersedia: {periode}")
    period = (periode if periods else None) or (periods[-1] if periods else "")
    if not period:
        # LosByClass tanpa periode: label "—" dan tabel tanpa baris.
        return {
            "periode_list": [],
            "periode": "",
            "label": "—",
            "tabel": {"header": ["Kelas hotel", "—", "—", "YoY"], "rows": []},
        }
    y, _, mm = period.partition("-")
    previous = f"{int(y) - 1}-{mm}"
    sekarang = [r for r in rows if r["periode"] == period]
    lalu = [r for r in rows if r["periode"] == previous]
    baris = []
    for hotel in sorted({r["jenisHotel"] for r in [*sekarang, *lalu]}):
        nilai = next((r["rataRata"] for r in sekarang if r["jenisHotel"] == hotel), None)
        dasar = next((r["rataRata"] for r in lalu if r["jenisHotel"] == hotel), None)
        yoy = (nilai - dasar) / dasar * 100 if nilai is not None and dasar is not None and dasar > 0 else None
        baris.append(
            [
                hotel.replace("BINTANG", "Bintang", 1),
                "—" if dasar is None else id_num(dasar, 2),
                "—" if nilai is None else id_num(nilai, 2),
                "—" if yoy is None else f"{'+' if yoy > 0 else ''}{id_num(yoy, 1)}%",
            ]
        )
    label = label_bulan(period)
    return {
        "periode_list": periods[::-1],
        "periode": period,
        "label": label,
        "tabel": {"header": ["Kelas hotel", label_bulan(previous), label, "YoY"], "rows": baris},
    }


def lama_menginap_seri(m: Muat, tamu: str) -> dict[str, Any]:
    guest = _tamu(tamu)
    (los,) = m.ambil("lama_menginap")
    w = [r for r in los if r["jenisTamu"] == guest]
    return {
        "seri": [
            {
                "name": kelas.replace("BINTANG", "Bintang", 1),
                "data": [{"label": r["periode"], "value": r["rataRata"]} for r in w if r["jenisHotel"] == kelas],
            }
            for kelas in sorted({r["jenisHotel"] for r in w})
        ]
    }


# ── wisnus (WisnusStat) ───────────────────────────────────────────────────────


@dataclass
class _Wisnus:
    rows: list[dict[str, Any]]

    @property
    def kota_list(self) -> list[str]:
        return sorted({r["kota"] for r in self.rows})

    @property
    def years(self) -> list[str]:
        return sorted({r["tahun"] for r in self.rows})

    def n_bulan(self, y: str) -> int:
        # Q15: dihitung dari seluruh kota, tidak ikut filter.
        return len({r["bulan"] for r in self.rows if r["tahun"] == y})

    def partial(self, y: str) -> bool:
        return self.n_bulan(y) < 12

    def y_label(self, y: str) -> str:
        n = self.n_bulan(y)
        return f"{y} (s/d {BULAN[n - 1]})" if self.partial(y) and n else y

    @property
    def tahun_default(self) -> str:
        n = len(self.kota_list)
        lengkap = [y for y in self.years if sum(1 for r in self.rows if r["tahun"] == y) >= 12 * n]
        return lengkap[-1] if lengkap else (self.years[-1] if self.years else "")

    def per_kota(self, y: str) -> list[dict[str, Any]]:
        hasil = [
            {"label": k, "value": sum(r["jumlah"] for r in self.rows if r["tahun"] == y and r["kota"] == k)}
            for k in self.kota_list
        ]
        return sorted(hasil, key=lambda p: -p["value"])

    def tahun_hilang(self) -> list[str]:
        if not self.years:
            return []
        return [str(y) for y in range(int(self.years[0]), int(self.years[-1]) + 1) if str(y) not in self.years]


def _kota(wn: _Wisnus, kota: str | None, semua: str) -> str:
    if kota is None:
        return semua
    if wn.rows and kota != semua and kota not in wn.kota_list:
        raise InvalidParam(f"kota tidak dikenal: {kota}")
    return kota


def wisnus_meta(m: Muat) -> dict[str, Any]:
    (rows,) = m.ambil("wisnus_kota")
    wn = _Wisnus(rows)
    hilang = wn.tahun_hilang()
    return {
        "kota": wn.kota_list,
        "tahun": wn.years,
        "tahun_hilang_teks": f"Tahun {', '.join(hilang)} belum tersedia." if hilang else None,
        "tahun_default": wn.tahun_default or None,
    }


def wisnus_tahunan(m: Muat, kota: str | None) -> dict[str, Any]:
    (rows,) = m.ambil("wisnus_kota")
    wn = _Wisnus(rows)
    kota = _kota(wn, kota, SEMUA)
    if not rows:
        return {"tahun": [], "kpi": []}
    sel = rows if kota == SEMUA else [r for r in rows if r["kota"] == kota]

    def total(y: str) -> int:
        return sum(r["jumlah"] for r in sel if r["tahun"] == y)

    years = wn.years
    full = [y for y in years if not wn.partial(y)]
    last_full = full[-1] if full else None
    prev_full = full[-2] if len(full) > 1 else None
    growth = (total(last_full) - total(prev_full)) / total(prev_full) * 100 if last_full and prev_full else None
    last = years[-1]
    ytd_months = wn.n_bulan(last) if wn.partial(last) else 12

    def ytd(y: str) -> int:
        return sum(r["jumlah"] for r in sel if r["tahun"] == y and r["bulan"] <= ytd_months)

    pk = wn.per_kota(last_full or last)
    top = pk[0] if pk else None
    return {
        "tahun": [{"label": wn.y_label(y), "value": total(y)} for y in years],
        "kpi": [
            kpi(f"Capaian {last_full or '—'}", total(last_full) if last_full else "—", "perjalanan"),
            kpi(
                f"Pertumbuhan {last_full or ''}",
                f"{id_num(growth, 1)}%" if growth is not None else "—",
                f"vs {prev_full}" if prev_full else None,
                growth,
            ),
            kpi(
                wn.y_label(last),
                total(last),
                f"Jan–{BULAN[ytd_months - 1]} {last_full}: {id_num(ytd(last_full))}"
                if last_full and wn.partial(last)
                else "perjalanan",
            ),
            kpi(
                f"Tujuan terbanyak {last_full or ''}",
                top["label"] if top else "—",
                f"{id_num(top['value'])} perjalanan" if top else None,
            ),
        ],
    }


def wisnus_bulanan(m: Muat, kota: str | None) -> dict[str, Any]:
    (rows,) = m.ambil("wisnus_kota")
    wn = _Wisnus(rows)
    kota = _kota(wn, kota, SEMUA)
    daftar = wn.kota_list if kota == SEMUA else [kota]
    return {
        "seri": [
            {"name": k, "data": [{"label": r["periode"], "value": r["jumlah"]} for r in rows if r["kota"] == k]}
            for k in daftar
        ]
    }


def wisnus_yoy(m: Muat, kota: str | None) -> dict[str, Any]:
    (rows,) = m.ambil("wisnus_kota")
    wn = _Wisnus(rows)
    kota = _kota(wn, kota, SELURUH)
    yoy_rows = rows if kota == SELURUH else [r for r in rows if r["kota"] == kota]
    per: dict[str, int] = {}
    kota_per: dict[str, set[str]] = {}
    for r in yoy_rows:
        per[r["periode"]] = per.get(r["periode"], 0) + r["jumlah"]
        kota_per.setdefault(r["periode"], set()).add(r["kota"])
    bulanan = sorted(
        ({"periode": p, "tahun": p[:4], "bulan": int(p[5:7]), "jumlah": j} for p, j in per.items()),
        key=lambda r: r["periode"],
    )
    tahun_yoy = list(dict.fromkeys(r["tahun"] for r in bulanan))[-3:]
    seri = [
        {
            "name": f"{y} •" if wn.partial(y) else y,
            "data": [{"label": BULAN[r["bulan"] - 1], "value": r["jumlah"]} for r in bulanan if r["tahun"] == y],
        }
        for y in tahun_yoy
    ]
    pertumbuhan = []
    for r in bulanan:
        prev = f"{int(r['tahun']) - 1}-{r['bulan']:02d}"
        p = per.get(prev)
        # Q16: hanya bila himpunan kota yang berkontribusi sama di kedua bulan.
        if p and kota_per.get(r["periode"]) == kota_per.get(prev):
            pertumbuhan.append({"periode": r["periode"], "persen": js_round((r["jumlah"] / p - 1) * 100 * 10) / 10})
    return {"kategori": BULAN, "seri": seri, "pertumbuhan": pertumbuhan}


def wisnus_per_kota(m: Muat, tahun: str | None) -> dict[str, Any]:
    (rows,) = m.ambil("wisnus_kota")
    wn = _Wisnus(rows)
    if tahun is not None and wn.years and tahun not in wn.years:
        raise InvalidParam(f"tahun tidak tersedia: {tahun}")
    year = tahun or wn.tahun_default
    if not year:
        return {"label": "", "items": []}
    return {"label": wn.y_label(year), "items": wn.per_kota(year)}


# ── tenaga kerja (tenaga-kerja/page.tsx, TkSubsektor) ─────────────────────────


def _porsi(r: dict[str, Any]) -> float | None:
    return js_round((r["total"] / r["nasional"]) * 10000) / 100 if r["nasional"] else None


def tenaga_kerja_dki(m: Muat) -> dict[str, Any]:
    (rows,) = m.ambil("tk_dki")
    dki = [r for r in rows if r["total"] > 0]
    kpis: list[dict[str, Any]] = []
    if dki:
        last, prev = dki[-1], (dki[-2] if len(dki) > 1 else None)
        growth = (last["total"] - prev["total"]) / prev["total"] * 100 if prev else None
        porsi = _porsi(last)
        kpis = [
            kpi(f"Tenaga kerja ekraf DKI {last['tahun']}", last["total"], "orang"),
            kpi(
                f"Pertumbuhan {last['tahun']}",
                f"{id_num(growth, 1)}%" if growth is not None else "—",
                f"vs {prev['tahun']}" if prev else None,
                growth,
            ),
            kpi(
                f"Porsi terhadap nasional {last['tahun']}",
                f"{id_num(porsi, 2)}%" if porsi is not None else "—",
                f"nasional {id_num(last['nasional'])} orang",
            ),
            kpi(
                f"Laki-laki / Perempuan {last['tahun']}",
                f"{id_num(last['laki'])} / {id_num(last['perempuan'])}",
                "orang",
            ),
        ]
    return {
        "rows": [
            {
                "tahun": r["tahun"],
                "total": r["total"],
                "porsi_pct": _porsi(r),
                "laki": r["laki"],
                "perempuan": r["perempuan"],
            }
            for r in dki
        ],
        "kpi": kpis,
    }


def tenaga_kerja_subsektor(m: Muat, tahun: str | None) -> dict[str, Any]:
    (rows,) = m.ambil("tk_subsektor")
    tahun_list = sorted({r["tahun"] for r in rows})
    if tahun is not None and tahun_list and tahun not in tahun_list:
        raise InvalidParam(f"tahun tidak tersedia: {tahun}")
    t = tahun or (tahun_list[-1] if tahun_list else "")
    items = sorted(
        ({"label": r["subsektor"], "value": r["jumlah"]} for r in rows if r["tahun"] == t), key=lambda p: -p["value"]
    )
    return {"tahun_list": tahun_list, "tahun": t, "items": items}


def _urut_bidang(rows: list[dict[str, Any]]) -> list[str]:
    tahun_awal: dict[str, str] = {}
    for r in rows:
        tahun_awal.setdefault(r["bidang"], r["tahun"])
    dikenal = [b for b in URUTAN_BIDANG if b in tahun_awal]
    baru = sorted((b for b in tahun_awal if b not in URUTAN_BIDANG), key=lambda b: (tahun_awal[b], b))
    return dikenal + baru


def tenaga_kerja_sertifikasi(m: Muat) -> dict[str, Any]:
    (sert,) = m.ambil("sertifikasi")
    years = sorted({r["tahun"] for r in sert})
    bidang = _urut_bidang(sert)
    nilai = {(r["tahun"], r["bidang"]): r["jumlah"] for r in sert}
    return {
        "per_tahun": [{"label": y, "value": sum(r["jumlah"] for r in sert if r["tahun"] == y)} for y in years],
        "bidang": [title_case(b) for b in bidang],
        "seri": [
            {"name": y, "data": [{"label": title_case(b), "value": nilai.get((y, b), 0)} for b in bidang]}
            for y in years
        ],
    }


# ── PDRB (PdrbEkrafStat) ──────────────────────────────────────────────────────


def _label_pdrb(p: str) -> str:
    return "2025 (Sem I)" if p == "S1 2025" else p


def pdrb_makro(m: Muat) -> dict[str, Any]:
    rows = _makro(m)
    target = _target_kontribusi(m)
    periode = [r["periode"] for r in rows]
    kontribusi = {r["periode"]: _angka(r["kontribusi"]) for r in rows}
    cats = [*periode, "2026", "2027", "2028", "2029"]
    return {
        "sumber": PDRB_SUMBER,
        "rows": [
            {
                "periode": r["periode"],
                "label": _label_pdrb(r["periode"]),
                "adhb_ekraf": _angka(r["adhb_ekraf"]),
                "adhb_dki": _angka(r["adhb_dki"]),
                "kontribusi_pct": _angka(r["kontribusi"]),
                "adhk_ekraf": _angka(r["adhk_ekraf"]),
                "tumbuh_ekraf_pct": _angka(r["tumbuh_ekraf"]),
                "tumbuh_non_ekraf_pct": _angka(r["tumbuh_non_ekraf"]),
                "tumbuh_dki_pct": _angka(r["tumbuh_dki"]),
            }
            for r in rows
        ],
        "kontribusi_vs_target": [
            {
                "label": _label_pdrb(c),
                "capaian": kontribusi.get(c),
                "target": target.get("2025" if c == "S1 2025" else c),
            }
            for c in cats
        ],
        "target_kontribusi": [{"tahun": t, "target_pct": v} for t, v in target.items()],
    }


def _subsektor(m: Muat, periode: str | None) -> tuple[list[str], str, list[dict[str, Any]]]:
    """Baris subsektor satu periode, urutan Bronze (= urutan `PDRB_SUBSEKTOR`, penentu nilai seri)."""
    rows = m.bronze("pdrb_ekraf_subsektor")
    daftar = sorted({r["periode"] for r in rows})
    p = periode or "2024"
    if p not in daftar:
        raise InvalidParam(f"periode tidak tersedia: {p}")
    return daftar, p, [r for r in rows if r["periode"] == p]


def pdrb_sebaran(m: Muat, periode: str | None) -> dict[str, Any]:
    daftar, p, rows = _subsektor(m, periode)
    total = 0.0
    for r in rows:
        total += _angka(r["adhb"])

    def pct(v: float) -> float:
        return js_round((v / total) * 10000) / 100

    urut = sorted(({"label": r["subsektor"], "value": _angka(r["adhb"])} for r in rows), key=lambda s: -s["value"])
    sisa = 0.0
    for s in urut[5:]:
        sisa += s["value"]
    distribusi = [
        {"label": PENDEK.get(s["label"], s["label"]), "nama": s["label"], "pct": pct(s["value"])} for s in urut[:5]
    ]
    distribusi.append({"label": "Lainnya", "nama": "Lainnya", "pct": pct(sisa)})
    return {
        "periode_list": daftar,
        "periode": p,
        "label": _label_pdrb(p),
        "distribusi": distribusi,
        "nilai_top10": urut[:10],
    }


def pdrb_pertumbuhan(m: Muat, periode: str | None) -> dict[str, Any]:
    daftar, p, rows = _subsektor(m, periode)
    items = sorted(({"label": r["subsektor"], "value": _angka(r["tumbuh"])} for r in rows), key=lambda s: -s["value"])
    return {"periode_list": daftar, "periode": p, "label": _label_pdrb(p), "items": items}
