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

    def test_nib_tidak_dipromosikan_ke_angka(self):
        # NIB = nomor identitas berusaha: nol di depan (0230010120158) harus tetap, dan nomor
        # izin lama (TDUP/TDP) yang bukan angka tidak boleh jadi kosong.
        ch = Client(["nib", "jml_naker"])
        with patch.object(silver, "client", return_value=ch), \
             patch.object(silver, "tebak_tipe", return_value=("angka", 1.0)) as tebak:
            self.assertEqual(silver.generate_silver(), 0)

        ddl = next(c for c in ch.commands if c.startswith("CREATE OR REPLACE VIEW silver.usaha_berizin"))
        self.assertIn("bersih_teks(`nib`) AS `nib`", ddl)
        self.assertIn("angka_id(`jml_naker`) AS `jml_naker`", ddl)
        self.assertEqual([c.args[2] for c in tebak.call_args_list], ["jml_naker"])


class KolomKoordinatTitikDesimal(unittest.TestCase):
    def test_lat_lon_memakai_koordinat_id(self):
        ch = Client(["lat", "lon", "jumlah"])
        with patch.object(silver, "client", return_value=ch), \
             patch.object(silver, "tebak_tipe", return_value=("angka", 1.0)):
            self.assertEqual(silver.generate_silver(), 0)

        ddl = next(c for c in ch.commands if c.startswith("CREATE OR REPLACE VIEW silver.usaha_berizin"))
        self.assertIn("koordinat_id(`lat`) AS `lat`", ddl)
        self.assertIn("koordinat_id(`lon`) AS `lon`", ddl)
        # Kolom besaran biasa tetap angka_id (titik = ribuan).
        self.assertIn("angka_id(`jumlah`) AS `jumlah`", ddl)

    def test_ambang_tipe_diukur_dengan_koordinat_id(self):
        sql = []

        class Ch:
            def query(self, q):
                sql.append(q)

                class Hasil:
                    result_rows = [(10, 10, 0, 0)]

                return Hasil()

        silver.tebak_tipe(Ch(), "lake.`t`", "lat")
        silver.tebak_tipe(Ch(), "lake.`t`", "jumlah")
        self.assertIn("koordinat_id(`lat`) IS NOT NULL", sql[0])
        self.assertIn("angka_id(`jumlah`) IS NOT NULL", sql[1])


if __name__ == "__main__":
    unittest.main()
