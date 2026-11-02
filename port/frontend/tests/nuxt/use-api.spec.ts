// useApi di sisi browser (environment nuxt): lewat /_api, envelope dibuka, error jadi ApiError.
import { describe, expect, it } from "vitest";
import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { ApiError, useApi } from "../../layers/shared/composables/useApi";

registerEndpoint("/_api/katalog", (event) => ({
  success: true,
  message: "OK",
  data: { query: event.path },
  meta: { request_id: "r1", sumber: "snapshot", stale: true, total: 3 },
}));
registerEndpoint("/_api/tidak-ada", (event) => {
  event.node.res.statusCode = 404;
  return { success: false, message: "Alamat tidak ditemukan.", errors: { code: "NOT_FOUND" }, meta: { request_id: "r2" } };
});
registerEndpoint("/_api/bukan-envelope", () => "<html>gateway</html>");

describe("useApi (browser)", () => {
  it("memanggil /_api dengan f[] dan mengembalikan data + meta", async () => {
    const api = useApi();
    const hasil = await api<{ query: string }>("katalog", { f: ["a", "b"], tier: "sekunder" });
    // registerEndpoint memasang endpoint di bawah prefix uji; yang penting jalur + query dari useApi.
    expect(hasil.data.query.endsWith("/_api/katalog?f%5B%5D=a&f%5B%5D=b&tier=sekunder")).toBe(true);
    expect(hasil.meta).toMatchObject({ sumber: "snapshot", stale: true, total: 3 });
  });

  it("melempar ApiError dengan kode, pesan, dan status dari envelope gagal", async () => {
    const api = useApi();
    await expect(api("tidak-ada")).rejects.toMatchObject({ name: "ApiError", code: "NOT_FOUND", status: 404, message: "Alamat tidak ditemukan." });
  });

  it("melempar ApiError juga untuk jawaban yang bukan envelope", async () => {
    const api = useApi();
    const err = await api("bukan-envelope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Gagal memuat data.");
  });
});
