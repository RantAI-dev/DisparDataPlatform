// Shell bersama di runtime Nuxt: AppNav (tanpa AI, item aktif, tombol kembali) dan useLang.
import { beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import AppNav from "../../layers/shared/components/app/AppNav.vue";
import DashboardSubnav from "../../layers/shared/components/app/DashboardSubnav.vue";
import { useLang } from "../../layers/shared/composables/useLang";

const label = (el: Element) => el.textContent?.trim() ?? "";

// Halaman fitur belum ada (plan 11+); rute penampung supaya `route` di mountSuspended bisa dituju.
beforeAll(() => {
  useRouter().addRoute({ name: "uji-penampung", path: "/:jalur(.*)*", component: defineComponent({ render: () => null }) });
});

describe("AppNav", () => {
  it("di beranda: tanpa tombol kembali, tanpa item AI, item sama dengan produksi", async () => {
    const w = await mountSuspended(AppNav, { route: "/" });
    expect(w.find('button[aria-label="Kembali ke halaman sebelumnya"]').exists()).toBe(false);
    const nav = w.findAll("nav a").map((a) => label(a.element));
    expect(nav).toEqual(["Katalog Data", "SDI", "GCI", "GPCI", "GMTI", "Spatial", "Hotel POC", "API"]);
    expect(w.findAll("a").map((a) => a.attributes("href"))).not.toContain("/ai");
  });

  it("menandai item aktif dengan awalan path dan menampilkan tombol kembali", async () => {
    const w = await mountSuspended(AppNav, { route: "/sdi/wisman" });
    expect(w.find('button[aria-label="Kembali ke halaman sebelumnya"]').exists()).toBe(true);
    const sdi = w.findAll("nav a").find((a) => label(a.element) === "SDI")!;
    expect(sdi.attributes("style")).toContain("background: #ed6b23");
    const gci = w.findAll("nav a").find((a) => label(a.element) === "GCI")!;
    expect(gci.attributes("style")).toContain("color: #33302b");
  });
});

describe("DashboardSubnav", () => {
  it("menandai halaman dashboard aktif", async () => {
    const w = await mountSuspended(DashboardSubnav, { route: "/dashboard/wisnus" });
    const aktif = w.findAll("a").filter((a) => a.classes().includes("text-white"));
    expect(aktif.map((a) => a.attributes("href"))).toEqual(["/dashboard/wisnus"]);
  });
});

describe("useLang", () => {
  it("membaca dpj.lang setelah mount dan menyimpan pilihan baru", async () => {
    localStorage.setItem("dpj.lang", "en");
    let api!: ReturnType<typeof useLang>;
    await mountSuspended(defineComponent({ setup() { api = useLang(); return () => h("div"); } }));
    await nextTick();
    expect(api.lang.value).toBe("en");
    expect(api.t("nav.switch_to")).toBe("ID");
    api.toggle();
    await nextTick();
    expect(localStorage.getItem("dpj.lang")).toBe("id");
    expect(document.documentElement.lang).toBe("id");
    localStorage.removeItem("dpj.lang");
  });
});
