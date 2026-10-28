<script setup lang="ts">
/**
 * Kartu pembungkus grafik dengan tombol "Perbesar grafik" + modal layar penuh
 * (ExpandableChartCard di ChartExpand.tsx, dipakai lewat ChartCard di DashboardKit.tsx).
 * Slot dirender ulang di dalam modal dengan konteks diperbesar.
 */
import { ChartExpandedProvider } from "../../composables/useChartExpanded";

// `class` dari pemanggil digabung Vue ke div akar (setelah kelas bawaan), sama dengan v2.
defineProps<{ title: string; sub?: string }>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const closeRef = ref<HTMLButtonElement | null>(null);
const dialogRef = ref<HTMLDivElement | null>(null);

function close() {
  open.value = false;
  triggerRef.value?.focus();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
    return;
  }
  if (e.key === "Tab" && dialogRef.value) {
    const f = dialogRef.value.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    const active = document.activeElement;
    // Fokus di luar dialog (mis. body setelah klik canvas): tarik kembali ke dalam.
    const outside = !dialogRef.value.contains(active);
    if (e.shiftKey && (active === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  }
}

watch(open, (buka, _lama, onCleanup) => {
  if (!buka) return;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  // Pastikan instance ECharts mengukur ulang setelah modal tampil.
  const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  document.addEventListener("keydown", onKey, true);
  nextTick(() => closeRef.value?.focus());
  onCleanup(() => {
    document.body.style.overflow = prevOverflow;
    window.clearTimeout(t);
    document.removeEventListener("keydown", onKey, true);
  });
});
</script>

<template>
  <div class="utility-card relative p-5 transition-shadow hover:shadow-md">
    <button
      ref="triggerRef"
      type="button"
      aria-label="Perbesar grafik"
      title="Perbesar grafik"
      class="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted-48 transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ed6b23]"
      @click="open = true"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
      </svg>
    </button>
    <div class="mb-3 border-l-2 pl-2.5 pr-8" style="border-color: #ed6b23">
      <div class="text-[14px] font-semibold text-ink">{{ title }}</div>
      <div v-if="sub" class="apple-fine text-ink-muted-48">{{ sub }}</div>
    </div>
    <slot />

    <Teleport v-if="open" to="body">
      <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 sm:p-6" @mousedown.self="close">
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          :aria-label="`${title} (diperbesar)`"
          tabindex="-1"
          class="relative flex max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          style="height: min(92vh, 860px)"
        >
          <div class="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div class="border-l-2 pl-2.5" style="border-color: #ed6b23">
              <div class="text-[16px] font-semibold text-ink">{{ title }}</div>
              <div v-if="sub" class="apple-fine text-ink-muted-48">{{ sub }}</div>
            </div>
            <button
              ref="closeRef"
              type="button"
              aria-label="Tutup"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[18px] leading-none text-ink-muted-48 transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ed6b23]"
              @click="close"
            >
              ✕
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-auto p-5">
            <ChartExpandedProvider><slot /></ChartExpandedProvider>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
