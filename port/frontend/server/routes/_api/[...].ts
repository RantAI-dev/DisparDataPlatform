/**
 * Proxy browser → Laravel (SPEC §5.2): `/_api/**` diteruskan ke `/api/v1/**`.
 *
 * - Hanya GET/HEAD; selain itu 405.
 * - Token frontend disisipkan di server dan tidak pernah dikirim ke browser.
 * - `sistem/*` ditolak 404 (rute admin/kesehatan tidak dibuka lewat browser).
 * - X-Forwarded-For (+ IP pemanggil) dan X-Request-Id diteruskan.
 * - Hanya header respons dalam daftar izin yang dikembalikan; body dialirkan (ekspor besar).
 */
import { randomUUID } from "node:crypto";
import type { H3Event } from "h3";

const HEADER_KELUAR = ["content-type", "content-disposition", "cache-control", "x-request-id", "retry-after", "x-row-count"];

// Batas tunggu Laravel: di atas timeout ekspor Data API (300 s, SPEC §4.6) supaya aliran ekspor
// tidak terpotong, tetapi request yang macet tetap berakhir.
const BATAS_MS = 330_000;

function gagal(event: H3Event, status: number, code: string, message: string) {
  setResponseStatus(event, status);
  setResponseHeader(event, "content-type", "application/json");
  return { success: false, message, errors: { code }, meta: { request_id: null } };
}

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" && event.method !== "HEAD") {
    setResponseHeader(event, "allow", "GET, HEAD");
    return gagal(event, 405, "METHOD_NOT_ALLOWED", "Metode tidak diizinkan.");
  }

  const { laravelUrl, frontendToken } = useRuntimeConfig(event);
  const masuk = getRequestURL(event);
  const sisa = masuk.pathname.replace(/^\/_api\/?/, "");

  // Periksa segmen SETELAH di-decode (Laravel juga men-decode): tolak `.`/`..`, garis miring
  // tersembunyi (`..%2f`), dan sistem/* termasuk bentuk ter-encode (`%73istem`).
  let segmen: string[];
  try {
    segmen = sisa.split("/").map((s) => decodeURIComponent(s));
  } catch {
    return gagal(event, 404, "NOT_FOUND", "Alamat tidak ditemukan.");
  }
  const berbahaya = segmen.some((d) => d === "." || d === ".." || /[/\\]/.test(d));
  const tujuan = new URL(`/api/v1/${sisa}${masuk.search}`, laravelUrl);
  if (berbahaya || segmen[0]?.toLowerCase() === "sistem" || !tujuan.pathname.startsWith("/api/v1/")) {
    return gagal(event, 404, "NOT_FOUND", "Alamat tidak ditemukan.");
  }

  const xff = getRequestHeader(event, "x-forwarded-for");
  const ip = event.node.req.socket.remoteAddress;
  let habisWaktu = false;
  const res = await fetch(tujuan, {
    method: event.method,
    signal: AbortSignal.timeout(BATAS_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${frontendToken}`,
      "X-Forwarded-For": [xff, ip].filter(Boolean).join(", "),
      "X-Request-Id": getRequestHeader(event, "x-request-id") ?? randomUUID(),
    },
  }).catch((e: unknown) => {
    habisWaktu = e instanceof DOMException && e.name === "TimeoutError";
    return null;
  });

  if (!res) {
    return habisWaktu
      ? gagal(event, 504, "GATEWAY_TIMEOUT", "Server portal terlalu lama menjawab.")
      : gagal(event, 503, "UPSTREAM_UNAVAILABLE", "Server portal sedang tidak tersedia.");
  }

  setResponseStatus(event, res.status);
  for (const h of HEADER_KELUAR) {
    const v = res.headers.get(h);
    if (v !== null) setResponseHeader(event, h, v);
  }
  return res.body ? sendStream(event, res.body) : null;
});
