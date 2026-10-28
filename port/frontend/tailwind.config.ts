import type { Config } from "tailwindcss";

// Sementara (plan 10 potongan 1): diganti salinan persis platform-v2/tailwind.config.ts di potongan 5.
export default {
  content: ["./app/**/*.{vue,ts}", "./layers/**/*.{vue,ts}"],
} satisfies Config;
