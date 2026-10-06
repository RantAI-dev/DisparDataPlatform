"""Validasi refresh wisman terarah tanpa server atau kredensial produksi."""
import importlib.util
from pathlib import Path
import re
import sqlite3
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("refresh_wisman_test", ROOT / "ingest/dispar_ingest/refresh.py")
refresh = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"clickhouse_connect": SimpleNamespace()}):
    spec.loader.exec_module(refresh)
refresh.SQL_DIR = str(ROOT / "clickhouse/sql")


class Client:
    def __init__(self, *, conflicts=0, historical_duplicates=0, unmapped=0, bad_gold=False):
        self.commands = []
        self.conflicts = conflicts
        self.historical_duplicates = historical_duplicates
        self.unmapped = unmapped
        self.bad_gold = bad_gold
        self.gold_reads = 0

    def query(self, sql):
        if "SHOW CREATE TABLE" in sql:
            table = sql.split()[-1]
            rows = [(f"CREATE VIEW {table} AS SELECT 1",)]
        elif "uniqExact" in sql:
            rows = [(self.conflicts,)]
        elif "HAVING count() > 1" in sql:
            rows = [(self.historical_duplicates,)]
        elif "max(tanggal_id" in sql:
            rows = [(644, "2026-06-01")]
        elif "wisman_karantina" in sql:
            rows = [(self.unmapped,)]
        elif "countIf" in sql:
            rows = [(0,)]
        elif " EXCEPT " in sql:
            rows = [(0,)]
        elif "FROM silver.wisman" in sql:
            rows = [(900, 2000, 202606)]
        elif "FROM serving.mart_wisman" in sql:
            self.gold_reads += 1
            rows = [(276, 1000)] if self.gold_reads == 1 else [(899 if self.bad_gold else 900, 2000)]
        else:
            raise AssertionError(sql)
        return SimpleNamespace(result_rows=rows)

    def command(self, sql, **kwargs):
        self.commands.append(sql)


class RefreshWismanTests(unittest.TestCase):
    def test_refresh_scoped_and_retains_previous_mart(self):
        ch = Client()
        result = refresh.refresh_wisman(ch)
        self.assertEqual(result["after_rows"], 900)
        exchanges = [i for i, sql in enumerate(ch.commands) if sql.startswith("EXCHANGE")]
        self.assertEqual(len(exchanges), 1)
        self.assertFalse(any("TRUNCATE" in sql for sql in ch.commands[exchanges[0] + 1:]))
        self.assertFalse(any("DROP DATABASE" in sql or "mart_kuliner" in sql for sql in ch.commands))
        self.assertTrue(any("EXCHANGE TABLES serving.mart_wisman AND serving.mart_wisman_refresh_baru" in sql for sql in ch.commands))

    def test_conflicting_source_stops_before_mutation(self):
        ch = Client(conflicts=1)
        with self.assertRaises(ValueError):
            refresh.refresh_wisman(ch)
        self.assertEqual(ch.commands, [])

    def test_repeated_refresh_keeps_same_published_values(self):
        ch = Client()
        first = refresh.refresh_wisman(ch)
        second = refresh.refresh_wisman(ch)
        self.assertEqual(first["after_rows"], second["after_rows"])
        self.assertEqual(first["after_visits"], second["after_visits"])
        self.assertEqual(second["before_rows"], second["after_rows"])
        self.assertTrue(second["already_current"])
        self.assertEqual(sum(sql.startswith("EXCHANGE") for sql in ch.commands), 1)

    def test_unmapped_country_restores_views_and_keeps_gold(self):
        ch = Client(unmapped=1)
        with self.assertRaises(ValueError):
            refresh.refresh_wisman(ch)
        self.assertFalse(any(sql.startswith("EXCHANGE") for sql in ch.commands))
        self.assertTrue(ch.commands[-1].startswith("CREATE OR REPLACE VIEW silver.wisman_karantina"))

    def test_duplicate_history_stops_before_mutation(self):
        ch = Client(historical_duplicates=1)
        with self.assertRaises(ValueError):
            refresh.refresh_wisman(ch)
        self.assertEqual(ch.commands, [])

    def test_sdi_accepts_utf8_bom(self):
        sdi_spec = importlib.util.spec_from_file_location("sdi_bom_test", ROOT / "ingest/dispar_ingest/sdi.py")
        sdi = importlib.util.module_from_spec(sdi_spec)
        with patch.dict(sys.modules, {"sdi_bom_test": sdi, "requests": SimpleNamespace(RequestException=OSError)}):
            sdi_spec.loader.exec_module(sdi)
        client = object.__new__(sdi.SdiClient)
        client.timeout, client.retries = 1, 1
        client.session = SimpleNamespace(post=lambda *args, **kwargs: SimpleNamespace(
            status_code=200, text='\ufeff{"data":[{"periode_data":"202606"}],"total":1}'
        ))
        self.assertEqual(client._post("get-table-data", {})["total"], 1)

    def test_gold_mismatch_rolls_back_exchange(self):
        ch = Client(bad_gold=True)
        with self.assertRaises(ValueError):
            refresh.refresh_wisman(ch)
        self.assertEqual(sum(sql.startswith("EXCHANGE") for sql in ch.commands), 2)

    def test_sql_preserves_history_prioritizes_latest_and_quarantines_unknown(self):
        # SQLite memeriksa hasil transformasi SELECT; sintaks FINAL tetap perlu
        # verifikasi ClickHouse hidup, bukan digantikan oleh pengujian ini.
        db = sqlite3.connect(":memory:")
        db.execute("ATTACH DATABASE ':memory:' AS silver")
        old = "data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan"
        new = "data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan"
        db.execute(f"CREATE TABLE silver.{old}(kebangsaan, bulan, wisman, periode_data)")
        db.execute(f"CREATE TABLE silver.{new}(kebangsaan, jumlah_kunjungan, periode_data)")
        db.execute("CREATE TABLE silver.dim_negara(match_key,kode_iso3,nama_negara,kawasan)")
        db.execute("CREATE TABLE silver.dim_bulan(match_key,nomor,nama_bulan)")
        db.executemany("INSERT INTO silver.dim_negara VALUES (?,?,?,?)", [("china","CHN","Tiongkok","Asia"),("tiongkok","CHN","Tiongkok","Asia"),("australia","AUS","Australia","Oseania")])
        db.executemany("INSERT INTO silver.dim_bulan VALUES (?,?,?)", [("januari",1,"Januari"),("februari",2,"Februari"),("pebruari",2,"Februari")])
        db.executemany(f"INSERT INTO silver.{old} VALUES (?,?,?,?)", [("AUSTRALIA","JANUARI",5,"2014"),("CHINA","JANUARI",10,"2025")])
        db.executemany(f"INSERT INTO silver.{new} VALUES (?,?,?)", [("TIONGKOK",20,"202501"),("CHINA",30,"202502"),("Nepal",7,"202502")])
        db.create_function("kunci_cocok",1,lambda s: re.sub(r"[^a-z0-9]+"," ",(s or "").lower()).strip())
        db.create_function("tahun_dari",1,lambda s:int(str(s)[:4]))
        db.create_function("tanggal_id",1,lambda s:str(s))
        db.create_function("toString",1,str)
        db.create_function("toMonth",1,lambda s:int(s[4:6]))
        db.create_function("toFloat64",1,float)
        class First:
            def __init__(self): self.value = None
            def step(self, value): self.value = value
            def finalize(self): return self.value
        db.create_aggregate("any",1,First)
        sql = Path(refresh.SQL_DIR, "20-silver-wisman.sql").read_text()
        statements = refresh._split_statements(sql)
        select = statements[1].split(" AS\n",1)[1].replace(" FINAL", "")
        rows = db.execute(select).fetchall()
        self.assertEqual(len(rows),3)
        by_key = {(r[0],r[5],r[3]):r for r in rows}
        self.assertEqual(by_key[("AUS",2014,1)][6],"Soekarno-Hatta")
        self.assertEqual(by_key[("CHN",2025,1)][6:8],("Tidak dirinci",20))
        self.assertEqual(by_key[("CHN",2025,2)][7],30)
        quarantine = statements[2].split(" AS\n",1)[1].replace(" FINAL", "")
        self.assertEqual(db.execute(quarantine).fetchall(),[("Nepal",)])


if __name__ == "__main__":
    unittest.main()
