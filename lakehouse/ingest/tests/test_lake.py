"""Uji penyusunan tabel Bronze — tanpa katalog, tanpa jaringan."""

import pyarrow as pa

from dispar_ingest.lake import AUDIT_COLUMNS, build_table, row_hash, safe_name, to_text


def test_safe_name_menormalkan_nama_kolom():
    assert safe_name("Jumlah Kunjungan") == "jumlah_kunjungan"
    assert safe_name("NEGARA/ASAL") == "negara_asal"
    assert safe_name("  spasi  ") == "spasi"
    assert safe_name("2026") == "k_2026"
    assert safe_name("") == "kolom"
    assert safe_name("Ⅻ!!!") == "kolom"


def test_to_text_mempertahankan_null():
    assert to_text(None) is None
    assert to_text("teks") == "teks"
    assert to_text(123) == "123"
    assert to_text(1.5) == "1.5"
    assert to_text({"a": 1}) == '{"a": 1}'
    assert to_text(["a", "b"]) == '["a", "b"]'


def test_row_hash_stabil_dan_tidak_bergantung_urutan_kunci():
    assert row_hash({"a": "1", "b": "2"}) == row_hash({"b": "2", "a": "1"})
    assert row_hash({"a": "1"}) != row_hash({"a": "2"})


def test_build_table_semua_kolom_string_plus_audit():
    rows = [
        {"Negara": "Singapura", "Jumlah": 1234},
        {"Negara": "Malaysia", "Jumlah": None},
    ]
    tbl = build_table(rows, source_url="https://x/y", batch_id="b1", tenant="dispar-dki")

    assert tbl is not None
    assert tbl.num_rows == 2
    for name in ("negara", "jumlah"):
        assert tbl.schema.field(name).type == pa.string()
    for col in AUDIT_COLUMNS:
        assert col in tbl.schema.names
    assert tbl.column("jumlah").to_pylist() == ["1234", None]
    assert tbl.column("_tenant").to_pylist() == ["dispar-dki", "dispar-dki"]
    assert tbl.column("_source_url").to_pylist()[0] == "https://x/y"


def test_build_table_menyatukan_kolom_yang_berbeda_antar_baris():
    """Baris SDI tidak selalu punya kolom yang sama — union, bukan irisan."""
    rows = [{"a": "1"}, {"b": "2"}]
    tbl = build_table(rows, source_url="u", batch_id="b", tenant="t")

    assert tbl is not None
    assert set(tbl.schema.names) - set(AUDIT_COLUMNS) == {"a", "b"}
    assert tbl.column("a").to_pylist() == ["1", None]
    assert tbl.column("b").to_pylist() == [None, "2"]


def test_build_table_tanpa_baris_mengembalikan_none():
    assert build_table([], source_url="u", batch_id="b", tenant="t") is None


def test_build_table_kolom_audit_tidak_ditimpa_sumber():
    """Kalau sumber kebetulan punya kolom bernama _tenant, audit tetap menang."""
    rows = [{"_tenant": "palsu", "x": "1"}]
    tbl = build_table(rows, source_url="u", batch_id="b", tenant="asli")
    assert tbl is not None
    assert tbl.column("_tenant").to_pylist() == ["asli"]


def test_properti_io_statis_membuang_remote_signing():
    """Lakekeeper menyisipkan remote signing per tabel; IO harus tetap statis."""
    from dispar_ingest.lake import properti_io_statis

    statis = {
        "s3.endpoint": "http://lake-rustfs:9000",
        "s3.access-key-id": "kunci",
        "s3.secret-access-key": "rahasia",
    }
    dari_katalog = {
        "s3.signer": "S3V4RestSigner",
        "s3.signer.uri": "http://lake-catalog:8181/catalog/",
        "s3.signer.endpoint": "v1/signer/x/tabular-id/y/v1/aws/s3/sign",
        "s3.remote-signing-enabled": "true",
        "signer.uri": "http://lake-catalog:8181/catalog/",
        "signer.endpoint": "v1/signer/x/tabular-id/y/v1/aws/s3/sign",
        "s3.access-key-id": "kunci-titipan",
        "write.parquet.compression-codec": "zstd",
    }

    hasil = properti_io_statis(dari_katalog, statis)

    assert not [k for k in hasil if "sign" in k]
    assert hasil["s3.access-key-id"] == "kunci"
    assert hasil["s3.secret-access-key"] == "rahasia"
    assert hasil["write.parquet.compression-codec"] == "zstd"


def test_katalog_memuat_io_tanpa_signer():
    """_load_file_io dipakai load_table/create_table/commit: semuanya harus statis."""
    from dispar_ingest.lake import KatalogStatis

    katalog = KatalogStatis.__new__(KatalogStatis)  # tanpa menghubungi server
    katalog.properties = {"s3.signer": "S3V4RestSigner", "uri": "http://x"}
    katalog._s3_statis = {"s3.endpoint": "http://lake-rustfs:9000", "s3.access-key-id": "kunci"}

    io = katalog._load_file_io({"s3.signer.uri": "http://x", "s3.remote-signing-enabled": "true"})

    assert not [k for k in io.properties if "sign" in k]
    assert io.properties["s3.access-key-id"] == "kunci"
