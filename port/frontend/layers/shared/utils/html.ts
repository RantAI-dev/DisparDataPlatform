/** Escape teks untuk HTML popup Leaflet (`esc` di GmtiMapView.tsx v2). */
export function escHtml(v: string): string {
  return v.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
}
