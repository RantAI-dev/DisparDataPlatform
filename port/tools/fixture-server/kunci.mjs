// Kunci rekaman fixture Data API: path + query yang dinormalkan (plan 10, "Server fixture").
//
// Normalisasi: parameter diurutkan menurut nama (stabil, jadi urutan nilai berulang seperti
// f=a&f=b tetap), parameter kosong dibuang, lalu di-encode ulang dengan satu cara. Dengan begitu
// `?b=2&a=1`, `?a=1&b=2`, dan `?a=1&b=2&c=` menghasilkan kunci yang sama, dan spasi yang ditulis
// `%20` (Laravel) maupun `+` (URLSearchParams) tidak membedakan kunci.
import { createHash } from "node:crypto";

export function normalkan(alamat) {
  const url = new URL(alamat, "http://fixture.local");
  const pasangan = [...url.searchParams.entries()]
    .filter(([, nilai]) => nilai !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = pasangan
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return query ? `${path}?${query}` : path;
}

/** Nama berkas: path yang mudah dibaca + hash pendek kunci (supaya unik per query). */
export function namaBerkas(kunci) {
  const path = kunci.split("?")[0].replace(/^\/+/, "").replace(/[^A-Za-z0-9_-]+/g, "_");
  const hash = createHash("sha1").update(kunci).digest("hex").slice(0, 10);
  return `${path}.${hash}.json`;
}
