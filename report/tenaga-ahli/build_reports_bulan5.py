# -*- coding: utf-8 -*-
"""
Generator laporan bulan ke-5 Oktober 2026.
Periode pekerjaan: 1–30 Oktober. Verifikasi: 30 Oktober 2026 WIB.
Format dan identitas tetap mengikuti laporan sebelumnya.
Angka dan SQL sumber disimpan dalam verifikasi-bulan5.json.
"""
import os
import json
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets-bulan5")
INK = RGBColor(0x1a, 0x1a, 0x1a)
GREY = RGBColor(0x55, 0x55, 0x55)

# ---------- helpers ----------

def set_cell_bg(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def set_table_borders(table, color="7f7f7f", sz="4"):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{edge}')
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), sz)
        e.set(qn('w:space'), '0'); e.set(qn('w:color'), color)
        borders.append(e)
    tblPr.append(borders)

def cell_text(cell, text, bold=False, size=10, color=INK, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align: p.alignment = align
    run = p.add_run(text)
    run.bold = bold; run.font.size = Pt(size); run.font.name = "Arial"; run.font.color.rgb = color
    return p

def para(doc, text, size=11, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY,
         color=INK, space_after=6, space_before=0):
    p = doc.add_paragraph()
    p.alignment = align
    pf = p.paragraph_format
    pf.space_after = Pt(space_after); pf.space_before = Pt(space_before); pf.line_spacing = 1.15
    run = p.add_run(text)
    run.bold = bold; run.italic = italic; run.font.size = Pt(size)
    run.font.name = "Arial"; run.font.color.rgb = color
    return p

def heading(doc, text, size=12):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12); p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True; run.font.size = Pt(size); run.font.name = "Arial"; run.font.color.rgb = INK
    return p

def bullets(doc, items, letters=False):
    for i, it in enumerate(items):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.9); p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.12
        prefix = f"{chr(97+i)}.  " if letters else "•  "
        r = p.add_run(prefix); r.font.name = "Arial"; r.font.size = Pt(11); r.bold = letters
        r2 = p.add_run(it); r2.font.name = "Arial"; r2.font.size = Pt(11); r2.font.color.rgb = INK

def add_image(doc, filename, caption, width_cm=15.5, max_h_cm=19.0):
    path = os.path.join(ASSETS, filename)
    w_px, h_px = Image.open(path).size
    w = width_cm
    h = width_cm * h_px / w_px
    if h > max_h_cm:
        h = max_h_cm; w = max_h_cm * w_px / h_px
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(path, width=Cm(w), height=Cm(h))
    cap = doc.add_paragraph(); cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(10)
    r = cap.add_run(caption); r.italic = True; r.font.size = Pt(9)
    r.font.name = "Arial"; r.font.color.rgb = GREY

def realisasi_table(doc, rows):
    t = doc.add_table(rows=1, cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_table_borders(t)
    hdr = t.rows[0].cells
    cell_text(hdr[0], "Uraian Tugas (KAK)", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.LEFT)
    cell_text(hdr[1], "Realisasi Bulan Ini", bold=True, size=10, align=WD_ALIGN_PARAGRAPH.LEFT)
    for c in hdr: set_cell_bg(c, "d9d9d9")
    for tugas, real in rows:
        r = t.add_row().cells
        cell_text(r[0], tugas, size=9.5, align=WD_ALIGN_PARAGRAPH.LEFT)
        cell_text(r[1], real, size=9.5, align=WD_ALIGN_PARAGRAPH.LEFT)
    t.columns[0].width = Cm(6.6); t.columns[1].width = Cm(9.0)
    for row in t.rows:
        row.cells[0].width = Cm(6.6); row.cells[1].width = Cm(9.0)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)

def data_table(doc, header, rows, widths):
    t = doc.add_table(rows=1, cols=len(header)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False; set_table_borders(t)
    for i, h in enumerate(header):
        cell_text(t.rows[0].cells[i], h, bold=True, size=8.5, align=WD_ALIGN_PARAGRAPH.LEFT)
        set_cell_bg(t.rows[0].cells[i], "d9d9d9")
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cell_text(cells[i], v, size=8.5, align=WD_ALIGN_PARAGRAPH.LEFT)
    for row in t.rows:
        for i, w in enumerate(widths):
            row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


# ---------- bukti terverifikasi, dengan periode eksplisit ----------
with open(os.path.join(BASE, "verifikasi-bulan5.json"), encoding="utf-8") as f:
    EVIDENCE = json.load(f)
INV = EVIDENCE["inventory"]
QUALITY = EVIDENCE["quality_last_full_day"]
QUALITY_CUM = EVIDENCE["quality_october_cumulative"]
HISTORY = EVIDENCE["rowcount_history"]
QUARANTINE = EVIDENCE["quarantine"]
KONFORM = EVIDENCE["konform"]
DAGSTER = EVIDENCE["dagster"]
IND = {i["label"]: i for i in EVIDENCE["indicators"]}

def angka(value):
    return f"{value:,}".replace(",", ".")

LAKE_HEADER = ["Lapisan", "Bentuk penyimpanan", "Isi", "Jumlah"]
LAKE_ROWS = [
    ["Data mentah", "Format terbuka Apache Iceberg", "Tabel data primer, berkas, dan sekunder; tidak termasuk metadata", f'{INV["bronze_data_tables"]} tabel data'],
    ["Metadata mentah", "Tabel pendukung", "Metadata sumber; dihitung terpisah dari tabel data", f'{INV["bronze_meta_objects"]} tabel'],
    ["Data bersih", "Tampilan dan tabel bertipe", "Tampilan bersih serta tabel pendukung di silver", f'{INV["silver_views"]} tampilan + {INV["silver_tables"]} tabel'],
    ["Data konform", "Dimensi induk dan fakta", "Kode baku wilayah, negara, periode, pintu masuk; fakta kunjungan", f'{INV["konform_dims"]} dimensi/kunci + {INV["konform_facts"]} fakta'],
    ["Mart penyaji", "Tabel agregat", "Mart operasional; tabel berakhiran _baru tidak dihitung", f'{INV["gold_operational_marts"]} mart'],
    ["Persiapan penyaji", "Tabel berakhiran _baru", "Objek persiapan; dipisahkan dari mart operasional", f'{INV["gold_staging_baru"]} tabel'],
]
LAKE_WIDTHS = [3.0, 3.5, 6.1, 3.0]
MART_HEADER = ["Mart penyaji", "Isi / batas penggunaan", "Baris"]
MART_DESC = {
    "mart_wisman": "Kunjungan wisman per negara 2014–Juli 2026; sumber dashboard wisman",
    "mart_kunjungan_dtw": "Kunjungan daya tarik wisata; angka terisi berperiode Juni/Juli 2026, bukan Oktober",
    "mart_gci_readiness": "Kesiapan data indikator GCI/GPCI",
    "mart_event": "Ringkasan event",
    "mart_kuliner": "Ringkasan kuliner",
    "mart_atlas": "Ringkasan pendataan lapangan",
    "mart_hotel_scraped_booking": "Uji pengumpulan data hotel; kosong karena batas simpan 30 hari",
}
MART_ROWS = [[name, MART_DESC[name], angka(n)] for name, n in EVIDENCE["marts"]["results"].items()]
MART_WIDTHS = [4.7, 8.9, 2.0]
QUAL_HEADER = ["Pemeriksaan / riwayat", "Hasil dan periode"]
QUAL_ROWS = [
    ["Lolos", angka(QUALITY["pass"]) + " pemeriksaan; 29 Oktober 2026"],
    ["Peringatan", angka(QUALITY["warn"]) + " pemeriksaan; 29 Oktober 2026"],
    ["Gagal", angka(QUALITY["fail"]) + " pemeriksaan; 29 Oktober 2026"],
    ["Akumulasi 1–30 Oktober", f'{angka(QUALITY_CUM["pass"])} lolos, {angka(QUALITY_CUM["warn"])} peringatan, {angka(QUALITY_CUM["fail"])} gagal'],
    ["Catatan jumlah baris selama Oktober", f'{angka(HISTORY["n"])} catatan pada {HISTORY["tabel"]} tabel, {HISTORY["hari"]} hari'],
]
QUAL_WIDTHS = [8.0, 7.6]
KARANTINA_HEADER = ["Alasan / keterangan", "Tabel terdampak", "Temuan"]
KARANTINA_ROWS = [[r["reason"], str(r["tables"]) + " tabel", angka(r["failed_values"]) + " nilai"] for r in QUARANTINE["samples"]]
KARANTINA_ROWS.append(["Total kelompok temuan 30 Oktober", "Bukan baris/orang unik", str(QUARANTINE["snapshot_groups"]) + " kelompok"])
KARANTINA_WIDTHS = [8.0, 3.6, 4.0]
_wm = {r["tahun"]: r for r in IND["Wisman Jakarta (sumber dashboard: serving.mart_wisman)"]["results"]}
_wn = {r["tahun"]: r for r in IND["Perjalanan wisnus menurut kota tujuan"]["results"]}
_ds = {(r["th"], r["jenis"]): r for r in IND["Kunjungan ke destinasi wisata (SDI Disparekraf)"]["results"]}
_tk = IND["Tenaga kerja ekraf DKI"]["results"][0]
WIS_HEADER = ["Indikator", "Periode data", "Jumlah"]
WIS_ROWS = [
    ["Wisman Jakarta", "Januari–Desember 2025", angka(_wm[2025]["jumlah"]) + " kunjungan"],
    ["Wisman Jakarta", "Januari–Juli 2026", angka(_wm[2026]["jumlah"]) + " kunjungan"],
    ["Perjalanan wisnus ke kota tujuan DKI", "Januari–Desember 2025", angka(_wn[2025]["jumlah"]) + " perjalanan"],
    ["Perjalanan wisnus ke kota tujuan DKI", "Januari–Mei 2026", angka(_wn[2026]["jumlah"]) + " perjalanan"],
    ["Kunjungan wisnus ke destinasi wisata", "Januari–Desember 2025", angka(_ds[(2025, "Wisnus")]["jumlah"]) + " kunjungan"],
    ["Kunjungan wisnus ke destinasi wisata", "Januari–Agustus 2026", angka(_ds[(2026, "Wisnus")]["jumlah"]) + " kunjungan"],
    ["Tenaga kerja ekonomi kreatif DKI", f'{_tk["tahun"]}; kategori Total', angka(_tk["jumlah_tenaga_kerja"]) + " orang"],
]
WIS_WIDTHS = [5.5, 5.0, 5.1]
_kc = KONFORM["counts"]; _kw = KONFORM["wilayah_tingkat"]; _kn = KONFORM["negara_jenis"]
KONFORM_HEADER = ["Data induk / fakta", "Isi", "Jumlah"]
KONFORM_ROWS = [
    ["Dimensi wilayah", f'Kode Kemendagri: {_kw["provinsi"]} provinsi, {_kw["kabkota"]} kab/kota, {_kw["kecamatan"]} kecamatan dan {_kw["kelurahan"]} kelurahan DKI', angka(_kc["dim_wilayah"]) + " entri"],
    ["Kunci wilayah", "Ejaan sumber yang dipetakan ke kode wilayah", angka(_kc["dim_wilayah_kunci"]) + " kunci"],
    ["Dimensi negara", f'ISO 3166: {_kn["negara"]} negara + {_kn["ember"]} kelompok agregat BPS', angka(_kc["dim_negara"]) + " entri"],
    ["Kunci negara", "Ejaan sumber yang dipetakan ke kode negara", angka(_kc["dim_negara_kunci"]) + " kunci"],
    ["Dimensi periode", "Hari, bulan, triwulan, semester, tahun; 1990–2035", angka(_kc["dim_periode"]) + " entri"],
    ["Dimensi pintu masuk", "16 bandara, 4 pelabuhan, 1 pos darat, 1 lainnya", angka(_kc["dim_pintu_masuk"]) + " entri"],
    ["Fakta wisman per negara", "Seluruh baris mendapat kode negara", angka(_kc["f_wisman_negara_bulanan"]) + " baris"],
    ["Fakta wisman per pintu masuk", "Seluruh baris mendapat kode pintu masuk", angka(_kc["f_wisman_pintu_bulanan"]) + " baris"],
    ["Fakta wisnus per kota", "Seluruh baris mendapat kode wilayah", angka(_kc["f_wisnus_kota_bulanan"]) + " baris"],
    ["Nilai tak cocok", "Nilai sumber yang tidak menemukan kode baku", angka(_kc["tak_cocok"]) + " baris"],
]
KONFORM_WIDTHS = [4.2, 8.4, 3.0]
BARU_NAMA = {
    "penerbangan_langsung_internasional_jakarta": "Penerbangan langsung internasional ke Jakarta",
    "penerbangan_langsung_domestik_jakarta": "Penerbangan langsung domestik ke Jakarta",
    "kegiatan_mice_jakarta_2026": "Kegiatan di venue MICE 2026",
    "venue_mice_jakarta": "Venue MICE",
    "michelin_keys_indonesia": "Hotel MICHELIN Key Indonesia 2026",
    "lokasi_syuting_film_jakarta": "Lokasi syuting film di DKI Jakarta",
    "museum_jakarta": "Museum di DKI Jakarta (SDI Dinas Kebudayaan)",
    "jalur_hijau_jakarta": "Jalur hijau (SDI lintas OPD)",
    "hutan_kota_jakarta": "Hutan kota (SDI lintas OPD)",
    "taman_jakarta": "Taman (SDI lintas OPD)",
    "hotel_per_kota_jakarta": "Hotel per kota DKI Jakarta",
    "hiburan_per_kota_jakarta": "Usaha hiburan per kota DKI Jakarta",
}
BARU_HEADER = ["Dataset", "Tabel bersih", "Baris"]
BARU_ROWS = [[BARU_NAMA[t], "silver." + t, angka(n)] for t, n in EVIDENCE["new_datasets_october"]["results"].items()]
BARU_WIDTHS = [6.2, 7.4, 2.0]
DAGSTER_HEADER = ["Job penjadwal", "Hasil run 4–30 Oktober", "Hari berhasil"]
DAGSTER_ROWS = [
    ["Pembaruan lake house (refresh_lakehouse)", f'{DAGSTER["refresh_lakehouse"]["SUCCESS"]} berhasil, {DAGSTER["refresh_lakehouse"]["FAILURE"]} gagal; termasuk run ulang manual', f'{DAGSTER["refresh_lakehouse"]["success_days"]} hari'],
    ["Pencadangan dan pemeliharaan (ops_backup_maintenance)", f'{DAGSTER["ops_backup_maintenance"]["SUCCESS"]} berhasil, {DAGSTER["ops_backup_maintenance"]["FAILURE"]} gagal (4–9 Oktober), 1 dibatalkan, 1 sedang berjalan saat dibaca', f'{DAGSTER["ops_backup_maintenance"]["success_days"]} hari; harian sejak 9 Oktober'],
]
DAGSTER_WIDTHS = [5.6, 7.0, 3.0]
_jt = EVIDENCE["web"]["jekate_test"]
JEKATE_HEADER = ["Butir uji", "Jawaban Jekate", "Kueri langsung"]
JEKATE_ROWS = [["Total wisman 2025", angka(_jt["answer_total"]), angka(_wm[2025]["jumlah"])]]
JEKATE_ROWS += [[f"Negara asal ke-{i}: {k}", angka(v), angka(v)] for i, (k, v) in enumerate(_jt["answer_top5"].items(), 1)]
JEKATE_WIDTHS = [6.0, 4.8, 4.8]
TABLES = {
    "lake": (LAKE_HEADER, LAKE_ROWS, LAKE_WIDTHS, "Sumber Q1: SHOW TABLES pada lake, silver, serving, konform; SHOW CREATE TABLE pada silver. Snapshot 30 Oktober 2026. Data mentah menghitung bronze_sdi, bronze_file, bronze_sec; metadata dipisah; mart operasional tidak mencakup _baru. Pembanding bulan 4 (2 Oktober): 227 tabel data mentah dan 232 tampilan bersih."),
    "mart": (MART_HEADER, MART_ROWS, MART_WIDTHS, "Sumber Q2: SELECT count() pada tujuh mart serving, 30 Oktober 2026. Jumlah baris adalah isi tabel saat pemeriksaan; tahun dan cakupan data mengikuti keterangan tiap mart."),
    "qual": (QUAL_HEADER, QUAL_ROWS, QUAL_WIDTHS, "Sumber Q3: _silver_meta.quality, hari penuh terakhir 29 Oktober WIB (30 Oktober memuat run ulang manual) dan akumulasi 1–30 Oktober; Q4: _silver_meta.rowcount_history 1–30 Oktober WIB. Dibaca 30 Oktober 2026. Catatan tidak membuktikan semua temuan otomatis dikeluarkan dari mart."),
    "karantina": (KARANTINA_HEADER, KARANTINA_ROWS, KARANTINA_WIDTHS, "Sumber Q5: _silver_meta.karantina, isi run 30 Oktober 2026. Tiap pasangan tabel dan alasan tercatat empat kali akibat run ulang dan dihitung sekali (672 baris mentah menjadi 175 kelompok). Riwayat per tanggal sebelumnya tidak tersimpan. Nilai gagal konversi bukan jumlah baris sumber atau orang unik."),
    "wis": (WIS_HEADER, WIS_ROWS, WIS_WIDTHS, "Sumber Q6: serving.mart_wisman (sumber dashboard wisman); Q7: silver.wisnus_perjalanan_per_kota_tujuan; Q8: silver.jumlah_kunjungan_wisatawan_ke_obyek_wisata_menurut_lokasi_di_provinsi_dki_jakarta, jenis wisnus; Q9: silver.tenaga_kerja_ekraf_per_provinsi, kode_wilayah 31, jenis_kelamin Total. Dibaca 30 Oktober 2026. Angka bukan realisasi bulan Oktober 2026; jumlah perjalanan dan kunjungan bukan jumlah orang unik."),
    "konform": (KONFORM_HEADER, KONFORM_ROWS, KONFORM_WIDTHS, "Sumber Q10: SELECT count() pada konform.*; SELECT tingkat, count() FROM konform.dim_wilayah; countIf(kode_* IS NULL) pada tiap fakta. Dibaca 30 Oktober 2026."),
    "baru": (BARU_HEADER, BARU_ROWS, BARU_WIDTHS, "Sumber Q11: SELECT count() FROM silver.<tabel>, 30 Oktober 2026. Daftar dataset dari berkas data/sekunder yang ditambahkan pada riwayat Git 1–30 Oktober 2026."),
    "dagster": (DAGSTER_HEADER, DAGSTER_ROWS, DAGSTER_WIDTHS, "Sumber Q12: GraphQL Dagster :13030, runsOrError sejak 1 Oktober 2026 WIB, dibaca 30 Oktober 2026. Riwayat run pada penjadwal saat ini baru dimulai 4 Oktober; 1–3 Oktober tidak diklaim berhasil maupun gagal."),
    "jekate": (JEKATE_HEADER, JEKATE_ROWS, JEKATE_WIDTHS, "Sumber Q13: pertanyaan uji di https://dispar.rantai.dev/ai, 30 Oktober 2026; pembanding SELECT negara, sum(jumlah_kunjungan) FROM silver.wisman_jakarta_per_negara WHERE toYear(periode_data)=2025. Satu pertanyaan uji; teks jawaban dibuka dengan kalimat koreksi diri."),
}
PENDAHULUAN_UMUM = (
    "Laporan bulanan kelima ini memuat pelaksanaan kegiatan Penyediaan dan Pengelolaan Data Statistik "
    "Pariwisata Jakarta Tahun Anggaran 2026 untuk periode 1–30 Oktober. Fokus pekerjaan adalah "
    "pemuatan data harian berbasis registri, pembentukan data induk wilayah, negara, dan periode, "
    "penambahan dataset pendukung pariwisata, penyempurnaan dashboard sesuai masukan rapat, serta "
    "penyiapan layanan data untuk pemindahan portal. Capaian ditelusuri dari perubahan yang tercatat "
    "pada Oktober dan bukti sistem yang diperiksa pada 30 Oktober 2026. Tahun data indikator dibedakan "
    "dari periode pekerjaan."
)
RTL_UMUM = (
    "Rencana November adalah menyelesaikan keputusan dan deploy yang tertunda, menyelaraskan sumber "
    "indikator yang periodenya belum seragam, menyimpan riwayat mutu per tanggal, serta menguji "
    "kemampuan yang belum memiliki bukti memadai, terutama pemulihan cadangan dan jawaban asisten AI. "
    "Pengembangan platform AI-Data diteruskan dengan menjaga keterlacakan angka sampai sumbernya; "
    "portal baru baru dipakai setelah angkanya terbukti sama dengan dashboard yang berjalan."
)
CAPTION_URLS = {
    "01-katalog.jpg": "https://dispar.rantai.dev/katalog",
    "02-wisnus-destinasi.jpg": "https://dispar.rantai.dev/dashboard/wisnus",
    "03-dagster-runs.jpg": "http://192.168.18.148:13030/runs (jaringan internal)",
    "04-data-api.jpg": "https://github.com/RantAI-dev/DisparDataPlatform/blob/d93c71f/lakehouse/data-api/README.md",
    "05-runbook.jpg": "https://github.com/RantAI-dev/DisparDataPlatform/blob/427a616/docs/DEPLOY-RUNBOOK.md (commit 22 Oktober 2026)",
    "06-konform-erd.jpg": "DESCRIBE dan SHOW CREATE TABLE konform.*; diagram disusun 30 Oktober 2026.",
    "07-chart-builder.jpg": "https://dispar.rantai.dev/sdi/kegiatan-mice-jakarta-2026",
    "08-jekate-jawaban.jpg": "https://dispar.rantai.dev/ai",
    "09-penerbangan.jpg": "https://dispar.rantai.dev/sdi/penerbangan-langsung-internasional-jakarta",
    "10-kegiatan-mice.jpg": "https://dispar.rantai.dev/sdi/kegiatan-mice-jakarta-2026",
    "11-hotel-per-kota.jpg": "https://dispar.rantai.dev/sdi/hotel-per-kota-jakarta",
    "12-michelin.jpg": "https://dispar.rantai.dev/sdi/michelin-keys-indonesia",
    "13-syuting.jpg": "https://dispar.rantai.dev/sdi/lokasi-syuting-film-jakarta",
    "14-portal-spec.jpg": "https://github.com/RantAI-dev/DisparDataPlatform/blob/d93c71f/plans/2026-10-21-portal-SPEC.md",
}

def caption(filename, text):
    src = CAPTION_URLS[filename]
    if not src.startswith("http"):
        return text + " Sumber: " + src
    return text + " Sumber: " + src + "; tangkapan layar 30 Oktober 2026."


def prepare_layout(doc):
    # Jaga baris tabel dan blok tanda tangan tetap utuh pada hasil cetak.
    tables = doc.tables
    for i, table in enumerate(tables):
        for row in table.rows:
            props = row._tr.get_or_add_trPr()
            props.append(OxmlElement("w:cantSplit"))
        if i < len(tables) - 1 and table.rows:
            table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))
    signature = doc.tables[-1]
    paragraphs = [p for row in signature.rows for cell in row.cells for p in cell.paragraphs]
    for p in paragraphs[:-1]:
        p.paragraph_format.keep_with_next = True

def build(doc_meta):
    doc = Document()
    st = doc.styles['Normal']; st.font.name = "Arial"; st.font.size = Pt(11)
    for section in doc.sections:
        section.top_margin = Cm(2.2); section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.5); section.right_margin = Cm(2.2)

    # KOP
    para(doc, "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA", size=12, bold=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    para(doc, "DINAS PARIWISATA DAN EKONOMI KREATIF", size=13, bold=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    para(doc, "Bidang Data, Informasi dan Pengembangan Destinasi", size=10, italic=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY, space_after=2)
    hr = doc.add_paragraph(); hr.paragraph_format.space_after = Pt(10)
    pPr = hr._p.get_or_add_pPr(); pbdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom'); bottom.set(qn('w:val'), 'single'); bottom.set(qn('w:sz'), '12')
    bottom.set(qn('w:space'), '1'); bottom.set(qn('w:color'), '1a1a1a'); pbdr.append(bottom); pPr.append(pbdr)

    para(doc, "LAPORAN PELAKSANAAN TUGAS TENAGA AHLI", size=14, bold=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=1)
    para(doc, "Kegiatan Penyediaan dan Pengelolaan Data Statistik Pariwisata Jakarta — Tahun Anggaran 2026",
         size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY, space_after=10)

    # IDENTITAS
    t = doc.add_table(rows=0, cols=2); set_table_borders(t, color="bfbfbf")
    ident = [
        ("Nama Tenaga Ahli", "[Nama Tenaga Ahli]"),
        ("NIK / No. Kontrak", "[NIK / No. Kontrak]"),
        ("Jabatan / Posisi", doc_meta["jabatan"]),
        ("Kualifikasi", doc_meta["kualifikasi"]),
        ("Periode Laporan", "Bulan ke-5 (Laporan Bulanan Kelima) — Oktober 2026"),
        ("Sub Kegiatan", "Perencanaan Daya Tarik Wisata Provinsi"),
        ("Lokasi", "Provinsi DKI Jakarta"),
    ]
    for k, v in ident:
        row = t.add_row().cells
        cell_text(row[0], k, bold=True, size=10, align=WD_ALIGN_PARAGRAPH.LEFT); set_cell_bg(row[0], "eeeeee")
        cell_text(row[1], v, size=10, align=WD_ALIGN_PARAGRAPH.LEFT)
        row[0].width = Cm(4.8); row[1].width = Cm(10.8)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    heading(doc, "I.  PENDAHULUAN")
    para(doc, PENDAHULUAN_UMUM)
    para(doc, doc_meta["pendahuluan_peran"])

    heading(doc, "II.  URAIAN TUGAS")
    para(doc, "Sesuai Kerangka Acuan Kerja (KAK) kegiatan, uraian tugas untuk posisi ini adalah sebagai berikut:",
         space_after=4)
    bullets(doc, doc_meta["uraian_tugas"], letters=True)

    heading(doc, "III.  PELAKSANAAN PEKERJAAN BULAN INI")
    para(doc, doc_meta["pelaksanaan_intro"])
    realisasi_table(doc, doc_meta["realisasi"])

    heading(doc, "IV.  BUKTI PELAKSANAAN")
    para(doc, doc_meta["bukti_intro"], space_after=6)
    for item in doc_meta["bukti"]:
        kind = item[0]
        if kind == "img":
            add_image(doc, item[1], caption(item[1], item[2]))
        else:
            spec = TABLES[kind]
            para(doc, item[1], bold=True, size=10.5, space_before=4, space_after=3,
                 align=WD_ALIGN_PARAGRAPH.LEFT)
            data_table(doc, spec[0], spec[1], spec[2])
            para(doc, spec[3], size=8.5, italic=True, color=GREY,
                 align=WD_ALIGN_PARAGRAPH.LEFT, space_after=8)

    heading(doc, "V.  RENCANA TINDAK LANJUT — PENGEMBANGAN PLATFORM AI-DATA")
    para(doc, RTL_UMUM)
    para(doc, doc_meta["rtl_peran"])
    for item in doc_meta.get("rtl_bukti", []):
        add_image(doc, item[0], item[1])

    heading(doc, "VI.  PENUTUP")
    para(doc, doc_meta["penutup"])

    # tanda tangan
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    sig = doc.add_table(rows=0, cols=2)
    r = sig.add_row().cells
    cell_text(r[0], "Mengetahui,\nPejabat Pembuat Komitmen", size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r[1], "Jakarta, ......................... 2026\nTenaga Ahli yang bersangkutan",
              size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(4): sig.add_row()
    r = sig.add_row().cells
    cell_text(r[0], "(  Bima Agung  )", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r[1], "(  [Nama Tenaga Ahli]  )", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = sig.add_row().cells
    cell_text(r[0], "NIP. 197907162011011008", size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)
    cell_text(r[1], doc_meta["jabatan"], size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)

    outdir = os.path.join(BASE, "bulan-5")
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, doc_meta["filename"] + ".docx")
    prepare_layout(doc)
    doc.save(out)
    print("wrote", out)

MEMBERS = [
    {
        "filename": "01-PM-Analisis-Data-Dashboard",
        "jabatan": "Project Manager Analisis Data dan Pembangunan Dashboard Pariwisata",
        "kualifikasi": "S2 / setara, pengalaman minimal 5 tahun",
        "uraian_tugas": [
            "Mengelola dan merencanakan SDM yang dibutuhkan untuk kegiatan Analisis Data dan Pembangunan Dashboard Pariwisata, termasuk analisis, desain, pelaksanaan, pengujian/validasi, dan output yang dihasilkan;",
            "Memberikan laporan kegiatan Analisis Data dan Pembangunan Dashboard Pariwisata berupa progres pekerjaan dan pembaruan;",
            "Memastikan kegiatan selesai tepat waktu, sesuai anggaran, memenuhi standar kualitas, dan harapan pemilik program;",
            "Mengelola risiko dan isu pekerjaan, memastikan penyediaan informasi tepat waktu, serta melakukan mitigasi risiko dan langkah eskalasi."
        ],
        "pendahuluan_peran": "Pada bulan kelima, Project Manager mengarahkan pekerjaan dari perluasan dashboard menuju kesiapan platform untuk dipindahkan dan dipakai lebih luas. Prioritas Oktober adalah menindaklanjuti dua rapat progres bersama Dinas, menata katalog data terkonsolidasi, serta menyusun rencana pemindahan portal ke server Kominfo tanpa mengubah angka yang sudah tampil.",
        "pelaksanaan_intro": "Realisasi Oktober ditelusuri dari riwayat perubahan repositori 1–30 Oktober, dokumen rencana kerja portal, dan pemeriksaan halaman publik pada 30 Oktober 2026. Pekerjaan yang masih menunggu keputusan pemilik dinyatakan sebagai menunggu, bukan sebagai capaian.",
        "realisasi": [
            [
                "Perencanaan dan pembagian pekerjaan",
                "Memecah pemindahan portal menjadi rencana kerja bertahap: enam tahap layanan data di repositori ini dan sepuluh tahap aplikasi portal Nuxt + Laravel. Tahap layanan data 01–05 selesai dan digabung pada 26 Oktober; tahap deploy dan aplikasi portal menunggu keputusan pemilik."
            ],
            [
                "Pelaporan progres dan pembaruan",
                "Menindaklanjuti masukan rapat 8 Oktober (grafik dapat diperbesar, keseragaman warna subsektor, perbandingan tahunan wisnus per kota) dan rapat 27 Oktober (filter sumber dan tag pada katalog, perapian dataset penerbangan)."
            ],
            [
                "Pengendalian mutu keluaran",
                "Menetapkan bahwa portal baru harus menghasilkan angka yang sama dengan dashboard saat ini; uji paritas otomatis disiapkan untuk membandingkan keluaran layanan data baru dengan aplikasi yang berjalan."
            ],
            [
                "Pengelolaan risiko pekerjaan",
                "Mencatat ketergantungan pada keputusan repositori portal dan persetujuan deploy layanan data, serta perbedaan periode sumber wisman antara tampilan data bersih dan mart penyaji sebagai risiko yang perlu ditutup pada November."
            ]
        ],
        "bukti_intro": "Bukti berikut menunjukkan katalog data terkonsolidasi yang dapat diperiksa publik, inventaris struktur data pada 30 Oktober, dan dokumen spesifikasi pemindahan portal. Angka inventaris adalah snapshot saat pemeriksaan.",
        "bukti": [
            [
                "img",
                "01-katalog.jpg",
                "Gambar 1. Katalog Data terkonsolidasi: 183 dataset primer dan 47 dataset sekunder dengan filter sumber dan tag."
            ],
            [
                "lake",
                "Inventaris struktur data saat verifikasi:"
            ],
            [
                "img",
                "14-portal-spec.jpg",
                "Gambar 2. Spesifikasi desain pemindahan portal ke server Kominfo (Nuxt + Laravel), disusun 21 Oktober 2026."
            ]
        ],
        "rtl_peran": "Pada November, Project Manager perlu memperoleh keputusan pemilik tentang repositori portal dan persetujuan deploy layanan data, lalu menjadwalkan tahap aplikasi portal. Penyelarasan sumber wisman dan pengujian jawaban asisten AI dimasukkan sebagai syarat sebelum portal baru dipresentasikan.",
        "penutup": "Pekerjaan Oktober menggeser fokus dari menambah tampilan menjadi menyiapkan platform yang dapat dipindahkan dengan angka yang tetap konsisten. Masukan dua rapat telah ditindaklanjuti; keputusan yang masih ditunggu dicatat terbuka agar jadwal November dapat dikendalikan.",
        "rtl_bukti": []
    },
    {
        "filename": "02-Database-Administrator",
        "jabatan": "Tenaga Ahli Database Administrator (Senior)",
        "kualifikasi": "S1 Teknik Informatika/Ilmu Komputer/Sistem Informasi, pengalaman minimal 7 tahun",
        "uraian_tugas": [
            "Merancang struktur basis data statistik pariwisata pada platform Database (logical & physical data model);",
            "Menyusun skema tabel, indeks, constraint, view, dan partisi sesuai kebutuhan analitik;",
            "Melaksanakan loading data hasil pengumpulan, pembersihan, dan validasi ke dalam Database;",
            "Melakukan optimasi kinerja basis data (query tuning, indexing, statistik, partitioning);",
            "Menyusun tata kelola akses dan keamanan basis data (role, privilege, audit trail);",
            "Menyusun pedoman backup, recovery, dan pemeliharaan basis data;",
            "Mendokumentasikan basis data (ERD, kamus tabel, panduan operasional)."
        ],
        "pendahuluan_peran": "Database Administrator memusatkan bulan kelima pada keandalan operasi basis data: pencadangan harian yang benar-benar berjalan, penulisan data mentah yang stabil, serta jalur akses data hanya-baca untuk portal baru. Fokusnya adalah bukti operasi yang tercatat, bukan sekadar konfigurasi.",
        "pelaksanaan_intro": "Realisasi ditelusuri dari riwayat perubahan konfigurasi lake house, catatan run penjadwal Dagster, dan definisi tabel pada gudang data yang dibaca 30 Oktober 2026. Riwayat run sebelum 4 Oktober tidak tersimpan pada penjadwal yang berjalan saat ini sehingga tidak diklaim.",
        "realisasi": [
            [
                "Struktur basis data statistik",
                "Menyiapkan basis data konform terpisah berisi dimensi induk dan fakta kunjungan, dengan kontrak skema tertulis untuk setiap tabel; kolom referensi dibuat tidak boleh kosong agar pencocokan kode konsisten."
            ],
            [
                "Skema dan pemuatan data",
                "Menstabilkan penulisan data mentah format Iceberg dengan kredensial statis dan pemuatan berurutan, serta mencegah metadata Satu Data Jakarta menyusut atau menjadi nol saat sumber mengalami gangguan."
            ],
            [
                "Kinerja dan akses basis data",
                "Membangun layanan data hanya-baca (FastAPI) di atas gudang data tanpa mengubah pengaturan sesi; ekspor CSV/XLSX menetralkan sel yang dapat dibaca sebagai formula. Layanan selesai dibangun 26 Oktober dan belum dideploy."
            ],
            [
                "Pedoman operasi dan pemulihan",
                "Memperbaiki pencadangan inkremental (target stabil dan percobaan ulang ke penyimpanan objek) pada 8 Oktober; sejak 9 Oktober pencadangan harian tercatat berhasil 22 hari. Runbook dan skrip deploy aplikasi dengan pertukaran container dan pembalikan otomatis diperbarui 22 Oktober."
            ],
            [
                "Dokumentasi basis data",
                "Menyajikan inventaris lapisan, isi mart penyaji, dan catatan run beserta kueri sumbernya. Uji pemulihan dari cadangan belum dilakukan dan tetap menjadi agenda."
            ]
        ],
        "bukti_intro": "Tabel berikut berasal dari pembacaan mart penyaji dan riwayat penjadwal pada 30 Oktober 2026. Tangkapan dokumentasi menampilkan versi dokumen pada commit yang disebut di keterangan.",
        "bukti": [
            [
                "mart",
                "Mart penyaji dan jumlah baris saat verifikasi:"
            ],
            [
                "dagster",
                "Catatan run penjadwal selama Oktober:"
            ],
            [
                "img",
                "04-data-api.jpg",
                "Gambar 1. Dokumentasi layanan data hanya-baca untuk portal baru: struktur, pembatasan akses, dan pemisahan kueri per fitur."
            ],
            [
                "img",
                "05-runbook.jpg",
                "Gambar 2. Runbook deploy dengan skrip pertukaran container, verifikasi, dan pembalikan otomatis bila gagal."
            ]
        ],
        "rtl_peran": "DBA perlu melaksanakan uji pemulihan dari cadangan dan mencatat hasilnya, menyempitkan hak akun aplikasi agar sifat hanya-baca tidak bergantung pada satu pengaturan profil, serta menyiapkan container layanan data begitu deploy disetujui.",
        "penutup": "Operasi basis data Oktober lebih dapat dipertanggungjawabkan: pencadangan dan pembaruan harian kini meninggalkan catatan run yang dapat diperiksa. Kemampuan pemulihan baru akan dinyatakan setelah uji pemulihan dilakukan.",
        "rtl_bukti": []
    },
    {
        "filename": "03-MDM-Specialist",
        "jabatan": "Tenaga Ahli Master Data Management (MDM) Specialist (Senior)",
        "kualifikasi": "S1 Sistem Informasi/Teknik Informatika/Ilmu Komputer/Statistik, pengalaman minimal 7 tahun",
        "uraian_tugas": [
            "Mengidentifikasi entitas master data pariwisata Jakarta dan menyusun struktur data master;",
            "Menyusun kebijakan dan prosedur MDM (data ownership, data stewardship, alur perubahan, persetujuan, dan audit);",
            "Melaksanakan pembentukan master data melalui konsolidasi, deduplikasi, verifikasi, dan validasi data dari berbagai sumber;",
            "Menyusun mekanisme pemeliharaan dan pemutakhiran master data secara berkala;",
            "Memastikan integrasi master data ke dalam database dan ketersediaannya bagi Dashboard melalui metadata."
        ],
        "pendahuluan_peran": "MDM Specialist memusatkan bulan kelima pada pembentukan data induk yang menjadi rujukan bersama: wilayah, negara, periode, dan pintu masuk. Tujuannya agar data dari sumber berbeda yang menulis nama dengan cara berbeda tetap terbaca sebagai entitas yang sama.",
        "pelaksanaan_intro": "Pelaksanaan ditelusuri dari kontrak dimensi pada repositori dan pemeriksaan isi lapisan konform pada 30 Oktober 2026. Setiap angka pada tabel berasal dari kueri hitung langsung.",
        "realisasi": [
            [
                "Kebijakan dan standar master data",
                "Menetapkan kode baku: wilayah mengikuti kode Kemendagri, negara mengikuti ISO 3166 ditambah kelompok agregat BPS, dan periode dibentuk pada lima tingkat (hari, bulan, triwulan, semester, tahun)."
            ],
            [
                "Pengelolaan data induk",
                "Membentuk dimensi wilayah 863 entri (38 provinsi, 514 kabupaten/kota, 44 kecamatan dan 267 kelurahan di DKI), dimensi negara 255 entri, dimensi periode 17.675 entri untuk 1990–2035, dan 22 pintu masuk."
            ],
            [
                "Pencocokan dan deduplikasi",
                "Menyusun tabel kunci yang memetakan ejaan sumber ke kode baku (721 kunci negara, 1.621 kunci wilayah) serta tabel kunci ambigu. Fakta wisman per negara, per pintu masuk, dan wisnus per kota seluruhnya mendapat kode; tabel tak cocok berisi 0 baris."
            ],
            [
                "Metadata dan katalog",
                "Menetralkan deskripsi dan catatan dataset untuk publik tanpa mengubah angka, menambahkan kategori sumber (SDI, data internal Dispar, instansi lain, crawling) dan filter tag pada Katalog Data."
            ],
            [
                "Kualitas dan tata kelola",
                "Memantau temuan karantina konversi tipe; pada pembacaan 30 Oktober tercatat 175 kelompok temuan setelah catatan ganda dari run ulang dihitung sekali."
            ]
        ],
        "bukti_intro": "Bukti berikut berasal dari lapisan konform dan tabel karantina yang dibaca pada 30 Oktober 2026. Diagram disusun dari definisi tabel, bukan dari rancangan di luar sistem.",
        "bukti": [
            [
                "konform",
                "Isi dimensi induk dan hasil pencocokan:"
            ],
            [
                "img",
                "06-konform-erd.jpg",
                "Gambar 1. Diagram relasi lapisan konform: dimensi induk, tabel kunci pencocokan, dan fakta kunjungan yang merujuk kode baku."
            ],
            [
                "karantina",
                "Temuan konversi tipe yang dikarantina:"
            ]
        ],
        "rtl_peran": "MDM Specialist perlu menyambungkan dimensi induk ke dataset lain di luar wisman dan wisnus, menyimpan riwayat karantina per tanggal, serta menetapkan aturan agar run ulang tidak menggandakan catatan temuan.",
        "penutup": "Data induk Oktober memberi rujukan kode yang sama bagi wilayah, negara, dan periode. Pencocokan fakta kunjungan sudah lengkap; perluasan ke dataset lain dan riwayat mutu menjadi pekerjaan berikutnya.",
        "rtl_bukti": []
    },
    {
        "filename": "04-BI-Developer-1",
        "jabatan": "Tenaga Ahli BI Developer 1 (Junior)",
        "kualifikasi": "S1 Sistem Informasi/Teknik Informatika/Ilmu Komputer/Statistik, pengalaman minimal 5 tahun",
        "uraian_tugas": [
            "Mengkonfigurasi koneksi Dashboard ke database melalui semantic layer/metadata MDM;",
            "Membangun dashboard interaktif (overview pariwisata, kunjungan wisatawan, akomodasi, destinasi, kontribusi ekonomi, dan dashboard tematik lainnya);",
            "Menyusun visualisasi yang konsisten dengan standar metadata dan definisi data;",
            "Mengatur akses pengguna, jadwal refresh data, dan pemeliharaan dashboard;",
            "Menyusun panduan pemanfaatan dashboard bagi pengguna di lingkungan Dinas."
        ],
        "pendahuluan_peran": "BI Developer pada bulan kelima memusatkan pekerjaan pada kemudahan membaca data: kunjungan per destinasi di dashboard, pembuat grafik yang dapat diurutkan, serta penyaringan di halaman detail dataset. Perubahan diarahkan oleh masukan rapat 8 dan 27 Oktober.",
        "pelaksanaan_intro": "Realisasi diperiksa langsung pada dispar.rantai.dev tanggal 30 Oktober 2026 dan ditelusuri ke perubahan yang tercatat pada Oktober. Angka pada tangkapan layar dicocokkan dengan kueri ke tampilan data bersih yang sama.",
        "realisasi": [
            [
                "Desain dan pengembangan dashboard",
                "Menambahkan bagian Kunjungan ke Destinasi Wisata pada dashboard wisnus dan wisman (26 Oktober), serta tombol perbesar grafik, keseragaman warna subsektor ekraf, dan perbandingan tahunan wisnus per kota sesuai rapat 8 Oktober."
            ],
            [
                "Visualisasi interaktif",
                "Menambahkan pilihan urutan pada pembuat grafik (22 Oktober), menyimpan grafik buatan pengguna per dataset di peramban (12 Oktober), dan menghentikan grafik bawaan yang menyesatkan pada halaman detail dataset."
            ],
            [
                "Penyaringan dan penelusuran data",
                "Menambahkan filter dan pengurutan kolom pada halaman detail dataset (19 Oktober), filter sumber dan tag pada Katalog Data (27 Oktober), serta menampilkan periode data pada detail dataset Satu Data Jakarta."
            ],
            [
                "Konsistensi tampilan",
                "Menyatukan peta Spatial dengan direktori wisata dan memindahkan direktori ke halaman indikator terkait (5 Oktober); tampilan desktop dan ponsel diperiksa tanpa gulir horizontal."
            ]
        ],
        "bukti_intro": "Tangkapan layar berikut diambil dari sistem publik pada 30 Oktober 2026. Angka kunjungan wisnus ke destinasi 2025 sebesar 29.970.834 sama dengan hasil kueri langsung ke tampilan data bersih.",
        "bukti": [
            [
                "img",
                "02-wisnus-destinasi.jpg",
                "Gambar 1. Kunjungan wisatawan nusantara ke destinasi wisata: total 2025, destinasi yang melapor, dan sebaran per destinasi."
            ],
            [
                "img",
                "07-chart-builder.jpg",
                "Gambar 2. Pembuat grafik pada detail dataset dengan pilihan urutan nilai; grafik tersimpan di peramban pengguna."
            ],
            [
                "img",
                "01-katalog.jpg",
                "Gambar 3. Katalog Data dengan filter lapisan, sumber, dan tag."
            ]
        ],
        "rtl_peran": "BI Developer perlu memastikan dashboard wisman memakai satu sumber periode yang sama dengan tampilan data bersih, menguji kembali tampilan setelah portal baru tersedia, dan menambahkan keterangan bila destinasi tidak melapor pada bulan tertentu.",
        "penutup": "Tampilan Oktober membuat data lebih mudah ditelusuri sampai ke destinasi dan baris sumbernya. Perubahan mengikuti masukan rapat dan telah diperiksa pada sistem yang berjalan.",
        "rtl_bukti": []
    },
    {
        "filename": "05-Data-Engineer-2",
        "jabatan": "Tenaga Ahli Data Engineer 2 (Junior)",
        "kualifikasi": "S1 Teknik Informatika/Ilmu Komputer/Sistem Informasi, pengalaman minimal 6 tahun",
        "uraian_tugas": [
            "Merancang dan melaksanakan pipeline pengumpulan dan integrasi data (ETL/ELT) dari berbagai sumber ke dalam Database;",
            "Membersihkan, mentransformasi, dan menstandarisasi raw data agar siap digunakan untuk analisis dan visualisasi;",
            "Memastikan integrasi data multi-sumber dilakukan dengan menjaga kualitas dan keterlacakan data;",
            "Menerapkan standar metadata dan master data dalam proses integrasi data;",
            "Menjamin keamanan data dan kepatuhan terhadap tata kelola data pada proses integrasi."
        ],
        "pendahuluan_peran": "Data Engineer menitikberatkan bulan kelima pada jalur pemuatan yang berulang secara otomatis dan penambahan dua belas dataset baru. Seluruh sumber kini didaftarkan dalam satu registri dan dimuat oleh job harian, sehingga data tidak lagi bergantung pada pemuatan manual.",
        "pelaksanaan_intro": "Pelaksanaan ditelusuri dari riwayat perubahan pipeline dan dataset 1–30 Oktober, catatan run penjadwal Dagster, serta jumlah baris tabel bersih yang dibaca 30 Oktober 2026.",
        "realisasi": [
            [
                "Pipeline pengumpulan dan integrasi",
                "Menyusun registri sumber data mentah (110 sumber terdaftar dan 23 berkas yang sengaja tidak dimuat) dan memuat berkas serta data sekunder dari registri itu secara bertahap menurut sidik isi berkas; job pembaruan harian berhasil pada 27 hari antara 4 dan 30 Oktober."
            ],
            [
                "Pembersihan dan standardisasi",
                "Memperbaiki pembacaan titik desimal pada kolom koordinat, mengoreksi 19 titik peta di Kepulauan Seribu, menjaga kolom NIB dan KBLI tetap teks, serta menghapus hitungan ganda pada dataset venue dan kegiatan MICE."
            ],
            [
                "Integrasi multi-sumber",
                "Menambahkan dua belas dataset: penerbangan langsung internasional dan domestik, venue dan kegiatan MICE 2026, Hotel MICHELIN Key 2026, lokasi syuting film, museum, jalur hijau, hutan kota, taman, serta hotel dan usaha hiburan per kota."
            ],
            [
                "Metadata dan ketertelusuran",
                "Setiap baris data sekunder membawa tautan sumber; data hotel dan hiburan per kota diverifikasi sel demi sel terhadap berkas asli (12.255 sel identik) sebelum dimuat."
            ],
            [
                "Keamanan dan tata kelola",
                "Data dibangun ke dalam image penjadwal dari commit tertentu sehingga isi yang dimuat dapat ditelusuri ke versi repositori; kontak usaha pada data hotel dan hiburan ditampilkan atas permintaan Dinas."
            ]
        ],
        "bukti_intro": "Tabel jumlah baris dan catatan run diambil pada 30 Oktober 2026. Tangkapan layar menunjukkan dataset baru pada aplikasi; grafik bawaan halaman disembunyikan agar judul, keterangan sumber, dan tabel terbaca utuh.",
        "bukti": [
            [
                "baru",
                "Dataset baru Oktober dan jumlah baris tabel bersih:"
            ],
            [
                "qual",
                "Catatan pengolahan data selama Oktober:"
            ],
            [
                "img",
                "09-penerbangan.jpg",
                "Gambar 1. Dataset penerbangan langsung internasional ke Jakarta dengan kode maskapai dan bandara."
            ],
            [
                "img",
                "10-kegiatan-mice.jpg",
                "Gambar 2. Dataset kegiatan di venue MICE 2026 dengan tautan sumber per acara."
            ],
            [
                "img",
                "11-hotel-per-kota.jpg",
                "Gambar 3. Dataset hotel per kota DKI Jakarta setelah dipisah dari berkas Excel multi-sheet."
            ],
            [
                "img",
                "03-dagster-runs.jpg",
                "Gambar 4. Riwayat run penjadwal: pembaruan lake house dan pencadangan harian."
            ]
        ],
        "rtl_peran": "Data Engineer perlu menyelaraskan tampilan data bersih wisman per bulan dengan sumber mart yang sudah berisi data sampai Juli 2026, mencegah run ulang menggandakan catatan mutu, dan menambahkan dataset hiburan per kota ke halaman indikator terkait.",
        "penutup": "Pemuatan data Oktober bergeser dari langkah manual ke registri dan job harian yang tercatat. Dua belas dataset baru tersedia di katalog; selisih periode sumber wisman dan duplikasi catatan mutu menjadi tindak lanjut.",
        "rtl_bukti": []
    },
    {
        "filename": "06-Data-Analyst",
        "jabatan": "Tenaga Ahli Data Analyst (Intermediate)",
        "kualifikasi": "S1 Sistem Informasi/Teknik Informatika/Ilmu Komputer/Statistik, pengalaman minimal 6 tahun",
        "uraian_tugas": [
            "Menyiapkan dataset untuk pelaporan dan visualisasi sesuai kebutuhan Dinas;",
            "Menyusun laporan rutin (bulanan, triwulanan, tahunan) dan laporan ad-hoc yang relevan;",
            "Memastikan kualitas dan keakuratan data yang disajikan pada antarmuka pelaporan dan dashboard;",
            "Berkolaborasi dengan pengguna data untuk memvalidasi kebutuhan informasi."
        ],
        "pendahuluan_peran": "Data Analyst memusatkan bulan kelima pada ketepatan angka yang disajikan: rekap indikator dengan periode eksplisit, angka kunjungan destinasi yang baru tampil, dan pengujian pertama terhadap jawaban asisten AI Jekate.",
        "pelaksanaan_intro": "Rekap disusun dari kueri ke sumber yang sama dengan dashboard. Satu pertanyaan uji diajukan kepada Jekate pada 30 Oktober 2026 dan jawabannya dibandingkan dengan kueri langsung.",
        "realisasi": [
            [
                "Dataset pelaporan dan visualisasi",
                "Menyiapkan pembacaan kunjungan ke destinasi wisata per bulan menurut jenis wisatawan; data tersedia sampai Agustus 2026 untuk 29 destinasi wisnus pada 2025."
            ],
            [
                "Laporan indikator rutin",
                "Menyajikan rekap wisman 2025 dan Januari–Juli 2026, perjalanan wisnus menurut kota tujuan, kunjungan destinasi, dan tenaga kerja ekonomi kreatif dengan tahun data yang dinyatakan."
            ],
            [
                "Ketepatan dan kualitas angka",
                "Mencatat bahwa sumber wisman belum seragam: mart penyaji berisi data sampai Juli 2026, sedangkan tampilan data bersih wisman per bulan berhenti di April 2026. Rekap memakai sumber yang sama dengan dashboard."
            ],
            [
                "Validasi keluaran asisten AI",
                "Menguji Jekate dengan pertanyaan total wisman 2025 dan lima negara asal terbesar; total 2.754.220 dan kelima angka negara sama dengan kueri langsung. Jawaban memuat kalimat koreksi diri yang perlu dirapikan."
            ],
            [
                "Paritas angka layanan data",
                "Menyiapkan pembanding otomatis (golden) antara keluaran layanan data baru dan aplikasi yang berjalan agar angka portal baru dapat diperiksa sebelum dipakai."
            ]
        ],
        "bukti_intro": "Tabel rekap dan uji AI memuat kueri sumber yang dibaca pada 30 Oktober 2026. Angka indikator bukan realisasi bulan Oktober 2026.",
        "bukti": [
            [
                "wis",
                "Rekap indikator terpilih dengan periode eksplisit:"
            ],
            [
                "jekate",
                "Uji jawaban asisten AI terhadap kueri langsung:"
            ],
            [
                "img",
                "08-jekate-jawaban.jpg",
                "Gambar 1. Jawaban Jekate atas pertanyaan uji, lengkap dengan grafik, tabel, dan sumber tabel yang dibaca."
            ],
            [
                "img",
                "02-wisnus-destinasi.jpg",
                "Gambar 2. Rekap kunjungan wisnus ke destinasi wisata 2025 pada dashboard."
            ]
        ],
        "rtl_peran": "Data Analyst perlu memperluas uji Jekate menjadi satu set pertanyaan terukur, mencatat pertanyaan yang gagal, dan memastikan rekap wisman memakai satu sumber setelah tampilan data bersih diselaraskan.",
        "penutup": "Angka Oktober yang dilaporkan dapat ditelusuri ke kueri sumbernya. Uji pertama asisten AI memberi hasil yang cocok; satu uji belum cukup untuk menyatakan keandalan, sehingga pengujian diperluas pada November.",
        "rtl_bukti": []
    },
    {
        "filename": "07-Business-Analyst-1",
        "jabatan": "Tenaga Ahli Business Analyst 1 (Intermediate)",
        "kualifikasi": "S1 Sistem Informasi/Teknik Informatika/Ilmu Komputer/Manajemen/Statistik, pengalaman minimal 6 tahun",
        "uraian_tugas": [
            "Melakukan pemetaan kondisi tata kelola data pariwisata saat ini (as-is) melalui wawancara, observasi, dan analisis dokumen;",
            "Merumuskan kondisi tata kelola data yang dituju (to-be) bersama pemangku kepentingan;",
            "Menyusun gap analysis as-is vs to-be beserta rekomendasi pemenuhan;",
            "Menerjemahkan kebutuhan bisnis menjadi spesifikasi tata kelola data (standar data, metadata, kebijakan MDM, kebijakan akses);",
            "Mendokumentasikan requirement, alur proses, dan use case pengelolaan data pariwisata;",
            "Berkoordinasi dengan pemangku kepentingan internal dan eksternal Dinas;",
            "Mendukung penyusunan roadmap dan rencana implementasi standarisasi data."
        ],
        "pendahuluan_peran": "Business Analyst pada bulan kelima menerjemahkan kebutuhan Dinas menjadi spesifikasi yang dapat dikerjakan: pemindahan portal ke server Kominfo, publikasi data hotel dan usaha hiburan per kota, serta data pendukung pariwisata MICE dan film.",
        "pelaksanaan_intro": "Kebutuhan ditelusuri dari dokumen spesifikasi portal, catatan tindak lanjut rapat 8 dan 27 Oktober, serta dataset yang tayang pada 30 Oktober 2026.",
        "realisasi": [
            [
                "Analisis kebutuhan bisnis",
                "Menyusun spesifikasi pemindahan portal (21 Oktober): backend Laravel dan frontend Nuxt di server Kominfo, data tetap dari lake house, dan ketentuan paritas angka dengan dashboard saat ini."
            ],
            [
                "Pemetaan proses dan data",
                "Memetakan kebutuhan Dinas atas berkas hotel dan hiburan per kota (sepuluh sheet) menjadi dua dataset publik: hotel 236 baris dan hiburan 581 baris, termasuk kontak usaha sesuai permintaan."
            ],
            [
                "Kebutuhan data pendukung indikator",
                "Mengarahkan pengumpulan Hotel MICHELIN Key 2026, kegiatan dan venue MICE, serta lokasi syuting film sebagai data pendukung daya tarik dan pariwisata film."
            ],
            [
                "Bahasa dan teks publik",
                "Menetapkan agar deskripsi dataset dan nama kolom di halaman publik memakai bahasa umum, tanpa catatan proses riset internal."
            ]
        ],
        "bukti_intro": "Tangkapan berikut menunjukkan dokumen spesifikasi dan dataset hasil kebutuhan bisnis yang tayang pada 30 Oktober 2026.",
        "bukti": [
            [
                "img",
                "14-portal-spec.jpg",
                "Gambar 1. Spesifikasi pemindahan portal: tujuan, batas cakupan, dan syarat dari Dinas."
            ],
            [
                "img",
                "12-michelin.jpg",
                "Gambar 2. Dataset Hotel MICHELIN Key Indonesia 2026, termasuk tujuh hotel di DKI Jakarta."
            ],
            [
                "img",
                "13-syuting.jpg",
                "Gambar 3. Dataset lokasi syuting film di DKI Jakarta dengan sumber dan tingkat keyakinan per baris."
            ]
        ],
        "rtl_peran": "Business Analyst perlu memperoleh keputusan pemilik tentang repositori portal, mengonfirmasi arti kolom (L)/(P)/(A) pada berkas hiburan per kota yang belum dijelaskan pemilik data, dan menyusun kebutuhan pengguna untuk uji penerimaan portal.",
        "penutup": "Kebutuhan Oktober telah diterjemahkan menjadi spesifikasi portal dan dataset yang dapat dibuka publik. Keputusan yang masih ditunggu dari pemilik dicatat agar tidak menghambat tahap berikutnya.",
        "rtl_bukti": []
    }
]


def kop(doc, judul, subjudul):
    para(doc, "PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA", size=12, bold=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    para(doc, "DINAS PARIWISATA DAN EKONOMI KREATIF", size=13, bold=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    para(doc, "Bidang Data, Informasi dan Pengembangan Destinasi", size=10, italic=True,
         align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY, space_after=2)
    hr = doc.add_paragraph(); hr.paragraph_format.space_after = Pt(10)
    pPr = hr._p.get_or_add_pPr(); pbdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom'); bottom.set(qn('w:val'), 'single'); bottom.set(qn('w:sz'), '12')
    bottom.set(qn('w:space'), '1'); bottom.set(qn('w:color'), '1a1a1a'); pbdr.append(bottom); pPr.append(pbdr)
    para(doc, judul, size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=1)
    para(doc, subjudul, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY, space_after=10)


CAPAIAN_HEADER = ["Keluaran Oktober", "Wujud dan bukti", "Status"]
CAPAIAN_ROWS = [
    [
        "Pemuatan data harian berbasis registri",
        "110 sumber terdaftar dimuat bertahap menurut sidik isi berkas; pembaruan lake house berhasil 27 hari (4–30 Oktober)",
        "Berjalan; catatan run Q12"
    ],
    [
        "Pencadangan harian",
        "Perbaikan pencadangan inkremental 8 Oktober; pencadangan berhasil setiap hari sejak 9 Oktober (22 hari)",
        "Berjalan; uji pemulihan belum dilakukan"
    ],
    [
        "Data induk (lapisan konform)",
        "Dimensi wilayah Kemendagri, negara ISO 3166, periode multi-tingkat, pintu masuk; fakta wisman dan wisnus seluruhnya mendapat kode",
        "Terverifikasi Q10; tak cocok 0 baris"
    ],
    [
        "Dua belas dataset baru",
        "Penerbangan langsung, MICE, MICHELIN Key, lokasi syuting film, museum, ruang hijau, hotel dan hiburan per kota",
        "Tayang di katalog; jumlah baris Q11"
    ],
    [
        "Katalog Data terkonsolidasi",
        "183 dataset primer dan 47 sekunder dengan filter sumber dan tag (tindak lanjut rapat 27 Oktober)",
        "Tersedia pada sistem publik"
    ],
    [
        "Dashboard dan penelusuran data",
        "Kunjungan ke destinasi wisata, grafik dapat diperbesar, YoY wisnus per kota, filter dan urutan pada detail dataset",
        "Tersedia pada sistem publik"
    ],
    [
        "Asisten AI Jekate",
        "Mode tanya-jawab dan ringkasan BI, hanya-baca; satu pertanyaan uji cocok dengan kueri langsung",
        "Tersedia; uji masih terbatas"
    ],
    [
        "Layanan data untuk portal baru",
        "Layanan hanya-baca FastAPI dengan kontrak OpenAPI dan pembanding paritas angka; digabung 26 Oktober",
        "Selesai dibangun; belum dideploy"
    ],
    [
        "Spesifikasi pemindahan portal",
        "Spesifikasi, kontrak, dan rencana kerja portal Nuxt + Laravel di server Kominfo (21 Oktober)",
        "Tahap aplikasi portal menunggu keputusan repositori"
    ]
]
CAPAIAN_WIDTHS = [4.2, 8.0, 3.4]
KENDALA_HEADER = ["Kendala / risiko", "Dampak", "Tindakan dan mitigasi"]
KENDALA_ROWS = [
    [
        "Sumber wisman belum seragam",
        "Mart penyaji berisi data sampai Juli 2026, tampilan data bersih wisman per bulan berhenti di April 2026",
        "Rekap memakai sumber dashboard; selaraskan tampilan data bersih dengan mart dan nyatakan sumber pada setiap angka."
    ],
    [
        "Deploy dan keputusan tertunda",
        "Layanan data dan aplikasi portal belum dapat dipakai sebelum persetujuan deploy dan keputusan repositori",
        "Ajukan keputusan kepada pemilik pada awal November; jadwal portal mengikuti keputusan tertulis."
    ],
    [
        "Run ulang menggandakan catatan mutu",
        "Catatan karantina 30 Oktober tercatat empat kali; riwayat per tanggal tidak tersimpan",
        "Hitung tiap temuan sekali dalam laporan; ubah penulisan agar run ulang menimpa, dan simpan riwayat per tanggal."
    ],
    [
        "Bukti operasi belum lengkap",
        "Riwayat penjadwal baru tersedia sejak 4 Oktober; pemulihan dari cadangan belum diuji",
        "Laksanakan uji pemulihan terdokumentasi; jangan menyimpulkan kemampuan pemulihan dari keberhasilan pencadangan."
    ],
    [
        "Keandalan jawaban AI",
        "Baru satu pertanyaan diuji; jawaban memuat kalimat koreksi diri",
        "Susun set pertanyaan uji dengan jawaban kueri sebagai pembanding; catat yang gagal."
    ],
    [
        "Rincian data yang belum tersedia",
        "Lama menginap non-bintang, PDRB per wilayah, dan tenaga kerja per subsektor DKI: tidak ada penambahan yang tercatat pada riwayat Oktober",
        "Lanjutkan permintaan kepada pemilik data; tampilkan status menunggu data tanpa mengganti dengan data nasional."
    ]
]
KENDALA_WIDTHS = [3.8, 5.0, 6.8]
RENCANA_HEADER = ["Rencana November 2026", "Sasaran"]
RENCANA_ROWS = [
    [
        "Deploy layanan data dan keputusan repositori portal",
        "Layanan data berjalan di server dengan akun hanya-baca; tahap aplikasi portal dapat dimulai."
    ],
    [
        "Penyelarasan sumber wisman",
        "Tampilan data bersih dan mart penyaji memuat periode yang sama; satu sumber untuk dashboard dan laporan."
    ],
    [
        "Riwayat mutu per tanggal",
        "Karantina dan hasil gerbang mutu tidak berlipat saat run ulang dan dapat dibaca per tanggal."
    ],
    [
        "Uji pemulihan cadangan",
        "Pemulihan dari cadangan dilakukan pada lingkungan uji dan hasilnya dicatat."
    ],
    [
        "Uji terukur asisten Jekate",
        "Set pertanyaan uji dengan jawaban kueri sebagai pembanding; tingkat kecocokan dilaporkan."
    ],
    [
        "Perluasan data induk",
        "Dimensi wilayah dan periode dipakai oleh dataset di luar wisman dan wisnus."
    ]
]
RENCANA_WIDTHS = [7.8, 7.8]
LAMPIRAN_HEADER = ["No.", "Posisi tenaga ahli", "Berkas Oktober 2026"]
LAMPIRAN_ROWS = [[str(i), m["jabatan"], m["filename"] + ".docx / .pdf"] for i, m in enumerate(MEMBERS, 1)]
LAMPIRAN_WIDTHS = [1.0, 8.0, 6.6]
BUKTI_UTAMA = [
    ("01-katalog.jpg", "Gambar 1. Katalog Data terkonsolidasi dengan filter sumber dan tag."),
    ("02-wisnus-destinasi.jpg", "Gambar 2. Kunjungan wisatawan nusantara ke destinasi wisata pada dashboard."),
    ("07-chart-builder.jpg", "Gambar 3. Pembuat grafik dengan pilihan urutan pada detail dataset."),
    ("08-jekate-jawaban.jpg", "Gambar 4. Jawaban asisten Jekate atas pertanyaan uji, cocok dengan kueri langsung."),
    ("06-konform-erd.jpg", "Gambar 5. Diagram relasi lapisan konform: dimensi induk dan fakta kunjungan."),
    ("03-dagster-runs.jpg", "Gambar 6. Riwayat run pembaruan lake house dan pencadangan harian."),
    ("09-penerbangan.jpg", "Gambar 7. Dataset baru: penerbangan langsung internasional ke Jakarta."),
    ("10-kegiatan-mice.jpg", "Gambar 8. Dataset baru: kegiatan di venue MICE 2026."),
    ("11-hotel-per-kota.jpg", "Gambar 9. Dataset baru: hotel per kota DKI Jakarta."),
    ("12-michelin.jpg", "Gambar 10. Dataset baru: Hotel MICHELIN Key Indonesia 2026."),
    ("13-syuting.jpg", "Gambar 11. Dataset baru: lokasi syuting film di DKI Jakarta."),
    ("04-data-api.jpg", "Gambar 12. Dokumentasi layanan data hanya-baca untuk portal baru (belum dideploy)."),
    ("14-portal-spec.jpg", "Gambar 13. Spesifikasi pemindahan portal ke server Kominfo."),
]


def build_utama():
    """Laporan utama (payung) kegiatan bulan ke-5 — merangkum tujuh laporan tenaga ahli."""
    doc = Document()
    st = doc.styles['Normal']; st.font.name = "Arial"; st.font.size = Pt(11)
    for section in doc.sections:
        section.top_margin = Cm(2.2); section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.5); section.right_margin = Cm(2.2)

    kop(doc,
        "LAPORAN BULANAN KEGIATAN",
        "Penyediaan dan Pengelolaan Data Statistik Pariwisata Jakarta — Tahun Anggaran 2026")

    t = doc.add_table(rows=0, cols=2); set_table_borders(t, color="bfbfbf")
    ident = [
        ("Periode Laporan", "Bulan ke-5 (Oktober 2026)"),
        ("Kegiatan", "Analisis Data dan Pembangunan Dashboard Pariwisata"),
        ("Sub Kegiatan", "Perencanaan Daya Tarik Wisata Provinsi"),
        ("Lokasi", "Provinsi DKI Jakarta"),
        ("Jumlah Tenaga Ahli", "7 (tujuh) orang — laporan per orang terlampir"),
        ("Tanggal Verifikasi Angka", "30 Oktober 2026; riwayat mutu dan run dibatasi 1–30 Oktober"),
    ]
    for k, v in ident:
        row = t.add_row().cells
        cell_text(row[0], k, bold=True, size=10, align=WD_ALIGN_PARAGRAPH.LEFT); set_cell_bg(row[0], "eeeeee")
        cell_text(row[1], v, size=10, align=WD_ALIGN_PARAGRAPH.LEFT)
        row[0].width = Cm(4.8); row[1].width = Cm(10.8)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


    heading(doc, "I.  RINGKASAN EKSEKUTIF")
    para(doc, PENDAHULUAN_UMUM)
    para(doc, "Inti capaian Oktober adalah keandalan dan kesiapan pindah: data dimuat otomatis setiap hari dari satu registri, pencadangan berjalan harian, data induk wilayah, negara, dan periode terbentuk, serta layanan data untuk portal baru selesai dibangun. Pekerjaan yang masih menunggu keputusan atau belum diuji dinyatakan terbuka, sehingga capaian tidak ditafsirkan melebihi buktinya.")

    heading(doc, "II.  CAPAIAN BULAN INI")
    para(doc, "Capaian berikut ditelusuri dari perubahan repositori selama Oktober dan diperiksa pada sistem yang berjalan tanggal 30 Oktober 2026.")
    data_table(doc, CAPAIAN_HEADER, CAPAIAN_ROWS, CAPAIAN_WIDTHS)
    para(doc, "Sumber pekerjaan: riwayat Git 1–30 Oktober 2026 WIB; plans/2026-10-21-portal-SPEC.md dan handoff portal; docs/DEPLOY-RUNBOOK.md; riwayat run Dagster. Bukti layar merujuk URL pada setiap caption.", size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)

    heading(doc, "III.  STRUKTUR DATA YANG DIBANGUN")
    para(doc, "Lake house tiga lapis memisahkan data mentah, data bersih, dan mart penyaji; pada Oktober ditambah lapisan konform berisi data induk. Inventaris berikut merupakan keadaan saat verifikasi 30 Oktober 2026.")
    data_table(doc, LAKE_HEADER, LAKE_ROWS, LAKE_WIDTHS)
    para(doc, TABLES["lake"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(doc, "Mart penyaji yang tersedia:", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
    data_table(doc, MART_HEADER, MART_ROWS, MART_WIDTHS)
    para(doc, TABLES["mart"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(doc, "Data induk dan fakta pada lapisan konform:", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
    data_table(doc, KONFORM_HEADER, KONFORM_ROWS, KONFORM_WIDTHS)
    para(doc, TABLES["konform"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)

    heading(doc, "IV.  PENJAMINAN MUTU DATA")
    para(doc, "Gerbang mutu harian, riwayat jumlah baris, dan catatan run penjadwal selama Oktober dapat dibaca kembali. Hasil pemeriksaan gagal tetap dicatat; keberadaan catatan bukan bukti semua data sudah layak.")
    data_table(doc, QUAL_HEADER, QUAL_ROWS, QUAL_WIDTHS)
    para(doc, TABLES["qual"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    data_table(doc, KARANTINA_HEADER, KARANTINA_ROWS, KARANTINA_WIDTHS)
    para(doc, TABLES["karantina"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    data_table(doc, DAGSTER_HEADER, DAGSTER_ROWS, DAGSTER_WIDTHS)
    para(doc, TABLES["dagster"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)

    heading(doc, "V.  BUKTI PELAKSANAAN")
    para(doc, "Tangkapan layar diambil pada 30 Oktober 2026 dari sistem yang berjalan dan dari dokumen pada commit yang disebut. Pada halaman dataset, grafik bawaan disembunyikan agar judul, sumber, dan tabel terbaca utuh. Tahun dan angka di dalam gambar mengikuti keterangan sumber pada halaman.")
    for filename, text in BUKTI_UTAMA:
        add_image(doc, filename, caption(filename, text))

    heading(doc, "VI.  REKAP INDIKATOR TERPILIH")
    para(doc, "Rekap berikut berasal dari sumber yang sama dengan dashboard. Data tahunan dan tahun berjalan dipisahkan; jumlah perjalanan dan kunjungan bukan jumlah wisatawan unik.")
    data_table(doc, WIS_HEADER, WIS_ROWS, WIS_WIDTHS)
    para(doc, TABLES["wis"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(doc, "Uji jawaban asisten AI terhadap kueri langsung:", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
    data_table(doc, JEKATE_HEADER, JEKATE_ROWS, JEKATE_WIDTHS)
    para(doc, TABLES["jekate"][3], size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)
    para(doc, "Kueri lengkap dan hasil pemeriksaan tersimpan dalam verifikasi-bulan5.json. Q1 = inventory; Q2 = marts; Q3 = quality_last_full_day dan quality_october_cumulative; Q4 = rowcount_history; Q5 = quarantine; Q6–Q9 = indicators menurut urutan; Q10 = konform; Q11 = new_datasets_october; Q12 = dagster; Q13 = web.jekate_test.", size=8.5, italic=True, color=GREY, align=WD_ALIGN_PARAGRAPH.LEFT)

    heading(doc, "VII.  KENDALA, RISIKO, DAN MITIGASI")
    data_table(doc, KENDALA_HEADER, KENDALA_ROWS, KENDALA_WIDTHS)

    heading(doc, "VIII.  RENCANA BULAN BERIKUTNYA")
    para(doc, RTL_UMUM)
    data_table(doc, RENCANA_HEADER, RENCANA_ROWS, RENCANA_WIDTHS)

    heading(doc, "IX.  PENUTUP")
    para(doc, "Pekerjaan bulan kelima membuat platform lebih andal dan siap dipindahkan: pemuatan dan pencadangan harian tercatat, data induk terbentuk, dua belas dataset ditambahkan, dan layanan data portal selesai dibangun. Angka dalam laporan diperiksa pada 30 Oktober 2026 dengan periode sumber yang dinyatakan. Deploy yang menunggu persetujuan, uji pemulihan, dan uji jawaban AI yang lebih luas menjadi agenda November.")

    heading(doc, "LAMPIRAN — LAPORAN PELAKSANAAN TUGAS TENAGA AHLI")
    para(doc, "Tujuh laporan tenaga ahli untuk bulan ke-5 Oktober 2026 disertakan dalam direktori bulan-5, masing-masing dalam format DOCX dan PDF.")
    data_table(doc, LAMPIRAN_HEADER, LAMPIRAN_ROWS, LAMPIRAN_WIDTHS)
    # tanda tangan
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    sig = doc.add_table(rows=0, cols=2)
    r = sig.add_row().cells
    cell_text(r[0], "Mengetahui,\nPejabat Pembuat Komitmen", size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r[1], "Jakarta, ......................... 2026\nProject Manager Kegiatan",
              size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(4): sig.add_row()
    r = sig.add_row().cells
    cell_text(r[0], "(  Bima Agung  )", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r[1], "(  [Nama Project Manager]  )", bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    r = sig.add_row().cells
    cell_text(r[0], "NIP. 197907162011011008", size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)
    cell_text(r[1], "Project Manager Analisis Data dan Pembangunan Dashboard Pariwisata",
              size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, color=GREY)

    outdir = os.path.join(BASE, "bulan-5")
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "00-Laporan-Utama-Bulan-5.docx")
    prepare_layout(doc)
    doc.save(out)
    print("wrote", out)

if __name__ == "__main__":
    build_utama()
    for m in MEMBERS:
        build(m)
    print("done: 1 laporan utama +", len(MEMBERS), "laporan tenaga ahli")
