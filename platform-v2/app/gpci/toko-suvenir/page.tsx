"use client";

import dynamic from "next/dynamic";

const View = dynamic(() => import("@/components/SouvenirView").then((m) => m.SouvenirView), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat data…</p></main>,
});

export default function SouvenirPage() {
  return <View />;
}
