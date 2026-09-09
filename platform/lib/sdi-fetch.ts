const BACKEND = "https://satudata.jakarta.go.id/backend/api/v2/satudata";

async function post(ep: string, body: unknown, signal?: AbortSignal) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/${ep}`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${ep} ${res.status}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`${ep} non-JSON (SDI maintenance?)`);
      }
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export type SdiColumn = {
  key: string;
  label: string | null;
  type: string | null;
  description: string | null;
};

export type SdiDetail = {
  slug: string;
  title: string;
  description: string;
  sumberData: string[];
  frekuensi: string | null;
  satuan: string | null;
  klasifikasi: string | null;
  kontak: string | null;
  author: string | null;
  columns: SdiColumn[];
  rows: Record<string, unknown>[];
  total: number;
};

/** Ambil metadata + kolom + seluruh baris satu dataset dari SDI. */
export async function fetchSdiDetail(
  slug: string,
  signal?: AbortSignal
): Promise<SdiDetail> {
  const detail = await post(
    "detail",
    {
      kategori: "dataset",
      page_url: slug,
      data_no: 1,
      per_page: 10,
      table_params: {
        page: 1,
        per_page: 10,
        sort_field: null,
        sort_order: null,
        filters: {},
      },
    },
    signal
  );

  // get-table-data dipaginasi — SDI membatasi ~5000 baris/halaman; sebagian
  // registry (akomodasi, MICE, dll) punya puluhan ribu baris.
  const PER = 5000;
  const allRows: Record<string, unknown>[] = [];
  let tableTotal = 0;
  for (let page = 1; page <= 25; page++) {
    const table = await post(
      "get-table-data",
      {
        page_url: slug,
        kategori: "dataset",
        page,
        per_page: PER,
        sort_field: null,
        sort_order: "asc",
        filters: {},
      },
      signal
    );
    const chunk = Array.isArray(table?.data) ? table.data : [];
    tableTotal = Number(table?.total ?? tableTotal) || tableTotal;
    allRows.push(...chunk);
    if (chunk.length < PER || allRows.length >= tableTotal) break;
  }

  const meta = detail?.data ?? {};
  const komponen: {
    header_komponen: string;
    tipe_data_komponen?: string;
    desc_komponen?: string;
  }[] = Array.isArray(meta.komponen_data_table)
    ? meta.komponen_data_table
    : [];

  const columns: SdiColumn[] = komponen.map((k) => ({
    key: k.header_komponen,
    label: null,
    type: k.tipe_data_komponen ?? null,
    description: k.desc_komponen ?? null,
  }));

  // SDI sering TIDAK mendeklarasikan `periode_data` di komponen_data_table
  // walau tiap baris membawanya (mis. dataset bulanan Rata-rata Lama Menginap:
  // period "202403" ada di baris tapi tabel generik membuangnya). Bila kolom
  // periode benar-benar ada di data tapi tak dideklarasikan, munculkan sebagai
  // kolom PALING KIRI supaya dimensi waktu ikut tertarik & bisa dijadikan grafik.
  const declared = new Set(columns.map((c) => c.key));
  if (
    !declared.has("periode_data") &&
    allRows.some((r) => r.periode_data != null && r.periode_data !== "")
  ) {
    columns.unshift({
      key: "periode_data",
      label: "Periode",
      type: "periode",
      description: "Periode data (YYYYMM) — ditarik dari baris walau tidak dideklarasikan SDI.",
    });
  }

  return {
    slug,
    title: meta.title ?? slug,
    description: meta.desc ?? "",
    sumberData: meta.sumber_data ?? [],
    frekuensi: meta.frekuensi_penerbitan ?? null,
    satuan: meta.satuan ?? null,
    klasifikasi: meta.klasifikasi_data ?? null,
    kontak: meta.kontak ?? null,
    author: meta.author ?? null,
    columns,
    rows: allRows,
    total: tableTotal,
  };
}