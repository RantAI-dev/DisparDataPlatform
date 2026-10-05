"use client";

import dynamic from "next/dynamic";

const View = dynamic(() => import("@/components/EventsView").then((m) => m.EventsView), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat data…</p></main>,
});

export default function EventsPage() {
  return <View />;
}
