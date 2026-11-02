// useDashboard (docs/skenario/dashboard.md DB-F01): jalur, query, dan parameter kosong dibuang.
import { describe, expect, it } from "vitest";
import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { useDashboard } from "../../layers/dashboard/composables/useDashboard";

const pantul = (event: { path: string }) => ({ success: true, message: "OK", data: { path: event.path }, meta: { request_id: "r" } });
registerEndpoint("/_api/dashboard/wisman/kebangsaan", pantul);
registerEndpoint("/_api/dashboard/wisnus/tahunan", pantul);
registerEndpoint("/_api/dashboard/destinasi/ringkasan", pantul);

describe("useDashboard", () => {
  it("DB-F01 kebangsaan selalu top=8; kota/destinasi kosong tidak dikirim", async () => {
    const api = useDashboard();
    const jalur = async (p: Promise<unknown>) => ((await p) as { path: string }).path.replace(/^.*\/_api\//, "");
    expect(await jalur(api.wismanKebangsaan({ tahun: "2024" }))).toBe("dashboard/wisman/kebangsaan?tahun=2024&top=8");
    expect(await jalur(api.wisnusTahunan(undefined))).toBe("dashboard/wisnus/tahunan");
    expect(await jalur(api.wisnusTahunan("Jakarta Pusat"))).toBe("dashboard/wisnus/tahunan?kota=Jakarta%20Pusat");
    expect(await jalur(api.destinasiRingkasan("wisman", "2025"))).toBe("dashboard/destinasi/ringkasan?jenis=wisman&tahun=2025");
  });
});
