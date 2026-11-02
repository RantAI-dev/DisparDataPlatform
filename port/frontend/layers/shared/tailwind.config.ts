import type { Config } from "tailwindcss";

// Salinan platform-v2/tailwind.config.ts @ 6b858eb; hanya `content` diganti ke berkas Vue (SPEC §5.2).
// Path relatif terhadap frontend/ (cwd build). `navy` memang alias oranye, sisa re-theme.
export default {
  content: [
    "./app/**/*.{vue,ts}",
    "./layers/**/*.{vue,ts}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#ed6b23", deep: "#c9531a" }, orange: { DEFAULT: "#ed6b23", deep: "#c9531a", soft: "#f4a06b" },
        gold: "#f0a13a",
        civic: "#0e7c42",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
