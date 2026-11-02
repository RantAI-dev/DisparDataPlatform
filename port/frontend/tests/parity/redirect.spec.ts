// Paritas 6 redirect lama (KONTRAK §1, SPEC §5.4): status dan Location sama dengan produksi.
// Satu instance per bentuk, ditambah cabang 404 untuk key tak dikenal.
import { expect, test } from "@playwright/test";
import { PRODUKSI } from "./bantu";

const RUTE = [
  ["RD-P01", "/atlas"],
  ["RD-P02", "/atlas/golf"],
  ["RD-P02", "/atlas/tidak-ada"],
  ["RD-P03", "/atlas/restaurants/map"],
  ["RD-P03", "/atlas/hotel/map"],
  ["RD-P04", "/gmti/map"],
  ["RD-P05", "/katalog/hotel"],
  ["RD-P06", "/readiness"],
] as const;

/** Location relatif terhadap host (produksi bisa menjawab URL absolut). */
const lokasi = (l: string | undefined, host: string) => (l ?? "").replace(host, "") || null;

for (const [id, path] of RUTE) {
  test(`${id} ${path}`, async ({ request, baseURL }, info) => {
    const [prod, portal] = await Promise.all([
      request.get(PRODUKSI + path, { maxRedirects: 0 }),
      request.get(path, { maxRedirects: 0 }),
    ]);
    const hasil = {
      path,
      redirect: {
        produksi: { status: prod.status(), lokasi: lokasi(prod.headers().location, PRODUKSI) },
        portal: { status: portal.status(), lokasi: lokasi(portal.headers().location, baseURL!) },
      },
    };
    await info.attach("paritas-hasil", { body: JSON.stringify(hasil), contentType: "application/json" });
    expect(hasil.redirect.portal).toEqual(hasil.redirect.produksi);
  });
}
