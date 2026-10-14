#!/usr/bin/env python3
"""Pembangun berkas referensi negara ISO 3166-1 dan kamus alias ejaan BPS/SDI.

Sumber data primer:
1. ISO 3166-1 country codes (datasets/country-codes)
2. Unicode CLDR Indonesian locale display names (cldr-localenames-full)
3. silver.dim_negara (10-dim.sql) untuk menjaga konsistensi dimensi sebelumnya
"""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "referensi"

DIM10_EXACT = {
    "USA": ("Amerika Serikat", "Amerika"),
    "AUS": ("Australia", "Oseania"),
    "BHR": ("Bahrain", "Timur Tengah"),
    "NLD": ("Belanda", "Eropa"),
    "CHN": ("Tiongkok", "Asia"),
    "HKG": ("Hong Kong", "Asia"),
    "IND": ("India", "Asia"),
    "GBR": ("Inggris", "Eropa"),
    "JPN": ("Jepang", "Asia"),
    "DEU": ("Jerman", "Eropa"),
    "KOR": ("Korea Selatan", "Asia"),
    "MYS": ("Malaysia", "Asia"),
    "EGY": ("Mesir", "Afrika"),
    "FRA": ("Perancis", "Eropa"),
    "PHL": ("Filipina", "Asia"),
    "RUS": ("Rusia", "Eropa"),
    "SAU": ("Arab Saudi", "Timur Tengah"),
    "SGP": ("Singapura", "Asia"),
    "TWN": ("Taiwan", "Asia"),
    "THA": ("Thailand", "Asia"),
    "ARE": ("Uni Emirat Arab", "Timur Tengah"),
    "XCR": ("Crew (WNA)", "Lainnya"),
    "XXX": ("Lainnya", "Lainnya"),
}

TIMUR_TENGAH_CODES = {
    "SAU", "ARE", "BHR", "KWT", "QAT", "OMN", "YEM",
    "IRQ", "IRN", "JOR", "LBN", "SYR", "ISR", "PSE",
}

REGION_MAP = {
    "Africa": "Afrika",
    "Americas": "Amerika",
    "Asia": "Asia",
    "Europe": "Eropa",
    "Oceania": "Oseania",
}

VARIAN_10_DIM = [
    (["amerika serikat", "amerika", "usa", "united states", "as"], "USA"),
    (["australia"], "AUS"),
    (["bahrain"], "BHR"),
    (["belanda", "netherlands"], "NLD"),
    (["china", "cina", "tiongkok", "rrt", "rep rakyat tiongkok", "republik rakyat tiongkok"], "CHN"),
    (["hongkong", "hong kong"], "HKG"),
    (["india"], "IND"),
    (["inggris", "united kingdom", "uk", "britania raya"], "GBR"),
    (["jepang", "japan"], "JPN"),
    (["jerman", "germany"], "DEU"),
    (["korea selatan", "korsel", "south korea", "korea"], "KOR"),
    (["malaysia"], "MYS"),
    (["mesir", "egypt"], "EGY"),
    (["perancis", "prancis", "france"], "FRA"),
    (["philipina", "filipina", "philippines", "pilipina"], "PHL"),
    (["rusia", "russia"], "RUS"),
    (["saudi arabia", "arab saudi", "saudi"], "SAU"),
    (["singapura", "singapore"], "SGP"),
    (["taiwan"], "TWN"),
    (["thailand"], "THA"),
    (["uni emirat arab", "uea", "uae", "emirat arab"], "ARE"),
    (["crew wna", "crew", "awak kapal wna"], "XCR"),
    (["lainnya", "others", "other", "dan lain lain", "dll"], "XXX"),
]

EXTRA_ALIASES = [
    ("swiss", "CHE"),
    ("hongaria", "HUN"),
    ("hungaray", "HUN"),
    ("srilangka", "LKA"),
    ("sri lanka", "LKA"),
    ("brunei", "BRN"),
    ("brunei darussalam", "BRN"),
    ("brunei darusalam", "BRN"),
    ("brunai darusalam", "BRN"),
    ("yordania", "JOR"),
    ("jordania", "JOR"),
    ("lebanon", "LBN"),
    ("libanon", "LBN"),
    ("suriah", "SYR"),
    ("palestina", "PSE"),
    ("israel", "ISR"),
    ("kuwait", "KWT"),
    ("qatar", "QAT"),
    ("oman", "OMN"),
    ("yaman", "YEM"),
    ("irak", "IRQ"),
    ("bosnia", "BIH"),
    ("bosnia dan herzegovina", "BIH"),
    ("bosnia herzegovina", "BIH"),
    ("kamboja", "KHM"),
    ("laos", "LAO"),
    ("korea utara", "PRK"),
    ("korut", "PRK"),
    ("meksiko", "MEX"),
    ("mexico", "MEX"),
    ("selandia baru", "NZL"),
    ("slandia baru", "NZL"),
    ("new zealand", "NZL"),
    ("papua nugini", "PNG"),
    ("papua new guinea", "PNG"),
    ("timor leste", "TLS"),
    ("timor timur", "TLS"),
    ("vatikan", "VAT"),
    ("turki", "TUR"),
    ("turkiye", "TUR"),
    ("türkiye", "TUR"),
    ("turkey", "TUR"),
    ("yunani", "GRC"),
    ("greece", "GRC"),
    ("ceko", "CZE"),
    ("republika ceko", "CZE"),
    ("czech republic", "CZE"),
    ("chezch republik", "CZE"),
    ("chezch", "CZE"),
    ("czechia", "CZE"),
    ("czech", "CZE"),
    ("afrika selatan", "ZAF"),
    ("south africa", "ZAF"),
    ("slowakia", "SVK"),
    ("scotlandia", "GBR"),
    ("skotlandia", "GBR"),
    ("scotland", "GBR"),
    ("scoklandia", "GBR"),
    ("scootlandia", "GBR"),
    ("wales", "GBR"),
    ("england", "GBR"),
    ("british", "GBR"),
    ("chili", "CHL"),
    ("maccao", "MAC"),
    ("macou", "MAC"),
    ("macau", "MAC"),
    ("makau", "MAC"),
    ("macadonia", "MKD"),
    ("macedonia", "MKD"),
    ("amerika serikat usa", "USA"),
    ("amerika serikat (usa)", "USA"),
    ("saudia arabia", "SAU"),
    ("balarus", "BLR"),
    ("belarus", "BLR"),
    ("banglades", "BGD"),
    ("thaiwan", "TWN"),
    ("etonia", "EST"),
    ("estonia", "EST"),
    ("thailan", "THA"),
    ("spannyol", "ESP"),
    ("spanyol", "ESP"),
    ("holland", "NLD"),
    ("netherland", "NLD"),
    ("paraguway", "PRY"),
    ("paraguay", "PRY"),
    ("fiji island", "FJI"),
    ("solomon island", "SLB"),
    ("puerto rico", "PRI"),
    ("puerto rico (amerika serikat)", "PRI"),
    ("puerto rico (as)", "PRI"),
    ("poertorico", "PRI"),
    ("dubai", "ARE"),
    ("hawaii", "USA"),
    # Ember yang muncul di data
    ("yugoslavia", "XYU"),
    ("afrika utara", "XNA"),
    ("arab", "XAR"),
    ("timur tengah lainnya", "XME"),
    ("negara lain & crew", "XXX"),
]


def ambil_data_iso() -> list[dict[str, str]]:
    url_cc = "https://raw.githubusercontent.com/datasets/country-codes/master/data/country-codes.csv"
    with urllib.request.urlopen(url_cc, timeout=15) as resp:
        content = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(content)))


def ambil_cldr_id() -> dict[str, str]:
    url_cldr = "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main/id/territories.json"
    with urllib.request.urlopen(url_cldr, timeout=15) as resp:
        content = resp.read().decode("utf-8")
    return json.loads(content)["main"]["id"]["localeDisplayNames"]["territories"]


def build_negara_referensi() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    cc_rows = ambil_data_iso()
    cldr_data = ambil_cldr_id()

    negara_list: list[dict[str, str]] = []
    seen_iso3: set[str] = set()
    seen_iso2: set[str] = set()

    for r in cc_rows:
        iso3 = r.get("ISO3166-1-Alpha-3", "").strip()
        iso2 = r.get("ISO3166-1-Alpha-2", "").strip()
        if not iso3 or len(iso3) != 3 or iso3 in seen_iso3:
            continue
        seen_iso3.add(iso3)

        if iso2:
            assert iso2 not in seen_iso2, f"Duplicate ISO2: {iso2}"
            seen_iso2.add(iso2)

        en_name = r.get("CLDR display name", "").strip() or r.get("official_name_en", "").strip()

        if iso3 in DIM10_EXACT:
            id_name, kawasan = DIM10_EXACT[iso3]
        else:
            id_name = cldr_data.get(iso2, en_name)
            if iso3 in TIMUR_TENGAH_CODES:
                kawasan = "Timur Tengah"
            else:
                reg = r.get("Region Name", "").strip()
                kawasan = REGION_MAP.get(reg, "Lainnya")

        negara_list.append({
            "kode": iso3,
            "kode_iso2": iso2,
            "nama": id_name,
            "nama_inggris": en_name,
            "kawasan": kawasan,
            "jenis": "negara",
        })

    # Ember resmi dan yang muncul di data
    ember_data = [
        ("XCR", "", "Crew (WNA)", "Crew (Foreign)", "Lainnya"),
        ("XXX", "", "Lainnya", "Others", "Lainnya"),
        ("XYU", "", "Bekas Yugoslavia", "Former Yugoslavia", "Eropa"),
        ("XNA", "", "Afrika Utara", "North Africa", "Afrika"),
        ("XAR", "", "Negara Arab Lainnya", "Other Arab Countries", "Timur Tengah"),
        ("XME", "", "Timur Tengah Lainnya", "Other Middle East", "Timur Tengah"),
    ]
    for k, k2, nm, en, kw in ember_data:
        negara_list.append({
            "kode": k,
            "kode_iso2": k2,
            "nama": nm,
            "nama_inggris": en,
            "kawasan": kw,
            "jenis": "ember",
        })

    # Kumpulkan daftar alias
    alias_map: dict[str, str] = {}
    for var_list, code in VARIAN_10_DIM:
        for v in var_list:
            alias_map[v.strip().lower()] = code

    for a, code in EXTRA_ALIASES:
        alias_map[a.strip().lower()] = code

    alias_list = [{"alias": k, "kode": v} for k, v in sorted(alias_map.items())]
    return negara_list, alias_list


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print("Membangun referensi negara...")
    negara_list, alias_list = build_negara_referensi()

    path_negara = DATA_DIR / "negara-iso3166.csv"
    with open(path_negara, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["kode", "kode_iso2", "nama", "nama_inggris", "kawasan", "jenis"])
        writer.writeheader()
        writer.writerows(negara_list)
    print(f"Ditulis: {path_negara} ({len(negara_list)} baris)")

    path_alias = DATA_DIR / "negara-alias.csv"
    with open(path_alias, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["alias", "kode"])
        writer.writeheader()
        writer.writerows(alias_list)
    print(f"Ditulis: {path_alias} ({len(alias_list)} baris)")


if __name__ == "__main__":
    main()
