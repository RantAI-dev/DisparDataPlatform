"""Pembangkit Silver otomatis: kolom kode tetap teks walau isinya angka (tanpa server)."""

import unittest
from unittest.mock import patch

from dispar_ingest import silver


class Client:
    def __init__(self, kolom):
        self.kolom = kolom
        self.commands = []

    def command(self, sql):
        self.commands.append(sql)

    def query(self, sql):
        class Hasil:
            result_rows = []

        h = Hasil()
        if sql.startswith("SHOW TABLES"):
            h.result_rows = [("bronze_sdi.usaha_berizin",)]
        elif sql.startswith("DESCRIBE"):
            h.result_rows = [(k,) for k in self.kolom]
        return h

    def insert(self, tabel, rows, column_names):
        self.meta = rows


class KolomKodeTetapTeks(unittest.TestCase):
    def test_kbli_tidak_dipromosikan_ke_angka(self):
        ch = Client(["kbli", "jumlah_tki", "_row_hash"])
        # Isi kbli (82301) dan jumlah_tki lolos konversi angka 100%.
        with patch.object(silver, "client", return_value=ch), \
             patch.object(silver, "tebak_tipe", return_value=("angka", 1.0)) as tebak:
            self.assertEqual(silver.generate_silver(), 0)

        ddl = next(c for c in ch.commands if c.startswith("CREATE OR REPLACE VIEW silver.usaha_berizin"))
        self.assertIn("bersih_teks(`kbli`) AS `kbli`", ddl)
        self.assertIn("angka_id(`jumlah_tki`) AS `jumlah_tki`", ddl)
        # Kolom kode tidak perlu ditebak; metadata mencatatnya sebagai teks.
        self.assertEqual([c.args[2] for c in tebak.call_args_list], ["jumlah_tki"])
        self.assertIn(["usaha_berizin", "kbli", "teks", 0.0, 0], ch.meta)


if __name__ == "__main__":
    unittest.main()
