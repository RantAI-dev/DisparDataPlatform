/**
 * SATU-SATUNYA klien HTTP frontend (SPEC §5.2, §5.3 butir 3). Halaman tidak memanggil $fetch;
 * composable fitur `use<Fitur>()` memakai ini.
 *
 * - SSR: langsung ke Laravel `/api/v1/**` dengan token frontend (runtimeConfig server-only).
 * - Browser: ke proxy Nitro `/_api/**`, yang menyisipkan token di server.
 * - Envelope dibuka; gagal dilempar sebagai ApiError(code, message, status).
 * - Parameter berulang dikirim `f[]=` (PHP menelan `f=` berulang, SPEC §4.4).
 */
export type Nilai = string | number | boolean | null | undefined;
export type Query = Record<string, Nilai | Nilai[]>;

export interface ApiMeta {
  request_id: string;
  sumber: "data_api" | "cache" | "snapshot" | null;
  stale: boolean;
  total?: number;
  [kunci: string]: unknown;
}

export interface ApiHasil<T> {
  data: T;
  meta: ApiMeta;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Query string bergaya Laravel: array → `kunci[]=`; null/undefined/"" dibuang. */
export function queryLaravel(query: Query = {}): string {
  const bagian: string[] = [];
  for (const [kunci, nilai] of Object.entries(query)) {
    const daftar = Array.isArray(nilai) ? nilai : [nilai];
    const nama = Array.isArray(nilai) ? `${kunci}[]` : kunci;
    for (const v of daftar) {
      if (v === null || v === undefined || v === "") continue;
      bagian.push(`${encodeURIComponent(nama)}=${encodeURIComponent(String(v))}`);
    }
  }
  return bagian.length ? `?${bagian.join("&")}` : "";
}

interface Envelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: ApiMeta;
  errors?: { code?: string };
}

export function useApi() {
  const config = useRuntimeConfig();
  const event = import.meta.server ? useRequestEvent() : undefined;

  return async function api<T>(path: string, query?: Query): Promise<ApiHasil<T>> {
    const jalur = path.replace(/^\/+/, "");
    let url: string;
    const headers: Record<string, string> = { Accept: "application/json" };

    if (import.meta.server) {
      url = `${config.laravelUrl}/api/v1/${jalur}${queryLaravel(query)}`;
      headers.Authorization = `Bearer ${config.frontendToken}`;
      // IP asli browser untuk LOG_HISTORY (Laravel mempercayai alamat Nuxt, SPEC §4.4).
      const ip = event?.node.req.socket.remoteAddress;
      const xff = event?.node.req.headers["x-forwarded-for"];
      const rantai = [xff, ip].filter(Boolean).join(", ");
      if (rantai) headers["X-Forwarded-For"] = rantai;
      const rid = event?.node.req.headers["x-request-id"];
      if (typeof rid === "string") headers["X-Request-Id"] = rid;
    } else {
      url = `/_api/${jalur}${queryLaravel(query)}`;
    }

    const res = await $fetch.raw<Envelope<T>>(url, { headers, ignoreResponseError: true }).catch(() => null);
    const body = res?._data;
    if (!res || !res.ok || !body || body.success !== true) {
      throw new ApiError(
        body?.errors?.code ?? (res ? `HTTP_${res.status}` : "JARINGAN"),
        body?.message ?? "Gagal memuat data.",
        res?.status ?? 0,
      );
    }
    return { data: body.data as T, meta: body.meta as ApiMeta };
  };
}
