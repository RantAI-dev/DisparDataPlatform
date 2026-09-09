"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { RESTAURANTS } from "@/lib/restaurants";

/**
 * Section Atlas = komponen Atlas ASLI (di-copy dari Jakarta Atlas), di-render
 * client-only (ssr:false) — sama seperti app Atlas aslinya — karena GolfView/
 * MapView meng-import Leaflet di module-scope (butuh `window`). Design di-adjust
 * lewat token globals.css (accent → navy) + Nav global platform (AtlasNav
 * di-no-op-kan supaya tidak dobel nav).
 */
const loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-canvas">
    <div className="apple-caption text-ink-muted-48">Memuat…</div>
  </div>
);

const GciView = dynamic(() => import("@/components/GciView").then((m) => m.GciView), {
  ssr: false,
  loading,
});
const EventsView = dynamic(
  () => import("@/components/EventsView").then((m) => m.EventsView),
  { ssr: false, loading }
);
const GolfView = dynamic(() => import("@/components/GolfView").then((m) => m.GolfView), {
  ssr: false,
  loading,
});
const Dashboard = dynamic(
  () => import("@/components/Dashboard").then((m) => m.Dashboard),
  { ssr: false, loading }
);
const SouvenirView = dynamic(
  () => import("@/components/SouvenirView").then((m) => m.SouvenirView),
  { ssr: false, loading }
);
const GmtiView = dynamic(
  () => import("@/components/GmtiView").then((m) => m.GmtiView),
  { ssr: false, loading }
);
const HotelView = dynamic(
  () => import("@/components/HotelView").then((m) => m.HotelView),
  { ssr: false, loading }
);

export default function AtlasSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  switch (section) {
    case "gci":
      return <GciView />;
    case "pertunjukan":
      return <EventsView />;
    case "golf":
      return <GolfView />;
    case "restaurants":
      return <Dashboard restaurants={RESTAURANTS} />;
    case "souvenir":
      return <SouvenirView />;
    case "gmti":
      return <GmtiView />;
    case "hotel":
      return <HotelView />;
    default:
      notFound();
  }
}
