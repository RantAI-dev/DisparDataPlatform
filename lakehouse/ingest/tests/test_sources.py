"""Uji pemuat dan validator registri sumber data mentah (lakehouse/sources.toml).

Semua uji lewat API publik `load(root)`. Penolakan diuji dengan membuat
registri TOML sementara di `tmp_path`; registri sungguhan diuji dari repo.
Tidak butuh jaringan atau ClickHouse.

    cd lakehouse/ingest && uv run --extra dev pytest -q
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest

from dispar_ingest.files import discover
from dispar_ingest.lake import safe_name
from dispar_ingest.secondary_ingest import _load
from dispar_ingest.sources import Registry, RegistryError, load, semua_path

# tests/test_sources.py -> tests -> ingest -> lakehouse -> root repo
REPO = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="module")
def registri() -> Registry:
    return load(root=REPO)


# ── Pembuat registri sementara ──────────────────────────────────────────────


def _tulis_repo(
    tmp_path: Path, toml: str, berkas: tuple[str, ...] = ("data/a.tsv",)
) -> Path:
    """Buat root palsu: lakehouse/sources.toml + berkas kosong yang disebut."""
    (tmp_path / "lakehouse").mkdir(parents=True, exist_ok=True)
    (tmp_path / "lakehouse" / "sources.toml").write_text(toml, encoding="utf-8")
    for rel in berkas:
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("nama\tjumlah\nA\t1\n", encoding="utf-8")
    return tmp_path


def _nilai_toml(v) -> str:
    if isinstance(v, list):
        return "[" + ", ".join(f'"{x}"' for x in v) + "]"
    return f'"{v}"'


def _sumber(**kw) -> str:
    """Blok [[sumber]] berkas yang valid. Nilai None = kunci dihapus; list = array TOML."""
    base = {
        "id": "uji-berkas",
        "jenis": "berkas",
        "path": "data/a.tsv",
        "namespace": "bronze_file",
        "tabel": "uji_berkas",
        "kelas_refresh": "snapshot",
        "tanggal_ambil": "2026-08-13",
        "asal": "uji",
        "pembangun": "",
    }
    base.update(kw)
    baris = [f"{k} = {_nilai_toml(v)}" for k, v in base.items() if v is not None]
    return "[[sumber]]\n" + "\n".join(baris) + "\n"


def _muat(tmp_path: Path, toml: str, berkas=("data/a.tsv",)) -> Registry:
    return load(root=_tulis_repo(tmp_path, toml, berkas))


# ── Registri sungguhan ──────────────────────────────────────────────────────


def test_registri_repo_termuat(registri: Registry):
    # Plan 03: 1 SDI + 34 berkas + 28 sekunder = 63 entri. Tabel bronze_file ke-35
    # (wellness_jakarta) datang dari tabel_lain, bukan entri sendiri.
    assert len(registri.sumber) == 63


def test_jumlah_sesuai_bronze_hidup(registri: Registry):
    """Kriteria Plan 03: 1 SDI + 35 bronze_file + 28 bronze_sec.
    - bronze_sdi: 1 entri registri (181 tabel live)
    - bronze_file: 34 entri registri berkas + 1 dari tabel_lain (wellness_jakarta) = 35
      (18 tabel live dari Plan 01 + 17 berkas raw baru dari Plan 03)
    - bronze_sec: 28 entri registri sekunder (28 tabel live)
    """
    by_ns: dict[str, int] = {}
    for s in registri.sumber:
        by_ns[s.namespace] = by_ns.get(s.namespace, 0) + 1
        for ns, _ in s.tabel_lain:
            by_ns[ns] = by_ns.get(ns, 0) + 1
    assert by_ns["bronze_sdi"] == 1, "bentuk registri (bukan lake): jumlah SDI"
    assert by_ns["bronze_file"] == 35, "bentuk registri: jumlah bronze_file"
    assert by_ns["bronze_sec"] == 28, "bentuk registri (bukan lake): jumlah bronze_sec"


def test_tidak_ada_abaikan_belum_dinilai(registri: Registry):
    """Kriteria 1 Plan 03: tidak ada lagi entri [[abaikan]] beralasan 'belum dinilai, lihat plan 03'."""
    belum = [a for a in registri.abaikan if "belum dinilai" in a.alasan.lower()]
    assert belum == [], f"Masih ada {len(belum)} entri abaikan belum dinilai: {[a.path for a in belum]}"


@pytest.mark.parametrize(
    "sumber_id",
    [s.id for s in load(REPO).sumber if s.jenis == "berkas"],
)
def test_sumber_berkas_terbaca_dan_tidak_kosong(sumber_id: str, registri: Registry):
    """Kriteria 3 Plan 03: setiap sumber jenis berkas terbaca oleh files.read_file dan menghasilkan >= 1 baris."""
    from dispar_ingest.files import read_file

    by_id = {s.id: s for s in registri.sumber}
    sumber = by_id[sumber_id]
    path = REPO / sumber.path
    assert path.is_file(), f"{sumber.id}: berkas tidak ada di {path}"
    rows = list(read_file(str(path)))
    assert len(rows) >= 1, f"{sumber.id}: berkas kosong (0 baris)"


def test_tidak_ada_berkas_tak_bertuan(registri: Registry):
    """Kriteria 2: setiap berkas yang discover() kenali, setiap data/sekunder/*.json,
    dan setiap *.tsv di root muncul TEPAT SATU kali di [[sumber]] atau [[abaikan]]."""
    semua = [os.path.relpath(p, REPO) for p in discover(str(REPO / "data"))]
    semua += [
        os.path.relpath(p, REPO) for p in (REPO / "data" / "sekunder").glob("*.json")
    ]
    semua += [p.name for p in REPO.glob("*.tsv")]
    semua = sorted(set(semua))

    tercakup = semua_path(registri)

    tak_bertuan = [p for p in semua if p not in tercakup]
    ganda = sorted({p for p in tercakup if tercakup.count(p) > 1})
    assert tak_bertuan == [], (
        f"{len(tak_bertuan)} berkas tak bertuan (tambah ke [[sumber]] atau [[abaikan]]):\n  "
        + "\n  ".join(tak_bertuan)
    )
    assert ganda == [], f"path muncul lebih dari sekali: {ganda}"


def test_tabel_sekunder_sama_safe_name_slug(registri: Registry):
    """`tabel` sekunder harus sama dengan safe_name(slug) dari loader ingest, supaya
    registri tidak bisa melenceng diam-diam dari secondary_ingest."""
    cek = [s for s in registri.sumber if s.jenis == "sekunder"]
    salah = []
    for s in cek:
        slug = _load(str(REPO / s.path))["slug"]
        if safe_name(slug) != s.tabel:
            salah.append(
                f"{s.id}: tabel={s.tabel!r} tapi safe_name(slug)={safe_name(slug)!r}"
            )
    assert salah == [], "\n".join(salah)


def test_wellness_dan_water_mengakui_tabel_bronze_file_yang_korup(registri: Registry):
    """Kedua berkas ini juga menulis bronze_file.* (lewat files.read_json yang memilih
    `columns`). tabel_lain mencatat itu supaya inventaris Bronze lengkap."""
    by_id = {s.id: s for s in registri.sumber}
    assert ("bronze_file", "wellness_jakarta") in by_id["wellness-jakarta"].tabel_lain
    assert (
        by_id["water-attractions-jakarta-berkas"].tabel == "water_attractions_jakarta"
    )
    assert (
        by_id["water-attractions-jakarta-sekunder"].tabel == "water_attractions_jakarta"
    )


def test_pembangun_hanya_yang_skripnya_ada(registri: Registry):
    for s in registri.sumber:
        if s.pembangun:
            assert (REPO / s.pembangun).is_file(), (
                f"{s.id}: pembangun {s.pembangun} tidak ada"
            )


def test_abaikan_path_masih_ada_di_disk(registri: Registry):
    """Setiap [[abaikan]] harus menunjuk berkas yang SUDAH ada di disk.

    Aturan ini hanya diuji, bukan dijadikan aturan loader. Alasannya: image
    container sengaja hanya mengirim [[sumber]] (lihat Dockerfile); kalau loader
    wajibkan setiap [[abaikan]] path ada, `load()` akan pecah di produksi saat
    ada [[abaikan]] lokal yang tak ikut terkirim. Uji ini cukup sebagai alarm
    bagi operator yang menambah entri di repo lokal: bila berkas dihapus atau
    di-rename, entri [[abaikan]] ikut stale dan harus diperbarui.
    """
    stale = [
        a.path for a in registri.abaikan if not (REPO / a.path).is_file()
    ]
    assert stale == [], (
        f"{len(stale)} [[abaikan]] menunjuk berkas yang tak ada di disk "
        f"(hapus entri atau perbarui path-nya):\n  "
        + "\n  ".join(stale)
    )


def test_saat_berubah_wajib_punya_pembangun(registri: Registry):
    """Invarian: entri saat_berubah harus punya pembangun (skrip yang menulis
    berkasnya). Keberadaan skrip itu diperiksa test_pembangun_hanya_yang_skripnya_ada."""
    tanpa = [s.id for s in registri.sumber if s.kelas_refresh == "saat_berubah" and not s.pembangun]
    assert tanpa == [], f"saat_berubah tanpa pembangun: {tanpa}"


# ── Penolakan: id ───────────────────────────────────────────────────────────


def test_id_ganda_ditolak(tmp_path):
    toml = _sumber(id="kembar", path="data/a.tsv", tabel="a_satu") + _sumber(
        id="kembar", path="data/b.tsv", tabel="b_dua"
    )
    with pytest.raises(RegistryError, match="ganda"):
        _muat(tmp_path, toml, berkas=("data/a.tsv", "data/b.tsv"))


def test_id_bukan_kebab_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="kebab-case"):
        _muat(tmp_path, _sumber(id="Huruf_Besar"))


def test_id_kosong_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="kosong|kebab-case"):
        _muat(tmp_path, _sumber(id=""))


# ── Penolakan: (namespace, tabel) ganda ─────────────────────────────────────


def test_pasangan_namespace_tabel_ganda_ditolak(tmp_path):
    toml = _sumber(id="satu", path="data/a.tsv", tabel="sama") + _sumber(
        id="dua", path="data/b.tsv", tabel="sama"
    )
    with pytest.raises(RegistryError, match="sudah dipakai"):
        _muat(tmp_path, toml, berkas=("data/a.tsv", "data/b.tsv"))


def test_tabel_lain_bentrok_dengan_tabel_lain_ditolak(tmp_path):
    toml = _sumber(id="satu", path="data/a.tsv", tabel="a_satu") + _sumber(
        id="dua",
        path="data/b.tsv",
        tabel="b_dua",
        tabel_lain=["bronze_file.a_satu"],
    )
    with pytest.raises(RegistryError, match="sudah dipakai"):
        _muat(tmp_path, toml, berkas=("data/a.tsv", "data/b.tsv"))


def test_tabel_lain_format_salah_ditolak(tmp_path):
    toml = _sumber(tabel_lain=["tanpa_titik"])
    with pytest.raises(RegistryError, match="namespace.tabel"):
        _muat(tmp_path, toml)


# ── Penolakan: kelas_refresh, jenis, namespace ──────────────────────────────


@pytest.mark.parametrize("kelas", ["harian", "manual", "Snapshot", "snapshottypo"])
def test_kelas_refresh_di_luar_tiga_nilai_ditolak(tmp_path, kelas):
    with pytest.raises(RegistryError, match="kelas_refresh"):
        _muat(tmp_path, _sumber(kelas_refresh=kelas))


@pytest.mark.parametrize("jenis", ["api", "SDI", "csv"])
def test_jenis_di_luar_daftar_ditolak(tmp_path, jenis):
    with pytest.raises(RegistryError, match="`jenis`"):
        _muat(tmp_path, _sumber(jenis=jenis))


def test_namespace_tidak_sesuai_jenis_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="harus namespace"):
        _muat(tmp_path, _sumber(namespace="bronze_sec"))


# ── Penolakan: snapshot tanpa tanggal_ambil ─────────────────────────────────


def test_snapshot_tanpa_tanggal_ambil_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="tanggal_ambil"):
        _muat(tmp_path, _sumber(kelas_refresh="snapshot", tanggal_ambil=None))


def test_saat_berubah_tanpa_tanggal_ambil_diterima(tmp_path):
    reg = _muat(
        tmp_path,
        _sumber(
            kelas_refresh="saat_berubah",
            tanggal_ambil=None,
            pembangun="scripts/bangun.py",
        ),
        berkas=("data/a.tsv", "scripts/bangun.py"),
    )
    assert reg.sumber[0].tanggal_ambil is None


def test_saat_berubah_tanpa_pembangun_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="pembangun"):
        _muat(tmp_path, _sumber(kelas_refresh="saat_berubah", tanggal_ambil=None,
                                pembangun=""))


# ── Penolakan: path tidak ada di disk ───────────────────────────────────────


def test_path_tidak_ada_di_disk_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="tidak ada di disk"):
        _muat(tmp_path, _sumber(path="data/tidak-ada.tsv"), berkas=("data/a.tsv",))


def test_path_wajib_untuk_berkas(tmp_path):
    with pytest.raises(RegistryError, match="`path` wajib"):
        _muat(tmp_path, _sumber(path=None))


def test_tabel_wajib_untuk_berkas(tmp_path):
    with pytest.raises(RegistryError, match="`tabel` wajib"):
        _muat(tmp_path, _sumber(tabel=None))


def test_tabel_bukan_identifier_aman_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="a-z"):
        _muat(tmp_path, _sumber(tabel="Atas-Besar"))


# ── Penolakan: tanggal_ambil rusak ──────────────────────────────────────────


@pytest.mark.parametrize("rusak", ["2026-13-01", "abc", "2026/08/13", "2026-8-13"])
def test_tanggal_ambil_rusak_ditolak(tmp_path, rusak):
    with pytest.raises(RegistryError, match="tanggal_ambil"):
        _muat(tmp_path, _sumber(tanggal_ambil=rusak))


def test_tanggal_ambil_iso_diurai_jadi_date(tmp_path):
    reg = _muat(tmp_path, _sumber(tanggal_ambil="2026-08-13"))
    assert reg.sumber[0].tanggal_ambil == date(2026, 8, 13)


def test_tanggal_ambil_datetime_ditolak(tmp_path):
    """`tanggal_ambil` harus tanggal saja; datetime (hasil TOML dengan `T...`)
    tidak boleh lolos karena datetime adalah subclass dari date.
    """
    toml = (
        '[[sumber]]\nid = "uji-berkas"\njenis = "berkas"\n'
        'kelas_refresh = "snapshot"\nnamespace = "bronze_file"\n'
        'tabel = "uji_berkas"\ntanggal_ambil = 2026-08-13T10:00:00\n'
        'asal = "uji"\npath = "data/a.tsv"\n'
    )
    with pytest.raises(RegistryError, match="tanggal_ambil"):
        _muat(tmp_path, toml)


# ── Penolakan: field wajib dan asing ────────────────────────────────────────


@pytest.mark.parametrize("kunci", ["asal", "kelas_refresh", "namespace"])
def test_field_wajib_hilang_ditolak(tmp_path, kunci):
    with pytest.raises(RegistryError, match=f"`{kunci}` wajib ada"):
        _muat(tmp_path, _sumber(**{kunci: None}))


def test_asal_kosong_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="asal"):
        _muat(tmp_path, _sumber(asal=""))


def test_field_tidak_dikenal_ditolak(tmp_path):
    toml = _sumber() + 'kunci_salah = "x"\n'
    with pytest.raises(RegistryError, match="tidak dikenal"):
        _muat(tmp_path, toml)


def test_sdi_tidak_boleh_punya_path(tmp_path):
    toml = (
        '[[sumber]]\nid = "sdi"\njenis = "sdi"\nkelas_refresh = "terjadwal"\n'
        'namespace = "bronze_sdi"\nasal = "uji"\npath = "data/a.tsv"\n'
    )
    with pytest.raises(RegistryError, match="tidak berlaku"):
        _muat(tmp_path, toml)


# ── Penolakan: [[abaikan]] ──────────────────────────────────────────────────


def test_abaikan_alasan_kosong_ditolak(tmp_path):
    toml = '[[abaikan]]\npath = "data/a.tsv"\nalasan = ""\n'
    with pytest.raises(RegistryError, match="alasan"):
        _muat(tmp_path, toml)


def test_abaikan_path_ganda_ditolak(tmp_path):
    toml = (
        '[[abaikan]]\npath = "data/a.tsv"\nalasan = "satu"\n'
        '[[abaikan]]\npath = "data/a.tsv"\nalasan = "dua"\n'
    )
    with pytest.raises(RegistryError, match="dua kali"):
        _muat(tmp_path, toml)


def test_path_di_sumber_dan_abaikan_ditolak(tmp_path):
    toml = _sumber(path="data/a.tsv", tabel="a_tabel") + (
        '[[abaikan]]\npath = "data/a.tsv"\nalasan = "dobel"\n'
    )
    with pytest.raises(RegistryError, match="DAN \\[\\[abaikan\\]\\]"):
        _muat(tmp_path, toml)


def test_sumber_bukan_tabel_ditolak(tmp_path):
    """`sumber = [..]` (skalar/list di key `sumber`, bukan array-of-tables)
    harus ditolak sebagai RegistryError, bukan TypeError.
    """
    toml = "sumber = [1]\n"
    with pytest.raises(RegistryError, match="\\[\\[sumber\\]\\]"):
        _muat(tmp_path, toml)


def test_abaikan_bukan_tabel_ditolak(tmp_path):
    """`abaikan = [..]` juga harus jadi RegistryError, bukan TypeError."""
    toml = "abaikan = [1]\n"
    with pytest.raises(RegistryError, match="\\[\\[abaikan\\]\\]"):
        _muat(tmp_path, toml)


# ── Pencarian root ──────────────────────────────────────────────────────────


def test_env_data_root_dipakai_bila_root_tidak_diberikan(tmp_path, monkeypatch):
    _tulis_repo(tmp_path, _sumber(), berkas=("data/a.tsv",))
    monkeypatch.setenv("DATA_ROOT", str(tmp_path))
    assert load().sumber[0].id == "uji-berkas"


def test_tanpa_toml_ditolak(tmp_path):
    with pytest.raises(RegistryError, match="tidak ditemukan"):
        load(root=tmp_path)
