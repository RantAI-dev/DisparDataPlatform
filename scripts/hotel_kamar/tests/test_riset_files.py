r"""Tes untuk validasi berkas riset per-batch (`scripts/hotel_kamar/riset/batch_NN.json`).

Aturan yang dites (lihat `plans/2026-09-30-hotel-kamar-02-riset.md` dan
batch plan §Aturan berkas riset):

  1. Setiap `batch_NN.json` adalah satu objek JSON (bukan list), kunci = id
     hotel bentuk `H\d{3}`.
  2. NN = dua digit (00..23). batch_NN berisi tepat id
     `H{NN*18+1:03d}` … `H{min(NN*18+18, 425):03d}` (split tetap 18/batch;
     batch terakhir punya 11 id).
  3. Semua id di batch harus ada di `baseline_2020.jsonl` (kunci `h_*`).
  4. `status` wajib ∈ {DITEMUKAN, TUTUP, TIDAK_DITEMUKAN, RAGU}.
  5. `sumber` wajib string URL `http(s)://...` untuk SETIAP entry — bahkan
     untuk TUTUP / TIDAK_DITEMUKAN (URL bukti yang dikonsultasikan; URL
     search-engine tidak boleh).
  6. DITEMUKAN ⇒ `kamar_terkini` int > 0.
  7. TUTUP / TIDAK_DITEMUKAN ⇒ `kamar_terkini` null.
  8. DITEMUKAN dengan rasio `kamar_terkini / kamar_2020` di luar 1/3..3 ⇒
     `catatan` wajib string non-kosong (penjelasan anomali).
  9. `tahun_sumber` wajib string 4 digit atau literal `"?"`.
  10. `catatan` (jika string) tidak boleh memuat kata "placeholder"
      (case-insensitive). Mencegah teks sementara lolos ke baseline.

Suite harus PASS dengan folder `riset/` kosong: `pytest.parametrize` di-glob
pada runtime → 0 file = 0 kasus = kosong (vacuous). Satu tes langsung
menulis batch buruk ke `tmp_path` lalu memanggil validator; inilah mutation
check yang dibangun ke dalam desain (validator harus menolak status tak
sah).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

RISET_DIR = Path(__file__).resolve().parents[1] / "riset"
BASELINE_PATH = Path(__file__).resolve().parents[1] / "baseline_2020.jsonl"

VALID_STATUS = {"DITEMUKAN", "TUTUP", "TIDAK_DITEMUKAN", "RAGU"}
TOTAL_HOTELS = 425
BATCH_SIZE = 18
BATCH_FILENAME_RE = re.compile(r"^batch_(\d{2})\.json$")
HID_RE = re.compile(r"^H\d{3}$")


# ---------- helpers ---------------------------------------------------------


def _load_baseline() -> dict[str, dict]:
    """Baca baseline_2020.jsonl → dict[id, row].

    Id ditetapkan setelah dedup (sama logika dengan `build.assign_ids`):
    baris ke-N (1-indexed) → `H{N:03d}`. Returned dict punya semua kunci
    `h_*` mentah (h_nama, h_alamat, dst.) plus `id`.
    """
    rows: list[dict] = []
    with open(BASELINE_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    by_id: dict[str, dict] = {}
    for i, r in enumerate(rows, start=1):
        by_id[f"H{i:03d}"] = r
    return by_id


def expected_ids_for_batch(batch_nn: int) -> list[str]:
    """Id yang WAJIB ada di batch_NN.json, sesuai aritmatika split 18/batch."""
    if not (0 <= batch_nn <= 23):
        raise ValueError(f"batch_nn di luar jangkauan 0..23: {batch_nn}")
    start = batch_nn * BATCH_SIZE + 1
    end = min(batch_nn * BATCH_SIZE + BATCH_SIZE, TOTAL_HOTELS)
    return [f"H{i:03d}" for i in range(start, end + 1)]


def validate_riset_file(path: Path, baseline_by_id: dict[str, dict]) -> None:
    """Validasi satu batch_NN.json. Raise ValueError + pesan jelas kalau
    ada pelanggaran. Dipakai oleh kedua test (parametrize + tes langsung
    yang sengaja menulis batch buruk)."""
    m = BATCH_FILENAME_RE.match(path.name)
    if not m:
        raise ValueError(
            f"{path.name}: nama berkas harus batch_NN.json dengan NN dua digit"
        )
    batch_nn = int(m.group(1))
    expected = set(expected_ids_for_batch(batch_nn))

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(
            f"{path.name}: harus objek JSON (kunci = id hotel), dapat "
            f"{type(data).__name__}"
        )

    actual = set(data.keys())
    unknown = actual - set(baseline_by_id.keys())
    if unknown:
        raise ValueError(
            f"{path.name}: id tak dikenal di baseline_2020.jsonl: "
            f"{sorted(unknown)}"
        )

    missing = expected - actual
    extra = actual - expected
    if missing or extra:
        raise ValueError(
            f"{path.name}: isi harus tepat {sorted(expected)}; "
            f"kurang {sorted(missing)}, lebih {sorted(extra)}"
        )

    for hid, entry in data.items():
        if not isinstance(entry, dict):
            raise ValueError(
                f"{path.name}:{hid}: nilai harus objek, dapat "
                f"{type(entry).__name__}"
            )

        # 4. status
        status = entry.get("status")
        if status not in VALID_STATUS:
            raise ValueError(
                f"{path.name}:{hid}: status tidak sah {status!r}; "
                f"yang dizinkan: {sorted(VALID_STATUS)}"
            )

        # 5. sumber wajib URL http(s) untuk SEMUA entry
        sumber = entry.get("sumber")
        if not isinstance(sumber, str) or not (
            sumber.startswith("http://") or sumber.startswith("https://")
        ):
            raise ValueError(
                f"{path.name}:{hid}: sumber wajib string URL http(s); "
                f"dapat {sumber!r}"
            )

        # 6 & 7. kamar_terkini sesuai status
        kt = entry.get("kamar_terkini")
        if status == "DITEMUKAN":
            if not isinstance(kt, int) or isinstance(kt, bool) or kt <= 0:
                raise ValueError(
                    f"{path.name}:{hid}: DITEMUKAN kamar_terkini wajib int > 0; "
                    f"dapat {kt!r}"
                )
        elif status in ("TUTUP", "TIDAK_DITEMUKAN"):
            if kt is not None:
                raise ValueError(
                    f"{path.name}:{hid}: {status} kamar_terkini wajib null; "
                    f"dapat {kt!r}"
                )

        # 8. rasio di luar 1/3..3 ⇒ catatan wajib non-kosong
        if status == "DITEMUKAN":
            base_row = baseline_by_id.get(hid, {})
            try:
                k2020 = int(base_row.get("h_kamar")) if base_row.get("h_kamar") not in (None, "") else None
            except (TypeError, ValueError):
                k2020 = None
            if k2020 and k2020 > 0 and isinstance(kt, int) and kt > 0:
                ratio = kt / k2020
                if ratio > 3 or ratio < 1 / 3:
                    catatan = entry.get("catatan")
                    if not isinstance(catatan, str) or not catatan.strip():
                        raise ValueError(
                            f"{path.name}:{hid}: rasio {kt}/{k2020}={ratio:.2f} "
                            f"di luar 1/3..3, catatan wajib non-kosong; "
                            f"dapat {catatan!r}"
                        )

        # 10. catatan (jika string) tidak boleh memuat kata "placeholder"
        catatan_val = entry.get("catatan")
        if isinstance(catatan_val, str) and "placeholder" in catatan_val.lower():
            raise ValueError(
                f"{path.name}:{hid}: catatan tidak boleh memuat kata "
                f"'placeholder' (case-insensitive); dapat {catatan_val!r}"
            )

        # 9. tahun_sumber
        ts = entry.get("tahun_sumber")
        if not isinstance(ts, str):
            raise ValueError(
                f"{path.name}:{hid}: tahun_sumber wajib string; dapat {ts!r}"
            )
        if not (ts == "?" or (len(ts) == 4 and ts.isdigit())):
            raise ValueError(
                f"{path.name}:{hid}: tahun_sumber wajib 4 digit atau '?'; "
                f"dapat {ts!r}"
            )


# ---------- tes langsung: mutation check bawaan ----------------------------


def test_validator_rejects_batch_bad_status(tmp_path):
    """Tulis batch dengan satu entry ber-status tak sah ke tmp_path; panggil
    validator; expect ValueError. Ini juga menjadi mutation check: kalau
    validator kehilangan cek status, tes ini gagal.

    18 id lengkap (sesuai aritmatika batch_00) harus ada — kalau tidak,
    validator berhenti di cek keanggotaan batch dan pesan yang muncul bukan
    soal status. Hanya H001 yang故意 ber-status tak sah; 17 id lain valid
    (status DITEMUKAN dengan kamar=2020, rasio = 1) supaya tidak ada
    aturan lain yang firing duluan.
    """
    entries: dict[str, dict] = {}
    baseline_rows = _load_baseline()
    for hid in expected_ids_for_batch(0):
        row = baseline_rows[hid]
        k2020 = int(row["h_kamar"])
        entries[hid] = {
            "status": "DITEMUKAN",
            "nama_terkini": None,
            "kamar_terkini": k2020,  # rasio = 1, tidak picu cek catatan
            "tahun_sumber": "2024",
            "sumber": f"https://contoh.test/{hid.lower()}",
            "catatan": None,
        }
    # Sekarang rusak H001 dengan status tak sah
    entries["H001"]["status"] = "FOOBAR"
    bad = tmp_path / "batch_00.json"
    bad.write_text(json.dumps(entries), encoding="utf-8")

    with pytest.raises(ValueError) as exc_info:
        validate_riset_file(bad, baseline_rows)
    msg = str(exc_info.value)
    assert "FOOBAR" in msg or "status" in msg.lower()


# ---------- tes parametrized: satu kasus per batch_NN.json yang committed ---


def _collect_batch_files() -> list[Path]:
    if not RISET_DIR.exists():
        return []
    return sorted(RISET_DIR.glob("batch_*.json"))


@pytest.mark.parametrize("batch_path", _collect_batch_files())
def test_batch_file_is_valid(batch_path: Path) -> None:
    """Validasi satu berkas batch. Dengan folder riset/ kosong, glob
    mengembalikan list kosong → pytest mengumpulkan 0 kasus → vacuous PASS."""
    baseline = _load_baseline()
    validate_riset_file(batch_path, baseline)