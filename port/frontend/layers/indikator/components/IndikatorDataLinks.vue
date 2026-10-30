<script setup lang="ts">
/** Kartu dataset tematik per framework (components/FrameworkDataLinks.tsx); jumlah dari API. */
import { KARTU_DATASET } from "../constants";
import type { Framework } from "../composables/useIndikator";

const props = defineProps<{ framework: Framework }>();
const { datasetTematik } = useIndikator();
const { data } = await useAsyncData(`tematik-${props.framework}`, () => datasetTematik(props.framework));
</script>

<template>
  <section :aria-label="`Dataset ${framework}`" class="mx-auto max-w-[1320px] px-6 py-6">
    <h2 class="atlas-display-md text-ink">Dataset {{ framework }}</h2>
    <div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <NuxtLink
        v-for="s in data?.items ?? []"
        :key="s.href"
        :to="s.href"
        class="group utility-card press-scale flex flex-col p-6 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#ed6b23]/40"
      >
        <div class="flex items-start justify-between">
          <span class="atlas-mono text-ink-muted-48">{{ s.no }}</span>
          <span class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary" style="color: #ed6b23">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-colors group-hover:[color:#fff]"
              aria-hidden="true"
              v-html="KARTU_DATASET[s.href]?.icon"
            />
          </span>
        </div>
        <h3 class="mt-5 atlas-display-md text-ink">{{ s.title }}</h3>
        <p class="mt-2 apple-caption min-h-[54px] text-ink-muted-48">{{ KARTU_DATASET[s.href]?.description }}</p>
        <div class="mt-5 flex items-center justify-between border-t border-hairline pt-4">
          <span class="apple-caption-strong" style="color: #ed6b23">
            {{ s.total?.toLocaleString("id-ID") ?? "—" }} <span class="text-ink-muted-48">{{ KARTU_DATASET[s.href]?.unit }}</span>
          </span>
          <span class="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1" style="color: #ed6b23" aria-hidden="true">→</span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
