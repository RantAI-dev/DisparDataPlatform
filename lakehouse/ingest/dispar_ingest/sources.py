"""Registri sumber data mentah: pemuat dan validator.

Registri ada di `lakehouse/sources.toml` dan dibaca dengan `tomllib` (stdlib, tanpa
dependensi baru). Modul ini belum dipakai kode ingest; plan 02 yang menyambungkannya.

Root repo:
  `load(root)` memakai `root` yang diberikan. Kalau None, pakai env `DATA_ROOT`.
  Kalau env juga kosong, cari ke atas dari lokasi modul ini sampai ketemu
  `lakehouse/sources.toml`. Di image container, set `DATA_ROOT=/app`.
"""

from __future__ import annotations

import os
import re
import tomllib
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

JENIS_VALID = frozenset({"sdi", "berkas", "sekunder"})
KELAS_REFRESH_VALID = frozenset({"terjadwal", "saat_berubah", "snapshot"})
NAMESPACE_VALID = frozenset({"bronze_sdi", "bronze_file", "bronze_sec"})

_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_TABEL_RE = re.compile(r"^[a-z][a-z0-9_]*$")
_TANGGAL_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_KUNCI_SUMBER = frozenset(
    {
        "id",
        "jenis",
        "kelas_refresh",
        "namespace",
        "asal",
        "path",
        "tabel",
        "tanggal_ambil",
        "pembangun",
        "tabel_lain",
    }
)
_KUNCI_ABAIKAN = frozenset({"path", "alasan"})


@dataclass(frozen=True)
class Sumber:
    """Satu entri `[[sumber]]` yang sudah lolos validasi."""

    id: str
    jenis: str
    kelas_refresh: str
    namespace: str
    asal: str
    path: str | None = None
    tabel: str | None = None
    tanggal_ambil: date | None = None
    pembangun: str = ""
    tabel_lain: tuple[tuple[str, str], ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Abaikan:
    """Satu entri `[[abaikan]]`: berkas yang sengaja tidak diambil, beserta alasannya."""

    path: str
    alasan: str


@dataclass(frozen=True)
class Registry:
    sumber: tuple[Sumber, ...]
    abaikan: tuple[Abaikan, ...]

    def __len__(self) -> int:
        return len(self.sumber)


class RegistryError(ValueError):
    """Registri rusak. Pesan menyebut nomor entri dan field yang salah."""


# ── API publik ───────────────────────────────────────────────────────────────


def load(root: str | Path | None = None) -> Registry:
    """Muat dan validasi `lakehouse/sources.toml` di bawah `root`."""
    base = _akar(root)
    toml_path = base / "lakehouse" / "sources.toml"
    if not toml_path.is_file():
        raise RegistryError(f"Registri tidak ditemukan: {toml_path}")
    try:
        with toml_path.open("rb") as f:
            data = tomllib.load(f)
    except tomllib.TOMLDecodeError as exc:
        raise RegistryError(f"TOML tidak valid di {toml_path}: {exc}") from exc

    daftar_sumber = data.get("sumber", [])
    daftar_abaikan = data.get("abaikan", [])
    if not isinstance(daftar_sumber, list) or not isinstance(daftar_abaikan, list):
        raise RegistryError("`sumber` dan `abaikan` harus berupa daftar [[...]]")

    sumber = tuple(_parse_sumber(d, i) for i, d in enumerate(daftar_sumber, 1))
    abaikan = tuple(_parse_abaikan(d, i) for i, d in enumerate(daftar_abaikan, 1))
    _periksa_sumber(sumber, base)
    _periksa_abaikan(abaikan)
    _periksa_tak_bertuan(sumber, abaikan, base)
    return Registry(sumber=sumber, abaikan=abaikan)


# ── Akar repo ────────────────────────────────────────────────────────────────


def _akar(root: str | Path | None) -> Path:
    if root is not None:
        return Path(root).resolve()
    env = os.environ.get("DATA_ROOT")
    if env:
        return Path(env).resolve()
    modul = Path(__file__).resolve()
    for parent in (modul.parent, *modul.parents):
        if (parent / "lakehouse" / "sources.toml").is_file():
            return parent
    raise RegistryError(
        "Root repo tidak ditemukan: tidak ada `lakehouse/sources.toml` di atas "
        "modul ini. Set env DATA_ROOT atau berikan `root`."
    )


# ── Parsing satu entri ───────────────────────────────────────────────────────


def _wajib(d: dict[str, Any], kunci: str, prefix: str) -> str:
    if kunci not in d:
        raise RegistryError(f"{prefix}: field `{kunci}` wajib ada")
    nilai = d[kunci]
    if not isinstance(nilai, str):
        raise RegistryError(f"{prefix}: field `{kunci}` harus string, dapat {nilai!r}")
    return nilai.strip()


def _opsional_str(d: dict[str, Any], kunci: str, prefix: str) -> str | None:
    if kunci not in d:
        return None
    nilai = d[kunci]
    if not isinstance(nilai, str):
        raise RegistryError(f"{prefix}: field `{kunci}` harus string, dapat {nilai!r}")
    return nilai.strip()


def _parse_tanggal(nilai: Any, prefix: str) -> date:
    if type(nilai) is date:  # TOML tanpa kutip menghasilkan objek date; datetime ditolak
        return nilai
    if isinstance(nilai, datetime):
        raise RegistryError(
            f"{prefix}: `tanggal_ambil` harus YYYY-MM-DD (tanggal saja), dapat {nilai!r}"
        )
    if not isinstance(nilai, str) or not _TANGGAL_RE.match(nilai.strip()):
        raise RegistryError(
            f"{prefix}: `tanggal_ambil` harus YYYY-MM-DD, dapat {nilai!r}"
        )
    try:
        return date.fromisoformat(nilai.strip())
    except ValueError as exc:
        raise RegistryError(
            f"{prefix}: `tanggal_ambil` bukan tanggal yang sah, dapat {nilai!r}: {exc}"
        ) from exc


def _parse_tabel_lain(raw: Any, prefix: str) -> tuple[tuple[str, str], ...]:
    if not isinstance(raw, list):
        raise RegistryError(f"{prefix}: `tabel_lain` harus daftar string")
    hasil: list[tuple[str, str]] = []
    for entri in raw:
        if not isinstance(entri, str) or entri.count(".") != 1:
            raise RegistryError(
                f"{prefix}: `tabel_lain` harus berbentuk 'namespace.tabel', dapat {entri!r}"
            )
        ns, tb = entri.split(".")
        hasil.append((ns, tb))
    return tuple(hasil)


def _tolak_kunci_asing(d: dict[str, Any], dikenal: frozenset[str], prefix: str) -> None:
    asing = sorted(set(d) - dikenal)
    if asing:
        raise RegistryError(
            f"{prefix}: field tidak dikenal {asing}; yang valid {sorted(dikenal)}"
        )


def _parse_sumber(d: dict[str, Any], nomor: int) -> Sumber:
    if not isinstance(d, dict):
        raise RegistryError(
            f"[[sumber]] ke-{nomor}: harus tabel (bukan {type(d).__name__}); "
            f"pakai bentuk `[[sumber]]\\n...`, bukan `sumber = [..]`"
        )
    prefix = f"[[sumber]] ke-{nomor}"
    _tolak_kunci_asing(d, _KUNCI_SUMBER, prefix)

    id_ = _wajib(d, "id", prefix)
    prefix = f"[[sumber]] ke-{nomor} (id={id_!r})"
    jenis = _wajib(d, "jenis", prefix)
    kelas = _wajib(d, "kelas_refresh", prefix)
    namespace = _wajib(d, "namespace", prefix)
    asal = _wajib(d, "asal", prefix)

    if jenis not in JENIS_VALID:
        raise RegistryError(
            f"{prefix}: `jenis` {jenis!r} di luar {sorted(JENIS_VALID)}"
        )
    if kelas not in KELAS_REFRESH_VALID:
        raise RegistryError(
            f"{prefix}: `kelas_refresh` {kelas!r} di luar {sorted(KELAS_REFRESH_VALID)}"
        )
    if namespace not in NAMESPACE_VALID:
        raise RegistryError(
            f"{prefix}: `namespace` {namespace!r} di luar {sorted(NAMESPACE_VALID)}"
        )

    path = _opsional_str(d, "path", prefix) or None
    tabel = _opsional_str(d, "tabel", prefix) or None
    pembangun = _opsional_str(d, "pembangun", prefix) or ""
    tanggal = (
        _parse_tanggal(d["tanggal_ambil"], prefix) if "tanggal_ambil" in d else None
    )
    tabel_lain = _parse_tabel_lain(d.get("tabel_lain", []), prefix)

    return Sumber(
        id=id_,
        jenis=jenis,
        kelas_refresh=kelas,
        namespace=namespace,
        asal=asal,
        path=path,
        tabel=tabel,
        tanggal_ambil=tanggal,
        pembangun=pembangun,
        tabel_lain=tabel_lain,
    )


def _parse_abaikan(d: dict[str, Any], nomor: int) -> Abaikan:
    if not isinstance(d, dict):
        raise RegistryError(
            f"[[abaikan]] ke-{nomor}: harus tabel (bukan {type(d).__name__}); "
            f"pakai bentuk `[[abaikan]]\\n...`, bukan `abaikan = [..]`"
        )
    prefix = f"[[abaikan]] ke-{nomor}"
    _tolak_kunci_asing(d, _KUNCI_ABAIKAN, prefix)
    path = _wajib(d, "path", prefix)
    alasan = _wajib(d, "alasan", prefix)
    if not path:
        raise RegistryError(f"{prefix}: `path` kosong")
    if not alasan:
        raise RegistryError(
            f"{prefix}: `alasan` kosong; tulis kenapa berkas ini diabaikan"
        )
    return Abaikan(path=path, alasan=alasan)


# ── Validasi per entri dan lintas entri ──────────────────────────────────────


def _periksa_sumber(sumber: tuple[Sumber, ...], base: Path) -> None:
    seen_ids: set[str] = set()
    seen_tabel: dict[tuple[str, str], str] = {}
    seen_path: set[str] = set()

    for nomor, s in enumerate(sumber, 1):
        prefix = f"[[sumber]] ke-{nomor} (id={s.id!r})"

        if not s.id:
            raise RegistryError(f"{prefix}: `id` kosong")
        if not _ID_RE.match(s.id):
            raise RegistryError(f"{prefix}: `id` harus kebab-case, dapat {s.id!r}")
        if s.id in seen_ids:
            raise RegistryError(f"{prefix}: `id` {s.id!r} ganda")
        seen_ids.add(s.id)

        if not s.asal:
            raise RegistryError(
                f"{prefix}: `asal` kosong; isi frasa yang bisa ditelusuri "
                'atau tulis "belum diketahui"'
            )

        if s.jenis == "sdi":
            if s.path or s.tabel or s.tanggal_ambil or s.tabel_lain:
                raise RegistryError(
                    f"{prefix}: untuk jenis='sdi', `path`/`tabel`/`tanggal_ambil`/"
                    "`tabel_lain` tidak berlaku"
                )
            if s.namespace != "bronze_sdi":
                raise RegistryError(
                    f"{prefix}: jenis='sdi' harus namespace='bronze_sdi'"
                )
            continue

        # berkas & sekunder: butuh path, tabel, dan namespace yang sesuai jenis.
        if not s.path:
            raise RegistryError(f"{prefix}: `path` wajib untuk jenis={s.jenis!r}")
        if not (base / s.path).is_file():
            raise RegistryError(
                f"{prefix}: `path` {s.path!r} tidak ada di disk (dicari di {base / s.path})"
            )
        if s.path in seen_path:
            raise RegistryError(
                f"{prefix}: `path` {s.path!r} dipakai dua kali di [[sumber]]"
            )
        seen_path.add(s.path)

        if not s.tabel:
            raise RegistryError(f"{prefix}: `tabel` wajib untuk jenis={s.jenis!r}")
        if not _TABEL_RE.match(s.tabel):
            raise RegistryError(f"{prefix}: `tabel` {s.tabel!r} harus [a-z][a-z0-9_]*")

        wajib_ns = {"berkas": "bronze_file", "sekunder": "bronze_sec"}[s.jenis]
        if s.namespace != wajib_ns:
            raise RegistryError(
                f"{prefix}: jenis={s.jenis!r} harus namespace={wajib_ns!r}, dapat {s.namespace!r}"
            )

        if s.kelas_refresh == "saat_berubah" and not s.pembangun:
            raise RegistryError(f"{prefix}: `pembangun` wajib untuk kelas_refresh='saat_berubah'")
        if s.kelas_refresh == "snapshot" and s.tanggal_ambil is None:
            raise RegistryError(
                f"{prefix}: `tanggal_ambil` wajib untuk kelas_refresh='snapshot'"
            )

        for pasangan in ((s.namespace, s.tabel), *s.tabel_lain):
            ns, tb = pasangan
            if ns not in NAMESPACE_VALID:
                raise RegistryError(
                    f"{prefix}: namespace {ns!r} di `tabel_lain` di luar {sorted(NAMESPACE_VALID)}"
                )
            if not _TABEL_RE.match(tb):
                raise RegistryError(f"{prefix}: tabel {tb!r} harus [a-z][a-z0-9_]*")
            if pasangan in seen_tabel:
                raise RegistryError(
                    f"{prefix}: pasangan (namespace, tabel) {pasangan} sudah dipakai "
                    f"oleh [[sumber]] id={seen_tabel[pasangan]!r}"
                )
            seen_tabel[pasangan] = s.id


def _periksa_abaikan(abaikan: tuple[Abaikan, ...]) -> None:
    seen: set[str] = set()
    for nomor, a in enumerate(abaikan, 1):
        prefix = f"[[abaikan]] ke-{nomor}"
        if a.path in seen:
            raise RegistryError(
                f"{prefix}: `path` {a.path!r} muncul dua kali di [[abaikan]]"
            )
        seen.add(a.path)


def _periksa_tak_bertuan(
    sumber: tuple[Sumber, ...], abaikan: tuple[Abaikan, ...], base: Path
) -> None:
    """Setiap path di [[sumber]] dan [[abaikan]] harus tepat satu kali di keduanya.

    Dicek di sini (bukan di test) supaya loader sendiri menolak registri yang
    menaruh berkas yang sama di dua tempat.
    """
    dari_sumber = [s.path for s in sumber if s.path]
    dari_abaikan = [a.path for a in abaikan]
    muncul_dua = sorted({p for p in dari_sumber if p in dari_abaikan})
    if muncul_dua:
        raise RegistryError(
            f"path ada di [[sumber]] DAN [[abaikan]] (harus salah satu): {muncul_dua}"
        )


# ── Penghitung untuk test ────────────────────────────────────────────────────


def semua_path(registry: Registry) -> list[str]:
    """Daftar path (dengan duplikat) dari [[sumber]] dan [[abaikan]], urutan asli.

    Dipakai oleh uji integritas registri (`test_tidak_ada_berkas_tak_bertuan`):
    menyatukan path yang tercakup supaya gampang dicek dobel atau tak bertuan.
    """
    return [s.path for s in registry.sumber if s.path] + [
        a.path for a in registry.abaikan
    ]


__all__ = [
    "Abaikan",
    "JENIS_VALID",
    "KELAS_REFRESH_VALID",
    "NAMESPACE_VALID",
    "Registry",
    "RegistryError",
    "Sumber",
    "load",
    "semua_path",
]
