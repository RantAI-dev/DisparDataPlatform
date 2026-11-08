<!-- Berkas ini DIHASILKAN scripts/dokumen/bangun.py. Jangan diedit tangan. -->

# Skenario tes Data API

Dihasilkan dari `lakehouse/data-api/tests` (fungsi `test_*` dan baris pertama docstring-nya).
`unit` dan `contract` jalan tanpa jaringan (`pytest -q`); `panggung` read-only melawan ClickHouse
(`pytest -m panggung`).

## `tests/contract/test_atlas_kontrak.py`

| Tes | Keterangan |
|---|---|
| `test_respons_sesuai_kontrak` | — |
| `test_halaman_gmti_dan_has_more` | — |
| `test_galat_sesuai_kontrak` | — |
| `test_semua_endpoint_plan05_diuji` | — |

## `tests/contract/test_dashboard_kontrak.py`

| Tes | Keterangan |
|---|---|
| `test_respons_sesuai_kontrak` | — |
| `test_parameter_salah_sesuai_kontrak` | — |
| `test_q21_data_kosong_tetap_sesuai_kontrak` | Q21: semua query ClickHouse gagal → 200 + data kosong yang tetap sah menurut kontrak. |
| `test_semua_endpoint_dashboard_diuji` | — |
| `test_q21_parameter_sah_tidak_ditolak_saat_data_kosong` | Saat query gagal, parameter yang biasanya sah tetap dijawab 200 kosong (bukan 400). |
| `test_q21_label_tahun_tanpa_bulan` | — |

## `tests/contract/test_dataset_kontrak.py`

| Tes | Keterangan |
|---|---|
| `test_respons_json_sesuai_kontrak` | — |
| `test_ekspor_csv_sesuai_kontrak` | — |
| `test_ekspor_413_sesuai_kontrak` | — |
| `test_sistem_sesuai_kontrak` | — |
| `test_semua_endpoint_plan02_diuji` | Daftar kasus menutup setiap path plan 02 di kontrak. |
| `test_validator_menolak_bentuk_salah` | — |

## `tests/contract/test_indikator_kontrak.py`

| Tes | Keterangan |
|---|---|
| `test_respons_sesuai_kontrak` | — |
| `test_kode_tidak_dikenal_sesuai_kontrak` | — |
| `test_semua_endpoint_plan04_diuji` | — |

## `tests/panggung/test_atlas_live.py`

| Tes | Keterangan |
|---|---|
| `test_atlas_gmti_statis_sama_dengan_golden` | — |
| `test_spasial_sama_dengan_golden_live` | — |
| `test_spasial_detail_titik_statis` | — |
| `test_hotel_scraped_sama_dengan_sql_route_atas_bronze` | — |

## `tests/panggung/test_dashboard_live.py`

| Tes | Keterangan |
|---|---|
| `test_dashboard_sama_dengan_golden` | — |

## `tests/panggung/test_dataset_live.py`

| Tes | Keterangan |
|---|---|
| `test_katalog` | — |
| `test_detail_dan_kolom` | — |
| `test_baris_tanpa_sort` | — |
| `test_baris_dengan_filter_dan_sort` | — |
| `test_facet` | — |
| `test_agregat` | Nilai seri di Next.js tak berurut tetap; bandingkan isi dan urutan nilai menurun. |

## `tests/panggung/test_indikator_live.py`

| Tes | Keterangan |
|---|---|
| `test_indikator_sama_dengan_golden` | — |

## `tests/test_openapi.py`

| Tes | Keterangan |
|---|---|
| `test_spesifikasi_valid` | — |
| `test_tidak_ada_patch` | — |
| `test_semua_path_kontrak_ada` | — |
| `test_tidak_ada_path_di_luar_kontrak` | — |
| `test_hanya_get_kecuali_flush` | — |
| `test_operation_id_unik` | — |
| `test_setiap_operasi_punya_contoh_sukses` | — |
| `test_respons_error_memakai_skema_error` | — |
| `test_kode_error_sesuai_status` | SPEC §3.3: NOT_FOUND 404, INVALID_* 400, TOO_LARGE 413, UNAUTHORIZED 401, UPSTREAM 503. |
| `test_health_tanpa_token_lainnya_wajib_token` | — |
| `test_batas_parameter` | Plan 01: size maks 200 untuk baris, 500 untuk katalog; top maks 50. |

## `tests/unit/atlas/test_atlas.py`

| Tes | Keterangan |
|---|---|
| `test_golden_pertunjukan` | — |
| `test_golden_golf_suvenir_hotel` | — |
| `test_event_date_sort` | — |
| `test_tahun_dan_verifikasi_pengunjung` | — |
| `test_hotel_los_dibulatkan_seperti_tofixed_dan_periode_bolong_null` | — |

## `tests/unit/beranda/test_ringkasan.py`

| Tes | Keterangan |
|---|---|
| `test_ringkasan` | — |
| `test_indikator_dari_berkas` | — |
| `test_indikator_bronze_dinormalkan` | — |

## `tests/unit/dashboard/test_dashboard.py`

| Tes | Keterangan |
|---|---|
| `test_wisman_tahunan_dan_tahun_parsial` | — |
| `test_wisman_bulan_bolong_q8` | Q8 ditiru: label "s/d" memakai jumlah baris, bukan bulan terakhir. |
| `test_wisman_bulanan_kpi_dan_yoy` | — |
| `test_kebangsaan_lainnya_sumber_digabung` | — |
| `test_pintu_masuk_tahun_bps_dan_semester` | — |
| `test_semester_belum_dirilis_item_kosong` | — |
| `test_parameter_tidak_valid_400` | — |
| `test_lama_menginap_dan_jenis_tamu_tak_dikenal_q18` | — |
| `test_per_kelas_tabel_dan_tanpa_pembanding` | — |
| `test_seri_per_kelas` | — |
| `test_wisnus_meta_dan_tahunan` | — |
| `test_wisnus_filter_kota_q15` | Q15: KPI capaian ikut filter kota, "tujuan terbanyak" tidak. |
| `test_wisnus_tahun_hilang` | — |
| `test_wisnus_yoy_kota_tidak_lengkap_q16` | Q16: YoY bulan yang himpunan kotanya berbeda dari bulan pembanding tidak dihitung. |
| `test_wisnus_per_kota` | — |
| `test_tenaga_kerja_dki` | — |
| `test_tenaga_kerja_subsektor_dan_sertifikasi_q11` | — |
| `test_tenaga_kerja_sebaran_dki` | — |
| `test_pdrb_sama_dengan_golden_statis` | — |
| `test_ringkasan` | — |
| `test_q21_query_gagal_data_kosong_dan_peringatan` | — |
| `test_q21_tidak_berlaku_untuk_bronze_pdrb` | — |
| `test_format_angka_seperti_intl` | — |
| `test_destinasi_meta_per_jenis` | Daftar destinasi hanya yang pernah melaporkan jenis itu; tahun parsial berlabel. |
| `test_destinasi_ringkasan_semua_dan_catatan` | — |
| `test_destinasi_ringkasan_satu_destinasi_bulan_null` | Bulan NULL tidak dihitung (11 bulan), bukan nol; porsi dan peringkat di antara pelapor. |
| `test_destinasi_per_destinasi_dan_bulanan` | — |
| `test_destinasi_wisman_dominan_bukan_tertukar` | Destinasi yang memang sering didominasi wisman tidak ditandai tertukar. |
| `test_destinasi_parameter_salah_400` | — |

## `tests/unit/dataset/test_baris.py`

| Tes | Keterangan |
|---|---|
| `test_halaman_bawaan` | — |
| `test_kolom_audit_tidak_keluar` | — |
| `test_size_dijepit_dan_halaman` | — |
| `test_cari_cocok_dan_tidak` | — |
| `test_filter_dan_sort` | — |
| `test_filter_tidak_valid_400` | — |

## `tests/unit/dataset/test_detail.py`

| Tes | Keterangan |
|---|---|
| `test_detail_sukses` | — |
| `test_slug_tidak_dikenal_404` | — |
| `test_slug_bentuk_salah_400` | — |
| `test_metadata_ada_silver_tidak` | — |
| `test_kolom_tampil_periode_depan_ekstra_belakang` | — |
| `test_kolom_tampil_urut_ord_angka` | — |
| `test_detail_sumber_sekunder_tanpa_portal` | — |

## `tests/unit/dataset/test_ekspor.py`

| Tes | Keterangan |
|---|---|
| `test_csv` | — |
| `test_nama_terfilter` | — |
| `test_xlsx` | — |
| `test_tidak_dikenal_404_dan_format_salah` | — |
| `test_terlalu_besar_413` | — |
| `test_ekspor_dibaca_per_halaman` | — |
| `test_sel_formula_dinetralkan` | — |
| `test_ekspor_menetralkan_formula` | — |

## `tests/unit/dataset/test_facet_agregat.py`

| Tes | Keterangan |
|---|---|
| `test_facet` | — |
| `test_facet_teks_banyak_jadi_none` | — |
| `test_facet_slug_tidak_dikenal_kosong` | — |
| `test_agregat_count_tanpa_y_dan_label_kosong` | — |
| `test_agregat_sum_dan_semua_agg` | — |
| `test_agregat_tidak_valid` | — |

## `tests/unit/dataset/test_katalog.py`

| Tes | Keterangan |
|---|---|
| `test_katalog_semua` | — |
| `test_entri_sekunder_teks_app_baris_lake` | — |
| `test_filter_sumber` | — |
| `test_filter_tag_utuh_tanpa_beda_huruf` | — |
| `test_filter_sumber_tidak_dikenal` | — |
| `test_stats_dan_layer` | — |
| `test_halaman_dan_tier_salah` | — |
| `test_urutan_stabil` | — |
| `test_lakehouse_mati_503` | — |
| `test_entri_opd_disembunyikan_dan_dataset_kosong_ditandai` | — |

## `tests/unit/gmti/test_gmti.py`

| Tes | Keterangan |
|---|---|
| `test_golden_ringkasan_meta_dihitung_ulang` | — |
| `test_golden_kolam_pilar` | — |
| `test_kolam_pilar_ibadah_dari_simas_halal_dari_tempat` | — |
| `test_golden_filter_server_sama_dengan_filter_klien` | Halaman 1–3 dan total untuk 4 kombinasi filter (plan 05), dari memo `filtered` GmtiView asli. |
| `test_maps_url_tanpa_koordinat_memakai_alamat` | — |

## `tests/unit/hotel_scraped/test_hotel_scraped.py`

| Tes | Keterangan |
|---|---|
| `test_statistik_dan_histogram_snapshot_bronze` | — |
| `test_urutan_skor_turun_harga_naik_null_di_akhir_dan_tipe_mart` | — |
| `test_limit_dan_room_types_rusak` | — |

## `tests/unit/indikator/test_indikator.py`

| Tes | Keterangan |
|---|---|
| `test_pick_data_kolom_wajib_lalu_periode_lalu_total` | — |
| `test_pick_data_tanpa_kolom_wajib_jatuh_ke_terbesar` | — |
| `test_compute_readiness_tiga_status_dan_batas_draft` | — |
| `test_latest_value_sampah_d9` | D9: tanpa kolom periode di dataset_column, label = kolom pertama, urut teks menurun. |
| `test_daftar_gci_dan_gpci_urut_nomor_resmi` | — |
| `test_b_tren_lokasi_ce1_lainnya_tidak_dibuang_d7` | — |
| `test_c_wilayah_ce2_menjumlah_semua_periode_d4` | — |
| `test_e_event_ce3_dataset_terbesar_tanpa_kolom_d1` | D1: CE3 memilih dataset terbesar walau tak punya nama_event/nama_venue. |
| `test_a_peta_ce4_top15_dan_lat_lng_tertukar_d5` | — |
| `test_a_peta_ci_ta_tanpa_filter_dan_koordinat_tak_sah` | — |
| `test_d_registri_ba_mice` | — |
| `test_f_okupansi_ci_lh` | — |
| `test_g_survei_ci_sh_jumlah_rata_rata_d6` | D6: "Rata-rata keseluruhan" = Σ rata-rata per negara. |
| `test_fallback_data_belum_tersedia` | — |
| `test_kode_tidak_dikenal_404` | — |
| `test_kode_huruf_kecil_dan_tanpa_framework_seperti_rute_next` | C §2.1: `code.toUpperCase()`, dan kedua prefiks (`/gci`, `/gpci`) menerima kode mana pun. |
| `test_gci_resmi_angka_dari_bronze_teks_dari_app` | — |
| `test_dataset_tematik` | — |
| `test_bronze_dan_berkas_menghasilkan_struktur_sama` | Salinan Bronze (kolom huruf kecil, teks) dan berkas JSON → struktur indikator yang sama. |
| `test_id_num_seperti_agg_ts` | — |
| `test_to_fixed_dan_number_seperti_js` | — |
| `test_detail_membawa_identitas_dan_konteks_indeks` | Hero (nama, definisi, dimensi) dan kartu IndexContext dibaca dari respons detail. |

## `tests/unit/shared/test_atlas_gabungan.py`

| Tes | Keterangan |
|---|---|
| `test_golden_restoran_gci` | — |
| `test_golden_direktori_restoran` | — |
| `test_bentuk_bronze_sesuai_ingest` | — |
| `test_name_key` | — |
| `test_meters_between_ambang_60m` | — |
| `test_meters_between_asimetris_seperti_ts` | — |
| `test_hypot_dan_cos_bit_sama_dengan_v8` | — |
| `test_kunci_kolasi_meniru_localecompare` | — |
| `test_kunci_kolasi_seri_bila_hanya_beda_karakter_abaikan` | — |
| `test_sort_bawaan_per_unit_utf16` | — |
| `test_dedupe_place_id_sama_simpan_nama_terpanjang_dan_kurasi_dulu` | — |
| `test_dedupe_tanpa_place_id_nama_sama_dan_dekat` | — |
| `test_urutan_akhir_tier_rating_ulasan_nama` | — |
| `test_osm_dibuang_bila_sudah_dikurasi_dan_hotel_generik` | — |
| `test_gci_field_none_dan_enrichment` | — |
| `test_gci_maps_url_encode_uri_component` | — |
| `test_direktori_filter_dki_dan_sidik_jari` | — |
| `test_direktori_url_tanpa_koordinat_dan_alamat_kosong` | — |
| `test_direktori_rata_rata_tanpa_penjumlahan_terkompensasi` | — |
| `test_get_city_list_dan_cuisine_list` | — |

## `tests/unit/shared/test_dasar.py`

| Tes | Keterangan |
|---|---|
| `test_tanpa_token_menolak_start` | — |
| `test_token_bentuk_salah` | — |
| `test_indikator_berkas_ditolak_di_produksi` | — |
| `test_nama_klien` | — |
| `test_halaman_dijepit` | — |
| `test_format` | — |
| `test_cache_ttl_dan_kosongkan` | — |
| `test_ch_parameter_terikat_dan_penanda` | — |
| `test_ch_error_jadi_upstream` | — |
| `test_ch_coba_ulang_sekali_saat_timeout` | — |
| `test_ch_escape_seperti_clickhouse_client` | — |
| `test_cache_dibatasi` | — |

## `tests/unit/shared/test_filters.py`

| Tes | Keterangan |
|---|---|
| `test_kind_of` | — |
| `test_cari_dipangkas_dan_dibatasi` | — |
| `test_filter_in_digabung_per_kolom` | — |
| `test_nilai_boleh_mengandung_titik_dua` | — |
| `test_rentang_angka_dan_ujung_terbuka` | — |
| `test_rentang_tanggal` | — |
| `test_parse_tidak_valid` | — |
| `test_klausa_tidak_valid` | — |
| `test_sort_dan_pengurut_cadangan` | — |
| `test_sort_tidak_valid` | — |
| `test_sort_kolom_tidak_dikenal` | — |
| `test_backtick_ditolak` | — |

## `tests/unit/spasial/test_spasial.py`

| Tes | Keterangan |
|---|---|
| `test_golden_titik_statis_lengkap_dengan_alamat` | — |
| `test_spatial_city` | — |
| `test_spatial_category` | — |
| `test_koordinat_sah` | — |
| `test_dedup_statis_menang_dan_kunci_seperti_js` | — |
| `test_titik_dalam_poligon_tepi_dan_lubang` | — |
| `test_kecamatan_titik_dan_ibadah_tanpa_koordinat` | — |
| `test_tebakan_kolom_lat_lon_berurutan_dan_huruf_kecil` | — |
| `test_penemuan_titik_lake_berhalaman_dan_urut_sumber` | — |
| `test_kota_dki_dari_koordinat` | — |
| `test_di_dki_mengganti_wilayah_dan_membuang_titik_luar` | — |
| `test_titik_lake_menukar_lintang_bujur_tertukar_dan_kolom_nama_sdi` | — |

## `tests/unit/test_aplikasi.py`

| Tes | Keterangan |
|---|---|
| `test_tanpa_token_401` | — |
| `test_token_salah_401` | — |
| `test_health_tanpa_token` | — |
| `test_request_id_dipantulkan_dan_dicatat` | — |
| `test_request_id_dibuat_dan_masuk_sql` | — |
| `test_error_juga_membawa_request_id` | — |
| `test_path_tidak_dikenal_404_beramplop` | — |
| `test_tidak_ada_patch_atau_metode_tulis` | Hanya GET, kecuali POST /v1/admin/cache/flush (SPEC §3.3). |
| `test_docs_mati_bawaan` | — |
| `test_docs_hidup_dengan_env` | — |
| `test_flush_hanya_dagster` | — |
| `test_daftar_tabel_silver_dikosongkan_flush` | Tabel Silver baru terbaca sesudah flush, tanpa restart (E §4.4). |
| `test_response_model_terpasang` | `models.py` tiap fitur menjadi skema respons dan menyaring keluaran service. |

## `tests/unit/test_impor.py`

| Tes | Keterangan |
|---|---|
| `test_aturan_impor` | — |
| `test_sql_hanya_di_queries` | — |
| `test_pemindai_menangkap_pelanggaran` | — |
