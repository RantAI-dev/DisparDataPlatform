/**
 * Mode "diperbesar" chart (ChartExpand.tsx v2): tinggi, ruang slider, dan dataZoom kategori.
 */

/** Tinggi chart saat diperbesar (string CSS agar mengikuti tinggi layar). */
export const EXPANDED_HEIGHT = "min(68vh, 640px)";

/** Ruang ekstra pada grid untuk slider dataZoom. */
export const ZOOM_PAD = 36;

const SLIDER_STYLE = {
  borderColor: "#e2e8f0",
  fillerColor: "rgba(237, 107, 35, 0.15)",
  handleStyle: { color: "#ed6b23", borderColor: "#ed6b23" },
  textStyle: { color: "#64748b", fontSize: 10 },
};

/**
 * dataZoom (inside + slider) untuk sumbu kategori. Bila kategori banyak, jendela awal hanya
 * menampilkan `visible` kategori pertama. `vertical` = sumbu-Y kategori (bar horizontal).
 * Lebar layar dibaca saat dipanggil (tidak reaktif terhadap rotasi), sama dengan v2.
 */
export function categoryZoom(
  count: number,
  vertical = false,
  visible = 14,
  lebarLayar: number | undefined = typeof window !== "undefined" ? window.innerWidth : undefined,
) {
  // Layar sempit (HP): jendela awal dipersempit agar label nilai tidak bertumpuk.
  if (!vertical && lebarLayar !== undefined && lebarLayar < 640) visible = Math.min(visible, 6);
  const end = count > visible ? Math.max(5, (visible / count) * 100) : 100;
  const axis = vertical ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  return [
    { type: "inside", ...axis, start: 0, end, filterMode: "none" },
    {
      type: "slider",
      ...axis,
      start: 0,
      end,
      filterMode: "none",
      ...(vertical ? { orient: "vertical", width: 16, right: 4 } : { height: 20, bottom: 4 }),
      ...SLIDER_STYLE,
    },
  ];
}
