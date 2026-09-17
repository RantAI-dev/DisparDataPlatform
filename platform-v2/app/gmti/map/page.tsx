"use client";
import dynamic from "next/dynamic";

/**
 * GMTI — Jakarta Ramah Muslim, tampilan PETA.
 *
 * Di-mount client-only (ssr:false) karena Leaflet butuh `window`. Toggle
 * Daftar|Peta di-handle oleh AtlasNav di dalam GmtiMapView/GmtiView.
 */
const loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-paper">
    <div className="apple-caption text-ink-muted-48">Memuat peta…</div>
  </div>
);

const GmtiMapView = dynamic(
  () => import("@/components/GmtiMapView").then((m) => m.GmtiMapView),
  { ssr: false, loading }
);

export default function GmtiMapPage() {
  return <GmtiMapView />;
}