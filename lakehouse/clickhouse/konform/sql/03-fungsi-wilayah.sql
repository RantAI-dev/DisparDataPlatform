-- 03-fungsi-wilayah.sql
-- Fungsi pembantu standarisasi kunci pencocokan wilayah kemendagri.
-- Menyeragamkan awalan kota/kabupaten dan membuang awalan kecamatan/kelurahan.

CREATE OR REPLACE FUNCTION kf_kunci_wilayah AS (s) ->
  if(s IS NULL OR kunci_cocok(s) = '', NULL,
    nullIf(
      trimBoth(
        replaceRegexpAll(
          replaceRegexpOne(
            replaceRegexpOne(
              replaceRegexpOne(
                replaceRegexpOne(
                  replaceRegexpOne(
                    kunci_cocok(s),
                    '^kota (adm|administrasi) ', 'kota '
                  ),
                  '^kab(upaten)? (adm|administrasi) ', 'kab '
                ),
                '^kabupaten ', 'kab '
              ),
              '^(kecamatan|kec) ', ''
            ),
            '^(kelurahan|kel) ', ''
          ),
          '(^| )kep( |$)', '\\1kepulauan\\2'
        )
      ),
      ''
    )
  );
