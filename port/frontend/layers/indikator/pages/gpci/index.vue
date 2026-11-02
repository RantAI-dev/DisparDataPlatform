<script setup lang="ts">
/** /gpci (app/gpci/page.tsx): kesiapan data indikator GPCI dengan dataset GPCI setelah header. */
import { JUDUL_FRAMEWORK } from "../../constants";

const { daftar } = useIndikator();
const { data } = await useAsyncData("indikator-gpci", () => daftar("GPCI"));
</script>

<template>
  <IndikatorFrameworkView v-if="data" v-bind="JUDUL_FRAMEWORK.GPCI" :data="data">
    <template #setelah-header><IndikatorDataLinks framework="GPCI" /></template>
  </IndikatorFrameworkView>
  <template v-else>
    <IndikatorFrameworkHeader v-bind="JUDUL_FRAMEWORK.GPCI" />
    <IndikatorDataLinks framework="GPCI" />
    <p role="status" class="mx-auto max-w-[1320px] px-6 py-6">Memuat kesiapan data GPCI…</p>
  </template>
</template>
