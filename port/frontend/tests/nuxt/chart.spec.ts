// ChartCard (modal perbesar + konteks diperbesar) dan komponen chart di runtime Nuxt.
// ECharts tidak bisa menggambar di happy-dom (tanpa canvas), jadi EChart diganti stub yang
// menampilkan tinggi + ada/tidaknya dataZoom; isi opsi diuji di tests/unit/chart-options.spec.ts.
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChartCard from "../../layers/shared/components/chart/ChartCard.vue";
import BarBreakdown from "../../layers/shared/components/chart/BarBreakdown.vue";
import BarChart from "../../layers/shared/components/chart/BarChart.vue";
import LineTrend from "../../layers/shared/components/chart/LineTrend.vue";
import VerticalBars from "../../layers/shared/components/chart/VerticalBars.vue";
import { useChartExpanded } from "../../layers/shared/composables/useChartExpanded";

const EChartStub = defineComponent({
  props: { option: { type: Object, required: true }, height: { type: [Number, String], required: true } },
  setup: (p) => () => h("div", { "data-chart": "", "data-height": String(p.height), "data-zoom": String("dataZoom" in p.option) }),
});
const stubs = { EChart: EChartStub };
const Probe = defineComponent({ setup: () => () => h("span", { class: "probe" }, String(useChartExpanded())) });
const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, value: i * 10 }));

describe("ChartCard", () => {
  it("membuka modal berisi slot dengan konteks diperbesar, lalu Esc menutup dan fokus kembali", async () => {
    const w = await mountSuspended(ChartCard, { props: { title: "Judul", sub: "Sub" }, slots: { default: () => h(Probe) }, attachTo: document.body });
    expect(w.find(".probe").text()).toBe("false");
    expect(w.classes()).toContain("utility-card");

    await w.find('button[aria-label="Perbesar grafik"]').trigger("click");
    await nextTick();
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Judul (diperbesar)");
    expect(dialog.querySelector(".probe")!.textContent).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    await nextTick();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Tutup");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Perbesar grafik");
    w.unmount();
  });

  it("menggabungkan class pemanggil setelah kelas bawaan", async () => {
    const w = await mountSuspended(ChartCard, { props: { title: "T" }, attrs: { class: "md:col-span-2" } });
    expect(w.attributes("class")).toBe("utility-card relative p-5 transition-shadow hover:shadow-md md:col-span-2");
  });
});

describe("komponen chart", () => {
  it("menampilkan keadaan kosong seperti v2", async () => {
    expect((await mountSuspended(BarBreakdown, { props: { data: [] }, global: { stubs } })).text()).toBe("Tidak ada data.");
    expect((await mountSuspended(LineTrend, { props: { data: pts(1) }, global: { stubs } })).text()).toBe("Data tren belum cukup.");
    expect((await mountSuspended(BarChart, { props: { data: [] }, global: { stubs } })).find("[data-chart]").exists()).toBe(false);
  });

  it("memakai tinggi v2 dan dataZoom hanya saat diperbesar", async () => {
    const bb = await mountSuspended(BarBreakdown, { props: { data: pts(3) }, global: { stubs } });
    expect(bb.find("[data-chart]").attributes()).toMatchObject({ "data-height": "160", "data-zoom": "false" });
    const vb = await mountSuspended(VerticalBars, { props: { data: pts(3) }, global: { stubs } });
    expect(vb.find("[data-chart]").attributes("data-height")).toBe("280");

    const Besar = defineComponent({
      setup: () => () => h(ChartCard, { title: "T" }, () => h(VerticalBars, { data: pts(30) })),
    });
    const w = await mountSuspended(Besar, { global: { stubs }, attachTo: document.body });
    await w.find('button[aria-label="Perbesar grafik"]').trigger("click");
    await nextTick();
    const dalam = document.body.querySelector('[role="dialog"] [data-chart]')!;
    expect(dalam.getAttribute("data-height")).toBe("min(68vh, 640px)");
    expect(dalam.getAttribute("data-zoom")).toBe("true");
    expect(w.find("[data-chart]").attributes("data-zoom")).toBe("false");
    w.unmount();
  });
});
