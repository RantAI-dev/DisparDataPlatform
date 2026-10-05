"use client";

import dynamic from "next/dynamic";
import { RESTAURANTS } from "@/lib/restaurants";

const View = dynamic(() => import("@/components/Dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat data…</p></main>,
});

export default function RestaurantDirectoryPage() {
  return <View restaurants={RESTAURANTS} />;
}
