# Panduan pengguna

Portal data Dinas Pariwisata dan Ekonomi Kreatif Provinsi DKI Jakarta. Semua halaman bisa dibuka
tanpa login. Menu utama di kanan atas: Dashboard Statistik, Katalog Data, SDI, GCI, GPCI, GMTI,
Spatial, Hotel POC, dan API.

> **Catatan tangkapan layar.** Gambar dibuat otomatis dengan `npm run tangkapan` (Playwright,
> 1440 × 900) dari portal yang memakai **data uji** (rekaman `fixtures/data-api`). Angka di gambar
> adalah contoh, bukan angka resmi terbaru.

Di setiap halaman berlaku hal berikut:

- Angka berasal dari lakehouse Disparekraf dan diperbarui otomatis setiap hari.
- Bila sumber data sedang tidak tersedia, halaman menampilkan pesan gagal memuat. Muat ulang
  beberapa saat kemudian.
- Tombol **Kembali** di kiri atas membawa ke halaman sebelumnya.

## Beranda `/`

![Beranda](gambar/beranda.png)

Ringkasan angka utama (dataset primer SDI, baris pendataan lapangan, indikator GCI/GPCI yang
dipantau) dan empat kartu menu: Katalog Data, GCI, GPCI, dan Spatial. Klik kartu untuk membuka
bagian itu.

## Katalog Data `/katalog`

![Katalog Data](gambar/katalog.png)

Daftar semua dataset: primer (SDI Jakarta) dan sekunder (internal, instansi, crawling).

- Ketik di kotak **cari** untuk menyaring judul dan deskripsi. Bila tidak ada yang cocok muncul
  "Tidak ada dataset yang cocok."
- Pilih **tier** (primer/sekunder) dan **lapisan** (mis. Silver) untuk mempersempit daftar.
- Klik sebuah dataset untuk membuka detailnya.

## SDI `/sdi`

![SDI](gambar/sdi.png)

Sama dengan katalog, tetapi hanya dataset primer dari Satu Data Jakarta. Klik **Lihat data →**
untuk membuka detail.

## Detail dataset `/sdi/{slug}`

![Detail dataset](gambar/sdi-detail.png)

Contoh: data jumlah wisatawan mancanegara berdasarkan kebangsaan.

- Bagian atas: judul, sumber, periode data, dan jumlah baris.
- **Filter**: tambah chip filter per kolom (mis. Kebangsaan = JEPANG), hapus dengan tanda ×.
- **Urutkan**: klik judul kolom (▲ naik, ▼ turun, ↕ tanpa urutan).
- **Gulir** ke bawah untuk memuat 50 baris berikutnya.
- **Unduh CSV/XLSX** mengikuti filter yang aktif (nama berkas berakhiran `-terfilter`). Ekspor
  dibatasi 100.000 baris; di atas itu portal menolak dengan pesan "terlalu besar". Persempit
  filter lalu ulangi.
- **+ Tambah grafik**: buat grafik dari kolom tabel. Grafik tersimpan di peramban ini dan muncul
  lagi saat halaman dibuka ulang.
- Bila dataset belum ada di lakehouse, halaman menampilkan "Dataset belum tersedia di lakehouse"
  dengan tautan ke portal SDI.

## Dokumentasi API `/docs`

![Dokumentasi API](gambar/docs.png)

Daftar endpoint API publik portal: parameter, contoh cURL, dan kode error. Untuk pengembang yang
ingin memakai data portal. Pemakaian API butuh token dari pengelola portal.

## Dashboard Statistik `/dashboard`

![Dashboard](gambar/dashboard.png)

Ringkasan kinerja pariwisata dan ekonomi kreatif terhadap target RPJMD 2025–2029. Empat kartu di
atas membuka dashboard rinci.

## Wisatawan Mancanegara `/dashboard/wisman`

![Wisman](gambar/dashboard-wisman.png)

Capaian tahunan dan bulanan wisman terhadap target, komposisi kebangsaan, pintu masuk, dan lama
menginap per kelas hotel. Pilih tahun atau periode di atas grafik untuk mengganti isi. Ikon ⤢ di
pojok grafik memperbesar grafik.

## Wisatawan Nusantara `/dashboard/wisnus`

![Wisnus](gambar/dashboard-wisnus.png)

Kunjungan wisnus per tahun, per kota tujuan, bulanan, dan pertumbuhan tahun ke tahun; serta
kunjungan per destinasi. Pilih kota atau destinasi untuk menyaring.

## Tenaga Kerja Ekraf `/dashboard/tenaga-kerja`

![Tenaga kerja](gambar/dashboard-tenaga-kerja.png)

Jumlah tenaga kerja ekonomi kreatif DKI, porsi terhadap nasional, sebaran per subsektor (pilih
tahun), dan sertifikasi kompetensi.

## PDRB Ekonomi Kreatif `/dashboard/pdrb-ekraf`

![PDRB ekraf](gambar/dashboard-pdrb-ekraf.png)

Kontribusi PDRB ekraf terhadap PDRB DKI dibandingkan target, serta sebaran dan pertumbuhan per
subsektor untuk periode yang dipilih.

## GCI `/gci` dan GPCI `/gpci`

![GCI](gambar/gci.png)

![GPCI](gambar/gpci.png)

Indikator Global Cities Index (Kearney) dan Global Power City Index (Mori Memorial Foundation)
yang relevan dengan pariwisata: peringkat resmi Jakarta, kartu per indikator, dan daftar dataset
pendukung. Tombol di atas berpindah antara GCI dan GPCI. Klik kartu indikator untuk detailnya.

## Detail indikator `/gci/{kode}` dan `/gpci/{kode}`

![Indikator GCI](gambar/gci-indikator.png)

![Indikator GPCI](gambar/gpci-indikator.png)

Nilai terakhir, grafik, dan dataset yang dipakai untuk satu indikator (contoh: CE1 dan CI-IC).
Sembilan indikator belum punya data dan menampilkan keterangan "belum tersedia". Kode yang tidak
dikenal membuka halaman 404.

## Wisatawan Internasional `/gci/pariwisata/wisatawan-internasional`

![Wisatawan internasional](gambar/wisatawan-internasional.png)

Dashboard wisman untuk indikator GCI: tren, negara asal, dan perbandingan tahun.

## Kuliner Michelin `/gci/pariwisata/kuliner-michelin`

![Kuliner Michelin](gambar/kuliner-michelin.png)

Restoran Jakarta yang tercatat di panduan Michelin beserta kategorinya.

## Seni Visual dan Pertunjukan `/gci/pariwisata/seni-pertunjukan`

![Seni pertunjukan](gambar/seni-pertunjukan.png)

Jumlah pertunjukan dari Calendar of Event per tahun dan peta venue. Pilih tahun untuk menyaring.

## Restoran GCI `/gci/pariwisata/restoran-gci`

![Restoran GCI](gambar/restoran-gci.png)

Restoran ber-rating untuk indikator GCI. Saring per tier, cari nama, klik "Muat N lagi" untuk
menambah daftar, dan unduh CSV/XLSX.

## Direktori Restoran `/gci/pariwisata/direktori-restoran`

![Direktori restoran](gambar/direktori-restoran.png)

Direktori restoran dan bar yang menyajikan kuliner internasional. Tombol **ID / EN** mengganti
bahasa; pilihan bahasa dan mode daftar diingat setelah halaman dimuat ulang. Tersedia pencarian
dan unduhan XLS.

## Pertunjukan Budaya `/gci/pariwisata/pertunjukan-budaya`

![Pertunjukan budaya](gambar/pertunjukan-budaya.png)

Agenda pertunjukan budaya per tahun. Pilih tahun untuk mengganti daftar dan peta.

## Hotel `/gpci/hotel`

![Hotel](gambar/hotel.png)

Sebaran hotel untuk indikator GPCI, dengan peta dan tabel.

## Lapangan Golf `/gpci/lapangan-golf`

![Lapangan golf](gambar/lapangan-golf.png)

Lapangan golf di Jakarta pada peta. Saring fasilitas (mis. Driving Range), klik kartu untuk
menyorot di peta, dan unduh CSV.

## Toko Suvenir `/gpci/toko-suvenir`

![Toko suvenir](gambar/toko-suvenir.png)

Toko suvenir, secara bawaan diurutkan menurut relevansi. Pilih "Semua" untuk menampilkan seluruh
daftar, ganti ke mode tabel, dan unduh XLSX.

## GMTI `/gmti`

![GMTI](gambar/gmti.png)

Direktori wisata ramah muslim (rujukan Global Muslim Travel Index): ringkasan jumlah masjid,
musala, tempat ekosistem halal, dan kecamatan terliput, lalu daftar tempat per pilar (ibadah,
makan, menginap, destinasi, program). Pilih pilar, kota, atau ketik nama untuk menyaring; daftar
berhalaman. **Buka Spatial** menampilkan tempat yang sama di peta. Bila sumber data sedang tidak
tersedia, daftar menampilkan "Gagal memuat daftar fasilitas ibadah (…). Muat ulang halaman untuk
mencoba lagi."; ringkasan di atasnya tetap tampil.

## Spatial `/spatial`

![Spatial](gambar/spatial.png)

Peta gabungan titik pariwisata dan kepadatan per kecamatan. Perbesar peta untuk memecah cluster,
klik titik untuk melihat detailnya. Alamat lama `/atlas` dan `/gmti/map` diarahkan ke sini.

## Hotel POC `/scraped-hotels`

![Hotel scraped](gambar/scraped-hotels.png)

Bukti konsep data hotel hasil crawling (berbahasa Inggris, sama dengan portal lama).
