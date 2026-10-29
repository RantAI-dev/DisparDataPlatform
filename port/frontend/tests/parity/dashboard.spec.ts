// Paritas fitur dashboard (docs/skenario/dashboard.md DB-P*): portal vs dispar.rantai.dev.
import { test } from "@playwright/test";
import { bandingkanHalaman } from "./bantu";

for (const [id, path] of [
  ["DB-P01", "/dashboard"],
  ["DB-P02", "/dashboard/wisman"],
  ["DB-P03", "/dashboard/wisnus"],
  ["DB-P04", "/dashboard/tenaga-kerja"],
  ["DB-P05", "/dashboard/pdrb-ekraf"],
] as const) {
  test(`${id} ${path}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, path, info, { tunggu: "canvas, .utility-card" });
  });
}
