#!/usr/bin/env python3
"""Pipeline dataset jumlah kamar hotel DKI Jakarta (terkini).

Menggabungkan tiga sumber menjadi satu dataset sekunder yang bisa diaudit
per-baris:

  1. Baseline SDI 2020 (`scripts/hotel_kamar/baseline_2020.jsonl`) — 425
     hotel unik hasil dedup nama+alamat, sumber BPS SDI DKI Jakarta.
  2. Rekapitulasi 2023 (`scripts/hotel_kamar/rekap_2023.jsonl`) — 120
     hotel hasil snapshot rekapitulasi usaha & kamar hotel.
  3. Riset web (folder `riset/batch_*.json`) — diisi manual oleh plan 02,
     satu JSON per batch (18 hotel). Bentuk: `{ "H001": {status,
     nama_terkini, kamar_terkini, tahun_sumber, sumber, catatan}, ... }`.

Aturan prioritas `kamar_terkini` (lihat `plans/2026-09-30-hotel-kamar-01-pipeline.md`):
  - Riset DITEMUKAN (angka int > 0) → sumber = `riset_web`, tahun = `tahun_sumber`
  - Riset TUTUP → kamar_terkini = null (hotel tutup)
  - Riset RAGU/TIDAK_DITEMUKAN → fallback ke rekap 2023, lalu SDI 2020
  - Tidak ada riset → fallback ke rekap 2023, lalu SDI 2020

Dataset TIDAK menyentuh lakehouse — outputnya adalah dua berkas lokal:
  - `data/sekunder/hotel-kamar-jakarta.json`
  - `platform-v2/data/hotel-kamar-jakarta.json`  (mirror yang dibaca app)

Jalankan dari root repo: `python scripts/hotel_kamar/build.py`
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]  # scripts/hotel_kamar/ → root

BASELINE_PATH = REPO_ROOT / "scripts" / "hotel_kamar" / "baseline_2020.jsonl"
REKAP_PATH = REPO_ROOT / "scripts" / "hotel_kamar" / "rekap_2023.jsonl"
RISET_DIR = REPO_ROOT / "scripts" / "hotel_kamar" / "riset"
OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "hotel-kamar-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "hotel-kamar-jakarta.json"

SLUG = "hotel-kamar-jakarta"
TITLE = "Hotel & Jumlah Kamar DKI Jakarta (terkini)"
DESCRIPTION = (
    "Daftar hotel DKI Jakarta dengan jumlah kamar terkini, digabung dari tiga "
    "sumber: (1) baseline SDI 2020 hasil dedup nama+alamat, (2) rekapitulasi "
    "usaha & kamar hotel 2023, dan (3) riset web per hotel. Prioritas "
    "`kamar_terkini`: riset DITEMUKAN > rekap 2023 > SDI 2020; riset TUTUP "
    "membuat `kamar_terkini` null."
)

COLUMNS = [
    {"key": "id", "label": "ID", "type": "string",
     "description": "Id hotel: H001.. dari baseline 2020 (urut baris), N001.. dari rekap 2023 yang tidak cocok ke baseline."},
    {"key": "nama", "label": "Nama (2020)", "type": "string",
     "description": "Nama hotel menurut SDI 2020 (baris baseline)."},
    {"key": "nama_terkini", "label": "Nama Terkini", "type": "string",
     "description": "Nama hasil riset (mis. setelah rebranding); null bila tidak ada riset atau tidak berubah."},
    {"key": "golongan", "label": "Golongan", "type": "string",
     "description": "Golongan hotel (BINTANG 1..5, MELATI, NON BINTANG)."},
    {"key": "jenis", "label": "Jenis", "type": "string",
     "description": "Jenis usaha hotel (HOTEL BINTANG, HOTEL MELATI, dll)."},
    {"key": "wilayah", "label": "Wilayah", "type": "string",
     "description": "Kota administrasi DKI Jakarta (Jakarta Barat/Pusat/Selatan/Timur/Utara)."},
    {"key": "alamat", "label": "Alamat", "type": "string",
     "description": "Alamat hotel menurut SDI 2020 (baris baseline)."},
    {"key": "kamar_2020", "label": "Jumlah Kamar 2020", "type": "number",
     "description": "Jumlah kamar menurut SDI 2020; null untuk hotel baru dari rekap 2023."},
    {"key": "kamar_2023", "label": "Jumlah Kamar 2023", "type": "number",
     "description": "Jumlah kamar menurut rekap 2023 (cocok nama); null bila hotel tidak tercatat."},
    {"key": "kamar_terkini", "label": "Jumlah Kamar Terkini", "type": "number",
     "description": "Jumlah kamar terkini mengikuti prioritas riset DITEMUKAN > 2023 > 2020; null untuk hotel TUTUP."},
    {"key": "tahun_kamar_terkini", "label": "Tahun Sumber Kamar Terkini", "type": "number",
     "description": "Tahun acuan kamar_terkini (4 digit, mengikuti sumber)."},
    {"key": "sumber_kamar_terkini", "label": "Sumber Kamar Terkini", "type": "string",
     "description": "Sumber yang dipakai untuk kamar_terkini: riset_web / rekap_2023 / sdi_2020; null untuk TUTUP."},
    {"key": "status_operasi", "label": "Status Operasi", "type": "string",
     "description": "Status operasional: BEROPERASI / TUTUP / TIDAK_DIKETAHUI."},
    {"key": "status_riset", "label": "Status Riset", "type": "string",
     "description": "Status riset web: DITEMUKAN / TUTUP / TIDAK_DITEMUKAN / RAGU; 'BELUM' bila belum ada riset."},
    {"key": "kamar_riset_ragu", "label": "Jumlah Kamar Riset (RAGU)", "type": "number",
     "description": "Angka kamar dari riset berstatus RAGU; disimpan terpisah agar tidak ikut kamar_terkini."},
    {"key": "url_sumber", "label": "URL Sumber Riset", "type": "string",
     "description": "URL sumber riset (situs hotel / berita); null bila bukan dari riset."},
    {"key": "catatan", "label": "Catatan", "type": "string",
     "description": "Catatan riset (Bahasa Indonesia); null bila tidak ada."},
]

VALID_RISET_STATUS = {"DITEMUKAN", "TUTUP", "TIDAK_DITEMUKAN", "RAGU"}

_PUNCT_RE = re.compile(r"[^a-z0-9 ]+")
_SPACE_RE = re.compile(r"\s+")
_DROP_WORDS = {"hotel", "the", "jakarta"}


def normalize_text(s: str) -> str:
    """Normalisasi teks: huruf kecil, trim, ganti tanda baca jadi spasi,
    spasi ganda jadi satu. Dipakai untuk dedup 2020 dan pencocokan nama."""
    s = (s or "").lower()
    s = _PUNCT_RE.sub(" ", s)
    s = _SPACE_RE.sub(" ", s).strip()
    return s


def normalize_match_key(s: str) -> str:
    """Kunci pencocokan nama 2023 ↔ 2020.

    - Buang prefiks jaringan di depan `/` (mis. `ACCOR/ FAIRMONT JAKARTA`
      → `FAIRMONT JAKARTA`); jaringan ditulis sebelum `/` seperti `ACCOR/`.
    - `normalize_text` (lowercase, trim, ganti tanda baca jadi spasi,
      spasi ganda → satu).
    - Buang kata umum: `hotel`, `the`, `jakarta`.
    - Hasil: nama inti yang dipakai untuk perbandingan.

    Contoh:
      ACCOR/ FAIRMONT JAKARTA → fairmont
      HOTEL THE GRAND JAKARTA → grand
      HOTEL ALPHA             → alpha
    """
    raw = s or ""
    if "/" in raw:
        raw = raw.split("/", 1)[1]
    s = normalize_text(raw)
    parts = [p for p in s.split(" ") if p and p not in _DROP_WORDS]
    return " ".join(parts)


def _to_int_or_none(v) -> int | None:
    """Tahun sumber dari riset kadang '?' atau kosong; ubah jadi None."""
    if v is None:
        return None
    if isinstance(v, int):
        return v
    s = str(v).strip()
    if not s or s == "?":
        return None
    try:
        return int(s)
    except ValueError:
        return None


# ---------- load -----------------------------------------------------------


def load_baseline(path: str | Path) -> list[dict]:
    """Baca baseline_2020.jsonl → list[dict] dengan kunci `h_*` apa adanya.
    Id H001.. ditetapkan belakangan oleh `assign_ids` setelah dedup."""
    rows: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(r)
    return rows


def load_rekap(path: str | Path) -> list[dict]:
    """Baca rekap_2023.jsonl → list[dict] dengan kunci `r_*` apa adanya."""
    rows: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(r)
    return rows


def load_riset(dirpath: str | Path) -> dict[str, dict]:
    """Baca folder riset → dict[id, entry]. Folder kosong / tak ada → {}.

    Setiap entry diharapkan: {status, nama_terkini, kamar_terkini,
    tahun_sumber, sumber, catatan}. Status harus salah satu dari
    VALID_RISET_STATUS; bila id tidak ada di dataset, apply_riset yang
    akan menolak.
    """
    riset: dict[str, dict] = {}
    p = Path(dirpath)
    if not p.exists():
        return riset
    for f in sorted(p.glob("*.json")):
        with open(f, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            raise SystemExit(f"riset {f.name} harus objek JSON (bukan list)")
        riset.update(data)
    return riset


# ---------- dedup 2020 -----------------------------------------------------


def dedup_baseline(rows: list[dict]) -> list[dict]:
    """Dedup defensif by (nama_norm, alamat_norm). Pertahankan kemunculan
    pertama. Mengembalikan dict dengan kunci dataset-ready."""
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for r in rows:
        key = (normalize_text(r.get("h_nama", "")),
               normalize_text(r.get("h_alamat", "")))
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "nama": r.get("h_nama", "").strip(),
            "golongan": r.get("h_golongan", "").strip(),
            "jenis": r.get("h_jenis", "").strip(),
            "wilayah": r.get("h_wilayah", "").strip(),
            "alamat": r.get("h_alamat", "").strip(),
            "kamar_2020": int(r["h_kamar"]) if r.get("h_kamar") not in (None, "") else None,
        })
    return out


def assign_ids(rows: list[dict]) -> list[dict]:
    """Beri id H001.. sesuai urutan input (tidak diurut ulang)."""
    for i, r in enumerate(rows, start=1):
        r["id"] = f"H{i:03d}"
    return rows


# ---------- match 2023 -----------------------------------------------------


def match_rekap(baseline_rows: list[dict], rekap_rows: list[dict]) -> tuple[dict[str, dict], list[dict]]:
    """Cocokkan baris rekap 2023 ke baris baseline via normalize_match_key(nama).
    Tepat sama (setelah normalisasi) → match. Fuzzy TIDAK dipakai.

    Returns:
      matched: dict[id_baseline, rekap_row] untuk yang cocok
      unmatched: list[rekap_row] untuk yang harus jadi baris baru (N..)
    """
    index = {}
    for r in baseline_rows:
        key = normalize_match_key(r["nama"])
        if not key:
            continue
        # Duplikat nama di baseline (sangat jarang setelah dedup): tetap
        # menunjuk ke entri pertama.
        index.setdefault(key, r)
    matched: dict[str, dict] = {}
    unmatched: list[dict] = []
    for r in rekap_rows:
        key = normalize_match_key(r.get("r_nama", ""))
        base = index.get(key)
        if base is not None:
            matched[base["id"]] = r
        else:
            unmatched.append(r)
    return matched, unmatched


# ---------- apply_riset ----------------------------------------------------


def apply_riset(rows: list[dict], riset: dict[str, dict]) -> dict[str, dict]:
    """Validasi id & status riset. Return dict[id, entry].

    Id yang tidak dikenal di rows → SystemExit.
    Status yang tidak sah → SystemExit.
    """
    known_ids = {r["id"] for r in rows}
    out: dict[str, dict] = {}
    for hid, entry in riset.items():
        if hid not in known_ids:
            raise SystemExit(
                f"riset berisi id yang tidak dikenal di dataset: {hid!r} "
                f"(cek apakah baris ini ada di baseline_2020.jsonl atau rekap_2023.jsonl)"
            )
        status = entry.get("status")
        if status not in VALID_RISET_STATUS:
            raise SystemExit(
                f"riset {hid}: status tidak sah {status!r}; "
                f"yang dizinkan: {sorted(VALID_RISET_STATUS)}"
            )
        out[hid] = entry
    return out


# ---------- resolve per-row ------------------------------------------------


def resolve_row(row: dict, rekap: dict | None, riset: dict | None) -> dict:
    """Terapkan aturan prioritas & status_operasi untuk satu baris.

    Aturan (lihat plan §Aturan):
      - Riset DITEMUKAN (kamar_terkini int > 0) → kamar_terkini dari riset,
        sumber = riset_web, tahun = tahun_sumber.
      - Riset TUTUP → kamar_terkini null, sumber null, tahun null,
        status_operasi = TUTUP.
      - Riset RAGU → kamar_terkini jatuh ke 2023/2020; angka ragu masuk
        kamar_riset_ragu.
      - Riset TIDAK_DITEMUKAN / tanpa riset → kamar_terkini jatuh ke
        2023 (jika ada) atau 2020.
    """
    id_ = row["id"]
    nama = row.get("nama")
    kamar_2020 = row.get("kamar_2020")
    kamar_2023 = (rekap or {}).get("r_kamar") if rekap else None
    if kamar_2023 is not None:
        kamar_2023 = int(kamar_2023)

    # nilai default
    kamar_terkini: int | None = None
    sumber_kamar_terkini: str | None = None
    tahun_kamar_terkini: int | None = None
    status_operasi = "TIDAK_DIKETAHUI"
    status_riset = "BELUM"
    kamar_riset_ragu: int | None = None
    nama_terkini: str | None = None
    url_sumber: str | None = None
    catatan: str | None = None

    if riset is not None:
        status_riset = riset["status"]
        nama_terkini = riset.get("nama_terkini") or None
        url_sumber = riset.get("sumber") or None
        catatan = riset.get("catatan") or None
        if riset["status"] == "DITEMUKAN":
            kt = riset.get("kamar_terkini")
            if kt is not None and int(kt) > 0:
                kamar_terkini = int(kt)
                sumber_kamar_terkini = "riset_web"
                tahun_kamar_terkini = _to_int_or_none(riset.get("tahun_sumber"))
        elif riset["status"] == "RAGU":
            kr = riset.get("kamar_terkini")
            if kr is not None:
                try:
                    kamar_riset_ragu = int(kr)
                except (TypeError, ValueError):
                    kamar_riset_ragu = None
        # TUTUP & TIDAK_DITEMUKAN: tidak menyumbang kamar_terkini
        elif riset["status"] == "TUTUP":
            pass  # tetap null di bawah
        elif riset["status"] == "TIDAK_DITEMUKAN":
            pass

    # TUTUP menang: paksa null bila riset TUTUP
    if riset is not None and riset["status"] == "TUTUP":
        kamar_terkini = None
        sumber_kamar_terkini = None
        tahun_kamar_terkini = None

    # Fallback ke 2023 → 2020 kalau belum ada nilai
    if kamar_terkini is None and riset is None or (
        riset is not None and riset["status"] != "TUTUP" and kamar_terkini is None
    ):
        if kamar_2023 is not None:
            kamar_terkini = int(kamar_2023)
            sumber_kamar_terkini = "rekap_2023"
            tahun_kamar_terkini = int(str(rekap["r_periode"])[:4])
        elif kamar_2020 is not None:
            kamar_terkini = int(kamar_2020)
            sumber_kamar_terkini = "sdi_2020"
            tahun_kamar_terkini = 2020

    # status_operasi
    if riset is not None and riset["status"] == "TUTUP":
        status_operasi = "TUTUP"
    elif riset is not None and riset["status"] == "DITEMUKAN":
        status_operasi = "BEROPERASI"
    elif kamar_2023 is not None:
        status_operasi = "BEROPERASI"
    else:
        status_operasi = "TIDAK_DIKETAHUI"

    return {
        "id": id_,
        "nama": nama,
        "nama_terkini": nama_terkini,
        "golongan": row.get("golongan"),
        "jenis": row.get("jenis"),
        "wilayah": row.get("wilayah"),
        "alamat": row.get("alamat"),
        "kamar_2020": kamar_2020,
        "kamar_2023": kamar_2023,
        "kamar_terkini": kamar_terkini,
        "tahun_kamar_terkini": tahun_kamar_terkini,
        "sumber_kamar_terkini": sumber_kamar_terkini,
        "status_operasi": status_operasi,
        "status_riset": status_riset,
        "kamar_riset_ragu": kamar_riset_ragu,
        "url_sumber": url_sumber,
        "catatan": catatan,
    }


# ---------- build ----------------------------------------------------------


def build_dataset(baseline_path: str | Path,
                  rekap_path: str | Path,
                  riset_dir: str | Path) -> dict:
    """Membangun dataset utuh (dict siap-serialize).

    Urutan:
      1. Baca + dedup + beri id baseline → rows H001..
      2. Match rekap 2023 ke baseline; sisanya jadi N001..
      3. Baca + validasi riset.
      4. Untuk tiap baris, panggil resolve_row(baseline, rekap, riset).
      5. Susun dict dataset dengan slug/title/description/columns/rows/meta.
    """
    baseline_raw = load_baseline(baseline_path)
    baseline_dedup = dedup_baseline(baseline_raw)
    baseline = assign_ids(baseline_dedup)

    rekap_raw = load_rekap(rekap_path)
    matched_rekap, unmatched_rekap = match_rekap(baseline, rekap_raw)

    riset_all = load_riset(riset_dir)
    riset = apply_riset(baseline + [
        {"id": f"N{i:03d}"} for i in range(1, len(unmatched_rekap) + 1)
    ], riset_all)

    rows: list[dict] = []

    # baris baseline (H001..)
    for b in baseline:
        hid = b["id"]
        r = resolve_row(
            b,
            matched_rekap.get(hid),
            riset.get(hid),
        )
        rows.append(r)

    # baris baru dari rekap yang tak cocok (N001..)
    for i, rec in enumerate(unmatched_rekap, start=1):
        nid = f"N{i:03d}"
        # untuk baris baru, kamar_2020 tidak ada
        placeholder = {
            "id": nid,
            "nama": rec.get("r_nama", "").strip(),
            "golongan": rec.get("r_golongan", "").strip(),
            "jenis": None,  # tidak ada di rekap
            "wilayah": rec.get("r_wilayah", "").strip(),
            "alamat": rec.get("r_alamat", "").strip(),
            "kamar_2020": None,
        }
        # rekap untuk baris baru = diri sendiri
        r = resolve_row(placeholder, rec, riset.get(nid))
        rows.append(r)

    # summary meta
    sumber_dist: dict[str, int] = {}
    total_kamar_aktif = 0
    for r in rows:
        s = r["sumber_kamar_terkini"] or "(null)"
        sumber_dist[s] = sumber_dist.get(s, 0) + 1
        if r["status_operasi"] != "TUTUP" and r["kamar_terkini"] is not None:
            total_kamar_aktif += int(r["kamar_terkini"])

    matched_2023 = sum(1 for r in rows if r["kamar_2023"] is not None)
    n_count = sum(1 for r in rows if r["id"].startswith("N"))

    out = {
        "slug": SLUG,
        "title": TITLE,
        "description": DESCRIPTION,
        "columns": COLUMNS,
        "rows": rows,
        "meta": {
            "jumlah_baris": len(rows),
            "matched_2023_ke_2020": matched_2023 - n_count,  # hanya baseline H.. yang match
            "matched_2023_total": matched_2023,  # termasuk N..
            "baris_baru_N": n_count,
            "total_kamar_aktif": total_kamar_aktif,
            "sebaran_sumber_kamar_terkini": sumber_dist,
        },
    }
    return out


# ---------- serialize ------------------------------------------------------


def serialize(ds: dict) -> bytes:
    """Serial dict dataset ke bytes (UTF-8, ensure_ascii=False, indent=0).

    indent=0 = setiap kunci top-level + elemen list/object di baris sendiri
    (lihat hotel-transit-jakarta.json). Tidak ada indent di dalam objek.
    """
    return json.dumps(ds, ensure_ascii=False, indent=0).encode("utf-8")


def write_dataset(path: Path, ds: dict) -> None:
    """Tulis dataset ke path dengan trailing newline (konvensi repo)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = serialize(ds)
    if not raw.endswith(b"\n"):
        raw += b"\n"
    path.write_bytes(raw)


# ---------- main -----------------------------------------------------------


def main() -> int:
    print(f"[hotel_kamar] Baseline : {BASELINE_PATH.relative_to(REPO_ROOT)}")
    print(f"[hotel_kamar] Rekap 2023: {REKAP_PATH.relative_to(REPO_ROOT)}")
    print(f"[hotel_kamar] Riset dir : {RISET_DIR.relative_to(REPO_ROOT)}")
    print(f"[hotel_kamar] Output    : {OUTPUT_JSON.relative_to(REPO_ROOT)} + mirror platform-v2/")

    if not BASELINE_PATH.exists():
        print(f"!! baseline tidak ditemukan: {BASELINE_PATH}", file=sys.stderr)
        return 2
    if not REKAP_PATH.exists():
        print(f"!! rekap tidak ditemukan: {REKAP_PATH}", file=sys.stderr)
        return 2

    ds = build_dataset(BASELINE_PATH, REKAP_PATH, RISET_DIR)
    write_dataset(OUTPUT_JSON, ds)
    MIRROR_JSON.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(OUTPUT_JSON, MIRROR_JSON)

    meta = ds["meta"]
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Baris total                      : {meta['jumlah_baris']}")
    print(f"  matched 2023 ke 2020 (H..)      : {meta['matched_2023_ke_2020']}")
    print(f"  baris baru dari 2023 (N..)      : {meta['baris_baru_N']}")
    print(f"Total kamar_terkini (eks. TUTUP)  : {meta['total_kamar_aktif']:,}")
    print("Sebaran sumber_kamar_terkini      :")
    for k, v in sorted(meta["sebaran_sumber_kamar_terkini"].items()):
        print(f"  {k:14s} : {v}")
    print(f"Disimpan ke: {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    print(f"Mirror    : {MIRROR_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())