"use client";

import { usePathname } from "next/navigation";
import "@/features/ai/ai.css";
import { AiProvider } from "@/features/ai/use-ai";
import { AiDock as AiDockComponent } from "@/features/ai/ai-dock";

export function AiDock() {
  // Halaman /ai sudah menampilkan chat penuh; dock di sana membuat dua chat terbuka bersamaan.
  const pathname = usePathname();
  if (pathname === "/ai" || pathname?.startsWith("/ai/")) return null;
  return (
    <AiProvider>
      <AiDockComponent />
    </AiProvider>
  );
}
