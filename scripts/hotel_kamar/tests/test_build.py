"""Tes untuk pipeline build dataset jumlah kamar hotel DKI Jakarta.

Aturan yang dites (lihat plans/2026-09-30-hotel-kamar-01-pipeline.md §Aturan
penggabungan):
  1. Normalisasi teks & nama untuk pencocokan.
  2. Dedup 2020 by (normalized nama, normalized alamat) — pertahankan
     kemunculan pertama.
  3. Pencocokan 2023 ke 2020 lewat nama ternormalkan + buang prefiks
     jaringan ("ACCOR/ X") dan kata umum ("hotel", "the", "jakarta").
  4. Baris 2023 yang tak cocok jadi baris baru N001..
  5. Riset diterapkan per id; id tak dikenal / status tak sah → gagal keras.
  6. Prioritas kamar_terkini: DITEMUKAN > 2023 > 2020; RAGU tidak menimpa.
  7. sumber_kamar_terkini & tahun_kamar_terkini mengikuti sumber.
  8. status_operasi (TUTUP / BEROPERASI / TIDAK_DIKETAHUI) sesuai kombinasi
     riset + rekap. status_riset = "BELUM" bila tak ada entry riset.
  9. Idempoten: dua kali build dengan input sama → output byte-identical.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402


# ---------- helpers ---------------------------------------------------------


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def write_json(path: Path, obj) -> None:
    """Tulis satu objek JSON (untuk file riset; satu dict per file)."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def small_baseline() -> list[dict]:
    """Fixture baseline_2020 sintetik (3 baris)."""
    return [
        {"h_nama": "HOTEL ALPHA", "h_jenis": "MELATI", "h_golongan": "MELATI 1",
         "h_kamar": 50, "h_alamat": "JL. A NO. 1", "h_wilayah": "JAKARTA BARAT"},
        {"h_nama": "FAIRMONT HOTEL JAKARTA", "h_jenis": "HOTEL BINTANG",
         "h_golongan": "BINTANG 5", "h_kamar": 488, "h_alamat": "JL SENAYAN 1",
         "h_wilayah": "JAKARTA PUSAT"},
        {"h_nama": "BETA HOTEL", "h_jenis": "MELATI", "h_golongan": "MELATI 2",
         "h_kamar": 100, "h_alamat": "JL. B NO. 2", "h_wilayah": "JAKARTA PUSAT"},
    ]


# ---------- normalisasi ----------------------------------------------------


def test_normalize_text_lowercases_and_strips_punctuation():
    assert build.normalize_text("  ABC-XYZ  ") == "abc xyz"


def test_normalize_text_collapses_whitespace():
    assert build.normalize_text("A   B\tC") == "a b c"


def test_normalize_text_keeps_slash_stripped_to_space():
    # tanda baca jadi spasi, lalu di-trim
    assert build.normalize_text("ACCOR/FAIRMONT") == "accor fairmont"


def test_normalize_match_key_strips_network_prefix_after_slash():
    # Kasus utama dari plan: "ACCOR/ FAIRMONT JAKARTA" → "fairmont"
    assert build.normalize_match_key("ACCOR/ FAIRMONT JAKARTA") == "fairmont"


def test_normalize_match_key_drops_common_words():
    assert build.normalize_match_key("HOTEL THE GRAND JAKARTA") == "grand"


def test_normalize_match_key_handles_plain_hotel_name():
    assert build.normalize_match_key("HOTEL ALPHA") == "alpha"


# ---------- dedup 2020 ------------------------------------------------------


def test_dedup_baseline_keeps_first_occurrence_by_normalized_pair():
    """Dedup defensif: kunci = (nama_norm, alamat_norm). Pertahankan entri pertama."""
    rows = [
        {"h_nama": "  ALPHA HOTEL ", "h_jenis": "MELATI", "h_golongan": "MELATI 1",
         "h_kamar": 10, "h_alamat": "JL. A NO. 1", "h_wilayah": "JAKARTA BARAT"},
        {"h_nama": "ALPHA HOTEL", "h_jenis": "MELATI", "h_golongan": "MELATI 1",
         "h_kamar": 99, "h_alamat": "JL. A NO. 1", "h_wilayah": "JAKARTA BARAT"},
        {"h_nama": "BETA HOTEL", "h_jenis": "MELATI", "h_golongan": "MELATI 2",
         "h_kamar": 20, "h_alamat": "JL. B NO. 2", "h_wilayah": "JAKARTA PUSAT"},
    ]
    out = build.dedup_baseline(rows)
    assert len(out) == 2
    assert out[0]["nama"].strip() == "ALPHA HOTEL"
    assert out[0]["kamar_2020"] == 10  # kemunculan pertama
    assert out[1]["kamar_2020"] == 20


def test_dedup_baseline_id_assigns_h001_in_file_order():
    """Id stabil sesuai urutan baris input; tidak diurut ulang."""
    rows = small_baseline()
    out = build.dedup_baseline(rows)
    out2 = build.assign_ids(out)
    assert [r["id"] for r in out2] == ["H001", "H002", "H003"]


# ---------- pencocokan 2023 ------------------------------------------------


def test_match_rekap_uses_normalized_name_keys():
    """Nama "ACCOR/ FAIRMONT JAKARTA" harus cocok dengan baseline "FAIRMONT HOTEL JAKARTA"
    setelah normalisasi (drop network prefix + common words)."""
    baseline_rows = [
        {"id": "H001", "nama": "FAIRMONT HOTEL JAKARTA", "alamat": "JL SENAYAN 1",
         "golongan": "BINTANG 5", "jenis": "HOTEL BINTANG",
         "wilayah": "JAKARTA PUSAT", "kamar_2020": 488},
    ]
    rekap_rows = [
        {"r_nama": "ACCOR/ FAIRMONT JAKARTA", "r_golongan": "BINTANG 5",
         "r_kamar": 488, "r_alamat": "JL SENAYAN 1",
         "r_wilayah": "JAKARTA PUSAT", "r_periode": "2023-11-01"},
    ]
    matched, unmatched = build.match_rekap(baseline_rows, rekap_rows)
    assert "H001" in matched
    assert matched["H001"]["r_kamar"] == 488
    assert unmatched == []


def test_match_rekap_unmatched_2023_returned_for_new_rows():
    baseline_rows = [
        {"id": "H001", "nama": "ALPHA HOTEL", "alamat": "JL. A NO. 1",
         "golongan": "MELATI 1", "jenis": "MELATI",
         "wilayah": "JAKARTA BARAT", "kamar_2020": 50},
    ]
    rekap_rows = [
        {"r_nama": "BRAND NEW HOTEL 2023", "r_golongan": "BINTANG 4",
         "r_kamar": 80, "r_alamat": "JL. NEW NO. 1",
         "r_wilayah": "JAKARTA UTARA", "r_periode": "2023-11-01"},
    ]
    matched, unmatched = build.match_rekap(baseline_rows, rekap_rows)
    assert matched == {}
    assert len(unmatched) == 1
    assert unmatched[0]["r_nama"] == "BRAND NEW HOTEL 2023"


def test_match_rekap_does_not_fuzzy_match():
    """Aturan eksplisit: jangan fuzzy-match. Nama yang hanya mirip sebagian = tidak cocok."""
    baseline_rows = [
        {"id": "H001", "nama": "ALPHA HOTEL", "alamat": "JL. A",
         "golongan": "MELATI", "jenis": "MELATI",
         "wilayah": "BARAT", "kamar_2020": 10},
    ]
    rekap_rows = [
        {"r_nama": "ALPHA RESIDENCE", "r_golongan": "MELATI", "r_kamar": 30,
         "r_alamat": "JL. A", "r_wilayah": "BARAT", "r_periode": "2023-11-01"},
    ]
    matched, unmatched = build.match_rekap(baseline_rows, rekap_rows)
    assert matched == {}
    assert len(unmatched) == 1


# ---------- prioritas kamar_terkini ----------------------------------------


def test_resolve_row_ditemukan_overrides_2023_and_2020():
    row = {"id": "H001", "nama": "FAIRMONT", "kamar_2020": 488, "kamar_2023": 500}
    riset = {"status": "DITEMUKAN", "nama_terkini": "FAIRMONT (rebranded)",
             "kamar_terkini": 550, "tahun_sumber": "2024",
             "sumber": "https://x.com", "catatan": "ok"}
    rekap = {"r_kamar": 500, "r_periode": "2023-11-01"}
    out = build.resolve_row(row, rekap, riset)
    assert out["kamar_terkini"] == 550
    assert out["sumber_kamar_terkini"] == "riset_web"
    assert out["tahun_kamar_terkini"] == 2024
    assert out["url_sumber"] == "https://x.com"
    assert out["catatan"] == "ok"
    assert out["nama_terkini"] == "FAIRMONT (rebranded)"
    assert out["status_operasi"] == "BEROPERASI"
    assert out["status_riset"] == "DITEMUKAN"


def test_resolve_row_falls_back_to_2023_when_no_riset():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": 200}
    out = build.resolve_row(row, {"r_kamar": 200, "r_periode": "2023-11-01"}, None)
    assert out["kamar_terkini"] == 200
    assert out["sumber_kamar_terkini"] == "rekap_2023"
    assert out["tahun_kamar_terkini"] == 2023
    assert out["status_operasi"] == "BEROPERASI"
    assert out["status_riset"] == "BELUM"


def test_resolve_row_falls_back_to_2020_when_only_sdi():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": None}
    out = build.resolve_row(row, None, None)
    assert out["kamar_terkini"] == 100
    assert out["sumber_kamar_terkini"] == "sdi_2020"
    assert out["tahun_kamar_terkini"] == 2020
    assert out["status_operasi"] == "TIDAK_DIKETAHUI"
    assert out["status_riset"] == "BELUM"


# ---------- RAGU -----------------------------------------------------------


def test_resolve_row_ragu_does_not_override_kamar_terkini():
    """RAGU: angkanya masuk kamar_riset_ragu, bukan kamar_terkini."""
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": 200}
    riset = {"status": "RAGU", "nama_terkini": None,
             "kamar_terkini": 250, "tahun_sumber": "2024",
             "sumber": "https://x.com", "catatan": "sumber lemah"}
    rekap = {"r_kamar": 200, "r_periode": "2023-11-01"}
    out = build.resolve_row(row, rekap, riset)
    # kamar_terkini ambil dari rekap, BUKAN riset
    assert out["kamar_terkini"] == 200
    assert out["sumber_kamar_terkini"] == "rekap_2023"
    assert out["tahun_kamar_terkini"] == 2023
    # angka ragu masuk kolom khusus
    assert out["kamar_riset_ragu"] == 250
    assert out["status_riset"] == "RAGU"


def test_resolve_row_ragu_falls_back_to_2020_when_no_rekap():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": None}
    riset = {"status": "RAGU", "nama_terkini": None, "kamar_terkini": 250,
             "tahun_sumber": "2024", "sumber": "https://x.com", "catatan": None}
    out = build.resolve_row(row, None, riset)
    assert out["kamar_terkini"] == 100
    assert out["sumber_kamar_terkini"] == "sdi_2020"
    assert out["kamar_riset_ragu"] == 250


def test_resolve_row_tidak_ditemukan_treated_as_no_riset():
    """TIDAK_DITEMUKAN: seperti tidak ada riset; fallback ke rekap/sdi."""
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": 200}
    riset = {"status": "TIDAK_DITEMUKAN", "nama_terkini": None,
             "kamar_terkini": None, "tahun_sumber": None,
             "sumber": None, "catatan": "coba Google, tidak ketemu"}
    out = build.resolve_row(row, {"r_kamar": 200, "r_periode": "2023-11-01"}, riset)
    assert out["kamar_terkini"] == 200
    assert out["sumber_kamar_terkini"] == "rekap_2023"
    assert out["status_riset"] == "TIDAK_DITEMUKAN"
    assert out["status_operasi"] == "BEROPERASI"


# ---------- TUTUP ----------------------------------------------------------


def test_resolve_row_tutup_sets_status_and_null_kamar_terkini():
    """TUTUP: row tetap ada, status_operasi=TUTUP, kamar_terkini=null
    (meskipun ada angka di 2020/2023). Baris TUTUP dikecualikan dari summary."""
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": 200}
    riset = {"status": "TUTUP", "nama_terkini": None, "kamar_terkini": None,
             "tahun_sumber": "2023", "sumber": "https://x.com",
             "catatan": "tutup 2023"}
    rekap = {"r_kamar": 200, "r_periode": "2023-11-01"}
    out = build.resolve_row(row, rekap, riset)
    assert out["status_operasi"] == "TUTUP"
    assert out["kamar_terkini"] is None
    assert out["sumber_kamar_terkini"] is None
    assert out["tahun_kamar_terkini"] is None
    assert out["status_riset"] == "TUTUP"


# ---------- status_operasi rules -------------------------------------------


def test_status_operasi_beroperasi_when_in_rekap_2023():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": 200}
    out = build.resolve_row(row, {"r_kamar": 200, "r_periode": "2023-11-01"}, None)
    assert out["status_operasi"] == "BEROPERASI"


def test_status_operasi_beroperasi_when_riset_ditemukan():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": None}
    riset = {"status": "DITEMUKAN", "nama_terkini": None, "kamar_terkini": 150,
             "tahun_sumber": "2024", "sumber": None, "catatan": None}
    out = build.resolve_row(row, None, riset)
    assert out["status_operasi"] == "BEROPERASI"


def test_status_operasi_tidak_diketahui_when_neither():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": None}
    out = build.resolve_row(row, None, None)
    assert out["status_operasi"] == "TIDAK_DIKETAHUI"


# ---------- null vs empty string discipline --------------------------------


def test_resolve_row_missing_values_are_null_not_empty_string():
    row = {"id": "H001", "nama": "X", "kamar_2020": 100, "kamar_2023": None}
    out = build.resolve_row(row, None, None)
    # Kamar 2020 ada → fallback sdi_2020, jadi tahun/sumber terisi.
    # Yang harus null: kolom yang memang tidak ada sumbernya.
    for k in ["nama_terkini", "kamar_2023", "kamar_riset_ragu",
              "url_sumber", "catatan"]:
        assert out[k] is None, f"{k} seharusnya None, dapat {out[k]!r}"
        assert out[k] != ""
    # Bukan string kosong untuk yang terisi
    assert out["tahun_kamar_terkini"] == 2020
    assert out["sumber_kamar_terkini"] == "sdi_2020"


# ---------- apply_riset hard failures --------------------------------------


def test_apply_riset_unknown_id_fails():
    rows = [{"id": "H001", "nama": "X"}]
    riset = {"H999": {"status": "DITEMUKAN", "kamar_terkini": 100}}
    with pytest.raises(SystemExit) as exc_info:
        build.apply_riset(rows, riset)
    msg = str(exc_info.value).lower()
    assert "h999" in msg or "tidak dikenal" in msg or "unknown" in msg


def test_apply_riset_invalid_status_fails():
    rows = [{"id": "H001", "nama": "X"}]
    riset = {"H001": {"status": "FOO", "kamar_terkini": 100}}
    with pytest.raises(SystemExit) as exc_info:
        build.apply_riset(rows, riset)
    msg = str(exc_info.value).lower()
    assert "foo" in msg or "status" in msg


# ---------- build_dataset end-to-end ---------------------------------------


def test_build_dataset_with_empty_riset_folder(tmp_path):
    """End-to-end kecil: 2 baseline, 1 rekap match, 1 rekap baru, riset kosong."""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    write_jsonl(baseline_path, small_baseline())
    write_jsonl(rekap_path, [
        {"r_nama": "FAIRMONT HOTEL JAKARTA", "r_golongan": "BINTANG 5",
         "r_kamar": 488, "r_alamat": "JL SENAYAN 1",
         "r_wilayah": "JAKARTA PUSAT", "r_periode": "2023-11-01"},
        {"r_nama": "BETA HOTEL", "r_golongan": "MELATI 2",
         "r_kamar": 120, "r_alamat": "JL. B NO. 2",
         "r_wilayah": "JAKARTA PUSAT", "r_periode": "2023-09-01"},
        {"r_nama": "BRAND NEW HOTEL 2023", "r_golongan": "BINTANG 4",
         "r_kamar": 80, "r_alamat": "JL. NEW NO. 1",
         "r_wilayah": "JAKARTA UTARA", "r_periode": "2023-11-01"},
    ])
    riset_dir = tmp_path / "riset"
    riset_dir.mkdir()  # folder kosong

    ds = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    rows = ds["rows"]
    assert len(rows) == 4  # 3 baseline + 1 unmatched 2023

    by_id = {r["id"]: r for r in rows}
    assert "H001" in by_id and "H002" in by_id and "H003" in by_id and "N001" in by_id

    # H001 ALPHA: tidak ada rekap, fallback ke sdi_2020
    assert by_id["H001"]["kamar_terkini"] == 50
    assert by_id["H001"]["sumber_kamar_terkini"] == "sdi_2020"
    assert by_id["H001"]["status_operasi"] == "TIDAK_DIKETAHUI"
    assert by_id["H001"]["status_riset"] == "BELUM"

    # H002 FAIRMONT: rekap cocok, sumber rekap_2023
    assert by_id["H002"]["kamar_terkini"] == 488
    assert by_id["H002"]["sumber_kamar_terkini"] == "rekap_2023"
    assert by_id["H002"]["tahun_kamar_terkini"] == 2023
    assert by_id["H002"]["status_operasi"] == "BEROPERASI"

    # H003 BETA: rekap cocok
    assert by_id["H003"]["kamar_terkini"] == 120
    assert by_id["H003"]["sumber_kamar_terkini"] == "rekap_2023"

    # N001 BARU: baris baru dari rekap
    assert by_id["N001"]["kamar_2020"] is None
    assert by_id["N001"]["kamar_2023"] == 80
    assert by_id["N001"]["kamar_terkini"] == 80
    assert by_id["N001"]["sumber_kamar_terkini"] == "rekap_2023"
    assert by_id["N001"]["status_operasi"] == "BEROPERASI"


def test_build_dataset_missing_riset_folder_is_ok(tmp_path):
    """Folder riset boleh tidak ada — diperlakukan sebagai 'tidak ada riset'."""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    write_jsonl(baseline_path, small_baseline())
    write_jsonl(rekap_path, [])
    riset_dir = tmp_path / "riset_tidak_ada"  # sengaja tidak dibuat

    ds = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    assert len(ds["rows"]) == 3
    for r in ds["rows"]:
        assert r["status_riset"] == "BELUM"


def test_build_dataset_research_changes_kamar_terkini(tmp_path):
    """Riset DITEMUKAN menimpa angka rekap."""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    riset_dir = tmp_path / "riset"
    riset_dir.mkdir()
    # Hanya 1 baseline (FAIRMONT) → setelah assign_ids jadi H001
    write_jsonl(baseline_path, [small_baseline()[1]])
    write_jsonl(rekap_path, [
        {"r_nama": "FAIRMONT HOTEL JAKARTA", "r_golongan": "BINTANG 5",
         "r_kamar": 488, "r_alamat": "JL SENAYAN 1",
         "r_wilayah": "JAKARTA PUSAT", "r_periode": "2023-11-01"},
    ])
    # Riset: angka 550 dari 2024 (1 JSON object per file)
    write_json(riset_dir / "batch_00.json", {
        "H001": {"status": "DITEMUKAN", "nama_terkini": "FAIRMONT REBRANDED",
                 "kamar_terkini": 550, "tahun_sumber": "2024",
                 "sumber": "https://situs resmi", "catatan": "updated 2024"},
    })

    ds = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    r = ds["rows"][0]
    assert r["id"] == "H001"
    assert r["kamar_terkini"] == 550
    assert r["sumber_kamar_terkini"] == "riset_web"
    assert r["tahun_kamar_terkini"] == 2024
    assert r["status_operasi"] == "BEROPERASI"
    assert r["status_riset"] == "DITEMUKAN"
    assert r["nama_terkini"] == "FAIRMONT REBRANDED"
    assert r["url_sumber"] == "https://situs resmi"


def test_build_dataset_tutup_row_kept_and_excluded_from_summary(tmp_path):
    """Baris TUTUP tetap ada di rows, tapi tidak dihitung di summary.total_kamar_aktif."""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    riset_dir = tmp_path / "riset"
    riset_dir.mkdir()
    write_jsonl(baseline_path, [
        {"h_nama": "ALIVE HOTEL", "h_jenis": "MELATI", "h_golongan": "MELATI 1",
         "h_kamar": 80, "h_alamat": "JL. A", "h_wilayah": "JAKARTA BARAT"},
        {"h_nama": "DEAD HOTEL", "h_jenis": "MELATI", "h_golongan": "MELATI 1",
         "h_kamar": 40, "h_alamat": "JL. D", "h_wilayah": "JAKARTA BARAT"},
    ])
    write_jsonl(rekap_path, [])
    write_json(riset_dir / "batch_00.json", {
        "H002": {"status": "TUTUP", "nama_terkini": None, "kamar_terkini": None,
                 "tahun_sumber": "2023", "sumber": "https://x",
                 "catatan": "tutup COVID"},
    })

    ds = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    assert len(ds["rows"]) == 2
    by_id = {r["id"]: r for r in ds["rows"]}
    assert by_id["H001"]["status_operasi"] == "TIDAK_DIKETAHUI"
    assert by_id["H002"]["status_operasi"] == "TUTUP"
    # Summary mengecualikan TUTUP
    summary = ds["meta"]
    assert summary["total_kamar_aktif"] == 80  # hanya H001
    assert summary["jumlah_baris"] == 2


# ---------- idempotence ----------------------------------------------------


def test_build_dataset_is_byte_identical_on_two_runs(tmp_path):
    """Menjalankan build_dataset dua kali dengan input sama → serialized
    output byte-identical. (Aturan 9.)"""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    riset_dir = tmp_path / "riset"
    riset_dir.mkdir()
    write_jsonl(baseline_path, small_baseline())
    write_jsonl(rekap_path, [
        {"r_nama": "FAIRMONT HOTEL JAKARTA", "r_golongan": "BINTANG 5",
         "r_kamar": 488, "r_alamat": "JL SENAYAN 1",
         "r_wilayah": "JAKARTA PUSAT", "r_periode": "2023-11-01"},
    ])
    write_json(riset_dir / "batch_00.json", {
        "H002": {"status": "DITEMUKAN", "nama_terkini": "FAIRMONT",
                 "kamar_terkini": 550, "tahun_sumber": "2024",
                 "sumber": "https://x", "catatan": "ok"},
    })

    ds1 = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    ds2 = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    s1 = build.serialize(ds1)
    s2 = build.serialize(ds2)
    assert s1 == s2
    assert len(s1) > 100  # sanity: bukan dict repr kosong


def test_serialize_writes_with_trailing_newline(tmp_path):
    """Konvensi repo: file JSON diakhiri \n tunggal (lihat hotel-transit-jakarta)."""
    baseline_path = tmp_path / "baseline.jsonl"
    rekap_path = tmp_path / "rekap.jsonl"
    riset_dir = tmp_path / "riset"
    riset_dir.mkdir()
    write_jsonl(baseline_path, small_baseline()[:1])
    write_jsonl(rekap_path, [])

    ds = build.build_dataset(str(baseline_path), str(rekap_path), riset_dir)
    out_path = tmp_path / "out.json"
    build.write_dataset(out_path, ds)
    raw = out_path.read_bytes()
    assert raw.endswith(b"\n")
    assert not raw.endswith(b"\n\n")


# ---------- columns schema --------------------------------------------------


def test_columns_have_four_fields_with_description():
    ds = {
        "slug": "x", "title": "X", "description": "X",
        "columns": build.COLUMNS,
        "rows": [],
        "meta": {},
    }
    for col in ds["columns"]:
        assert set(col.keys()) == {"key", "label", "type", "description"}
        assert col["description"] is not None
        assert isinstance(col["description"], str)
        assert col["description"] != ""


def test_columns_order_matches_plan():
    expected = ["id", "nama", "nama_terkini", "golongan", "jenis", "wilayah",
                "alamat", "kamar_2020", "kamar_2023", "kamar_terkini",
                "tahun_kamar_terkini", "sumber_kamar_terkini", "status_operasi",
                "status_riset", "kamar_riset_ragu", "url_sumber", "catatan"]
    assert [c["key"] for c in build.COLUMNS] == expected


def test_columns_types_match_plan():
    number_keys = {"kamar_2020", "kamar_2023", "kamar_terkini",
                   "kamar_riset_ragu", "tahun_kamar_terkini"}
    for col in build.COLUMNS:
        if col["key"] in number_keys:
            assert col["type"] == "number", col["key"]
        else:
            assert col["type"] == "string", col["key"]