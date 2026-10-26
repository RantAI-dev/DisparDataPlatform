"""Kontrak Data API (plan 01): openapi.yaml valid dan lengkap terhadap KONTRAK §2."""

from pathlib import Path

import pytest
import yaml
from openapi_spec_validator import OpenAPIV31SpecValidator, validate

SPEC_PATH = Path(__file__).resolve().parent.parent / "openapi.yaml"

# Daftar path KONTRAK §2 (plans/2026-10-21-portal-KONTRAK.md), ditulis eksplisit supaya
# path yang hilang dari openapi.yaml langsung ketahuan.
PATH_KONTRAK = [
    # §2.1 dataset
    "/v1/katalog",
    "/v1/dataset/{slug}",
    "/v1/dataset/{slug}/kolom",
    "/v1/dataset/{slug}/facet",
    "/v1/dataset/{slug}/baris",
    "/v1/dataset/{slug}/agregat",
    "/v1/dataset/{slug}/ekspor",
    # §2.2 dashboard
    "/v1/dashboard/ringkasan",
    "/v1/dashboard/wisman/tahunan",
    "/v1/dashboard/wisman/bulanan",
    "/v1/dashboard/wisman/kebangsaan",
    "/v1/dashboard/wisman/pintu-masuk",
    "/v1/dashboard/lama-menginap/rata-rata",
    "/v1/dashboard/lama-menginap/per-kelas",
    "/v1/dashboard/lama-menginap/seri",
    "/v1/dashboard/wisnus/meta",
    "/v1/dashboard/wisnus/tahunan",
    "/v1/dashboard/wisnus/per-kota",
    "/v1/dashboard/wisnus/bulanan",
    "/v1/dashboard/wisnus/yoy",
    "/v1/dashboard/destinasi/meta",
    "/v1/dashboard/destinasi/ringkasan",
    "/v1/dashboard/destinasi/per-destinasi",
    "/v1/dashboard/destinasi/bulanan",
    "/v1/dashboard/tenaga-kerja/dki",
    "/v1/dashboard/tenaga-kerja/subsektor",
    "/v1/dashboard/tenaga-kerja/sertifikasi",
    "/v1/dashboard/pdrb-ekraf/makro",
    "/v1/dashboard/pdrb-ekraf/subsektor/sebaran",
    "/v1/dashboard/pdrb-ekraf/subsektor/pertumbuhan",
    # §2.3 indikator
    "/v1/indikator",
    "/v1/indikator/{code}",
    "/v1/gci/resmi",
    "/v1/dataset-tematik",
    "/v1/pariwisata/wisatawan-internasional",
    "/v1/pariwisata/kuliner-michelin",
    "/v1/pariwisata/seni-pertunjukan",
    # §2.4 atlas
    "/v1/atlas/restoran-gci",
    "/v1/atlas/direktori-restoran",
    "/v1/atlas/pertunjukan",
    "/v1/atlas/golf",
    "/v1/atlas/suvenir",
    "/v1/atlas/hotel",
    # §2.5 gmti, spasial, hotel-scraped
    "/v1/gmti/ringkasan",
    "/v1/gmti/tempat",
    "/v1/spasial",
    "/v1/spasial/titik/{id}",
    "/v1/hotel-scraped",
    # §2.6 beranda
    "/v1/beranda/ringkasan",
    # §2.7 sistem (Data API)
    "/v1/health",
    "/v1/admin/cache/flush",
]

METODE = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
KODE_ERROR = {"NOT_FOUND", "INVALID_PARAM", "INVALID_FILTER", "TOO_LARGE", "UNAUTHORIZED", "UPSTREAM_UNAVAILABLE"}


@pytest.fixture(scope="module")
def spec() -> dict:
    return yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))


def operasi(spec: dict):
    for path, item in spec["paths"].items():
        for metode, op in item.items():
            if metode in METODE:
                yield path, metode, op


def resolve(spec: dict, obj: dict) -> dict:
    """Ikuti satu `$ref` lokal (#/components/...)."""
    ref = obj.get("$ref")
    if not ref:
        return obj
    node = spec
    for bagian in ref.removeprefix("#/").split("/"):
        node = node[bagian]
    return node


def test_spesifikasi_valid(spec):
    validate(spec, cls=OpenAPIV31SpecValidator)
    assert spec["openapi"].startswith("3.1")


def test_tidak_ada_patch(spec):
    assert [p for p, m, _ in operasi(spec) if m == "patch"] == []


def test_semua_path_kontrak_ada(spec):
    hilang = [p for p in PATH_KONTRAK if p not in spec["paths"]]
    assert hilang == [], f"path KONTRAK §2 belum ada di openapi.yaml: {hilang}"


def test_tidak_ada_path_di_luar_kontrak(spec):
    asing = [p for p in spec["paths"] if p not in PATH_KONTRAK]
    assert asing == [], f"path tidak tercantum di KONTRAK §2: {asing}"


def test_hanya_get_kecuali_flush(spec):
    bukan_get = [(p, m) for p, m, _ in operasi(spec) if m != "get"]
    assert bukan_get == [("/v1/admin/cache/flush", "post")]


def test_operation_id_unik(spec):
    ids = [op.get("operationId") for _, _, op in operasi(spec)]
    assert all(ids), "ada operasi tanpa operationId"
    assert len(ids) == len(set(ids))


def test_setiap_operasi_punya_contoh_sukses(spec):
    tanpa = []
    for path, metode, op in operasi(spec):
        sukses = op["responses"]["200"]
        isi = sukses.get("content", {})
        if not any("example" in c or "examples" in c for c in isi.values()):
            tanpa.append(f"{metode.upper()} {path}")
    assert tanpa == [], f"operasi tanpa example: {tanpa}"


def test_respons_error_memakai_skema_error(spec):
    salah = []
    for path, metode, op in operasi(spec):
        kode_error = [k for k in op["responses"] if k[0] in "45"]
        if not kode_error:
            salah.append(f"{metode.upper()} {path}: tidak ada respons 4xx/5xx")
        for kode in kode_error:
            r = resolve(spec, op["responses"][kode])
            skema = r["content"]["application/json"]["schema"]
            if skema.get("$ref") != "#/components/schemas/Error":
                salah.append(f"{metode.upper()} {path} {kode}")
            contoh = r["content"]["application/json"].get("example", {})
            if contoh.get("error", {}).get("code") not in KODE_ERROR:
                salah.append(f"{metode.upper()} {path} {kode}: kode error contoh tidak dikenal")
    assert salah == [], salah


def test_kode_error_sesuai_status(spec):
    """SPEC §3.3: NOT_FOUND 404, INVALID_* 400, TOO_LARGE 413, UNAUTHORIZED 401, UPSTREAM 503."""
    status = {
        "NOT_FOUND": "404", "INVALID_PARAM": "400", "INVALID_FILTER": "400",
        "TOO_LARGE": "413", "UNAUTHORIZED": "401", "UPSTREAM_UNAVAILABLE": "503",
    }
    for path, metode, op in operasi(spec):
        for kode, r in op["responses"].items():
            if kode[0] not in "45":
                continue
            code = resolve(spec, r)["content"]["application/json"]["example"]["error"]["code"]
            assert status[code] == kode, f"{metode.upper()} {path}: {code} di status {kode}"


def test_health_tanpa_token_lainnya_wajib_token(spec):
    for path, metode, op in operasi(spec):
        keamanan = op.get("security", spec.get("security"))
        if path == "/v1/health":
            assert keamanan == [], "health harus tanpa token"
        else:
            assert keamanan == [{"bearer": []}], f"{metode.upper()} {path} harus memakai token"


def test_batas_parameter(spec):
    """Plan 01: size maks 200 untuk baris, 500 untuk katalog; top maks 50."""
    def param(path, nama):
        for p in spec["paths"][path]["get"]["parameters"]:
            p = resolve(spec, p)
            if p["name"] == nama:
                return p["schema"]
        raise AssertionError(f"{path} tidak punya parameter {nama}")

    assert param("/v1/dataset/{slug}/baris", "size")["maximum"] == 200
    assert param("/v1/gmti/tempat", "size")["maximum"] == 200
    assert param("/v1/katalog", "size")["maximum"] == 500
    assert param("/v1/dashboard/wisman/kebangsaan", "top")["maximum"] == 50
