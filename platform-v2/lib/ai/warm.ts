import { getDataMap } from "./data-map";

/** Panaskan cache peta data AI (±40 dtk) supaya pertanyaan pertama tidak menunggu. */
export function warmDataMap(): void {
  void getDataMap().catch(() => {});
}
