"use client";

import dynamic from "next/dynamic";

const SpatialMap = dynamic(() => import("@/components/GmtiMapView").then((m) => m.GmtiMapView), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat peta Spatial…</p></main>,
});

export default function SpatialPage() {
  return <SpatialMap />;
}
