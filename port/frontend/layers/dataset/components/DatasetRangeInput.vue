<script setup lang="ts">
/** Rentang min–maks (DatasetFilters.tsx RangeInput); diterapkan 500 ms setelah berhenti mengetik. */
import type { Facet } from "../composables/useDataset";

const props = defineProps<{ kind: "angka" | "tanggal"; facet: Facet; value: { min: string; max: string } | null }>();
const emit = defineEmits<{ ubah: [min: string, max: string] }>();

const min = ref(props.value?.min ?? "");
const max = ref(props.value?.max ?? "");

// Ikuti perubahan dari luar (chip dihapus / "Hapus semua").
watch(
  () => [props.value?.min, props.value?.max],
  ([a, b]) => {
    min.value = a ?? "";
    max.value = b ?? "";
  },
);

let tunda: ReturnType<typeof setTimeout> | undefined;
watch([min, max], ([a, b]) => {
  clearTimeout(tunda);
  if (a === (props.value?.min ?? "") && b === (props.value?.max ?? "")) return;
  tunda = setTimeout(() => emit("ubah", a.trim(), b.trim()), 500);
});
onBeforeUnmount(() => clearTimeout(tunda));

const type = computed(() => (props.kind === "tanggal" ? "date" : "number"));
const lo = computed(() => (props.kind === "tanggal" ? props.facet.min?.slice(0, 10) : props.facet.min));
const hi = computed(() => (props.kind === "tanggal" ? props.facet.max?.slice(0, 10) : props.facet.max));
const nama = computed(() => humanizeKolom(props.facet.key));
const cls =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] focus:border-[#ed6b23] focus-visible:ring-2 focus-visible:ring-[#ed6b23]/40";
</script>

<template>
  <div class="flex items-center gap-2">
    <label :for="`f-${facet.key}-min`" class="sr-only">{{ nama }} minimum</label>
    <input
      :id="`f-${facet.key}-min`"
      v-model="min"
      :aria-label="`${nama} minimum`"
      :type="type"
      :placeholder="lo ? `min ${lo}` : 'min'"
      :min="lo"
      :max="hi"
      :class="cls"
    />
    <span aria-hidden="true" class="text-slate-400">–</span>
    <label :for="`f-${facet.key}-max`" class="sr-only">{{ nama }} maksimum</label>
    <input
      :id="`f-${facet.key}-max`"
      v-model="max"
      :aria-label="`${nama} maksimum`"
      :type="type"
      :placeholder="hi ? `maks ${hi}` : 'maks'"
      :min="lo"
      :max="hi"
      :class="cls"
    />
  </div>
</template>
