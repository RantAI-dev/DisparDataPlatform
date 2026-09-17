"use client";

import "@/features/ai/ai.css";
import { AiProvider } from "@/features/ai/use-ai";
import { AiPage } from "@/features/ai/ai-page";

export default function Page() {
  return (
    <AiProvider>
      <AiPage />
    </AiProvider>
  );
}
