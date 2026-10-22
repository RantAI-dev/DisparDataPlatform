/** Dipanggil Next.js sekali saat server start: panaskan peta data AI. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AI_WARM_DATA_MAP !== "0") {
    const { warmDataMap } = await import("./lib/ai/warm");
    setTimeout(warmDataMap, 5000);
  }
}
