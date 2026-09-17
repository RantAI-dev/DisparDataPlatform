"use client";

import "@/features/ai/ai.css";
import { AiProvider } from "@/features/ai/use-ai";
import { AiDock as AiDockComponent } from "@/features/ai/ai-dock";

export function AiDock() {
  return (
    <AiProvider>
      <AiDockComponent />
    </AiProvider>
  );
}
