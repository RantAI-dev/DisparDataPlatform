<script setup lang="ts">
/** Tombol ekspor dengan menu CSV/XLS/XLSX (atlas/ExportButton.tsx). Tutup saat klik di luar atau Esc. */
import type { ExportFormat } from "../../composables/useSpreadsheetExport";

const props = defineProps<{ onExport: (format: ExportFormat) => void | Promise<void>; label: string; disabled?: boolean }>();

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "csv", label: "CSV", hint: ".csv" },
  { id: "xls", label: "XLS", hint: ".xls" },
  { id: "xlsx", label: "XLSX", hint: ".xlsx" },
];

const open = ref(false);
const busy = ref<ExportFormat | null>(null);
const root = ref<HTMLDivElement | null>(null);

function onDown(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}
watch(open, (buka, _l, onCleanup) => {
  if (!buka) return;
  document.addEventListener("mousedown", onDown);
  document.addEventListener("keydown", onKey);
  onCleanup(() => {
    document.removeEventListener("mousedown", onDown);
    document.removeEventListener("keydown", onKey);
  });
});

async function handlePick(format: ExportFormat) {
  open.value = false;
  busy.value = format;
  try {
    await props.onExport(format);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      class="press-scale inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1.5 apple-caption-strong text-ink-muted-80 hover:text-[color:var(--accent)] hover:border-[color:var(--accent)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
      @click="!disabled && (open = !open)"
    >
      <svg v-if="busy" viewBox="0 0 24 24" class="h-3.5 w-3.5 animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 16 16" class="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 1.5v9" />
        <path d="M4.5 7L8 10.5 11.5 7" />
        <path d="M2 12.5v1A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-1" />
      </svg>
      <span>{{ label }}</span>
      <svg viewBox="0 0 24 24" :class="`h-3 w-3 text-ink-muted-48 transition-transform ${open ? 'rotate-180' : ''}`" aria-hidden="true">
        <path fill="currentColor" d="M7 10l5 5 5-5z" />
      </svg>
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute right-0 top-full mt-1.5 min-w-[156px] rounded-lg border border-hairline bg-canvas shadow-[0_8px_24px_rgba(15,23,42,0.10),0_2px_6px_rgba(15,23,42,0.05)] py-1 z-50"
    >
      <button
        v-for="f in FORMATS"
        :key="f.id"
        role="menuitem"
        :disabled="busy !== null"
        class="press-scale w-full flex items-center justify-between gap-3 px-3.5 py-2 apple-caption hover:bg-paper text-ink disabled:opacity-50 text-left"
        @click="handlePick(f.id)"
      >
        <span class="apple-caption-strong">{{ f.label }}</span>
        <span class="atlas-mono text-ink-muted-48 text-[10px]">{{ f.hint }}</span>
      </button>
    </div>
  </div>
</template>
