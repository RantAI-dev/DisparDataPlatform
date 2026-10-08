"""Uji parser SDI memakai payload contoh — tanpa jaringan."""

from dispar_ingest.sdi import parse_detail, parse_search_page, parse_table_page


def test_parse_search_page_membaca_item_dan_total():
    payload = {
        "total_data": 182,
        "total_page": 23,
        "data": [
            {
                "url": "jumlah-kunjungan-wisatawan-mancanegara",
                "title": "Jumlah Kunjungan Wisatawan Mancanegara",
                "desc": "Data kunjungan wisman",
                "tag": '["pariwisata","wisman"]',
                "count_view": "1234",
                "updated_at": "2026-07-01",
            },
            {
                "url": "daftar-restoran",
                "title": "Daftar Restoran",
                "tag": None,
                "count_view": None,
            },
        ],
    }
    datasets, total_data, total_page = parse_search_page(payload)

    assert total_data == 182
    assert total_page == 23
    assert len(datasets) == 2
    assert datasets[0].slug == "jumlah-kunjungan-wisatawan-mancanegara"
    assert datasets[0].tags == ["pariwisata", "wisman"]
    assert datasets[0].views == 1234
    # Tag null dan view null tidak boleh membuat parser meledak.
    assert datasets[1].tags == []
    assert datasets[1].views == 0


def test_parse_search_page_menangani_data_bersarang():
    """Sebagian respons SDI membungkus daftar di data.data."""
    payload = {"data": {"data": [{"url": "a", "title": "A"}], "total_data": 1, "total_page": 1}}
    datasets, total_data, _ = parse_search_page(payload)
    assert [d.slug for d in datasets] == ["a"]
    assert total_data == 1


def test_parse_search_page_melewati_item_tanpa_slug():
    payload = {"data": [{"title": "tanpa slug"}, {"url": "ada", "title": "Ada"}]}
    datasets, _, _ = parse_search_page(payload)
    assert [d.slug for d in datasets] == ["ada"]


def test_parse_detail_mengambil_komponen_data_table():
    payload = {
        "data": {
            "title": "Jumlah Kunjungan Wisman",
            "desc": "deskripsi",
            "sumber_data": ["BPS"],
            "frekuensi_penerbitan": "Bulanan",
            "satuan": "Orang",
            "klasifikasi_data": "Terbuka",
            "kontak": "dispar@jakarta.go.id",
            "author": "Dinas Pariwisata",
            "komponen_data_table": [
                {"header_komponen": "negara", "tipe_data_komponen": "text", "desc_komponen": "Negara asal"},
                {"header_komponen": "jumlah", "tipe_data_komponen": "number", "desc_komponen": "Jumlah"},
                {"tanpa_header": True},
            ],
        }
    }
    detail = parse_detail(payload, "jumlah-kunjungan-wisman")

    assert detail.title == "Jumlah Kunjungan Wisman"
    assert detail.sumber_data == ["BPS"]
    assert detail.frekuensi == "Bulanan"
    # Komponen tanpa header_komponen dibuang.
    assert [c["key"] for c in detail.columns] == ["negara", "jumlah"]


def test_parse_detail_sumber_data_string_tunggal():
    detail = parse_detail({"data": {"sumber_data": "BPS"}}, "x")
    assert detail.sumber_data == ["BPS"]


def test_parse_table_page_membaca_baris_dan_total():
    payload = {"total": 120, "data": [{"a": "1"}, {"a": "2"}, "bukan dict"]}
    rows, total = parse_table_page(payload)
    assert total == 120
    assert rows == [{"a": "1"}, {"a": "2"}]


def test_parse_table_page_data_kosong():
    rows, total = parse_table_page({"data": None})
    assert rows == []
    assert total == 0


def test_parse_detail_data_bukan_dict():
    """SDI kadang mengembalikan data berupa string seperti 'data tidak tersedia'."""
    detail = parse_detail({"status": True, "data": "data tidak tersedia"}, "data_stakeholder_pariwisata_dki_jakarta")
    assert detail.slug == "data_stakeholder_pariwisata_dki_jakarta"
    assert detail.columns == []
    assert detail.sumber_data == []
