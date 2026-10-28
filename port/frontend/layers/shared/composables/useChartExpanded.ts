/**
 * Konteks "grafik sedang diperbesar" (ChartExpand.tsx v2). ChartCard merender ulang slot-nya di
 * dalam modal di bawah `ChartExpandedProvider`; tiap chart membacanya lewat `useChartExpanded()`
 * untuk menampilkan label nilai + dataZoom + tinggi besar.
 */
import type { InjectionKey } from "vue";

const KUNCI: InjectionKey<boolean> = Symbol("chart-diperbesar");

export function useChartExpanded(): boolean {
  return inject(KUNCI, false);
}

/** Pembungkus tanpa markup yang menandai keturunannya sebagai "diperbesar". */
export const ChartExpandedProvider = defineComponent({
  name: "ChartExpandedProvider",
  setup(_, { slots }) {
    provide(KUNCI, true);
    return () => slots.default?.();
  },
});
