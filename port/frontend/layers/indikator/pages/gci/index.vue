<script setup lang="ts">
/** /gci (app/gci/page.tsx): GciOfficial + dataset GCI + kesiapan data indikator GCI. */
import { JUDUL_FRAMEWORK } from "../../constants";

const { gciResmi, daftar } = useIndikator();
const [{ data: resmi }, { data }] = await Promise.all([useAsyncData("gci-resmi", () => gciResmi()), useAsyncData("indikator-gci", () => daftar("GCI"))]);
</script>

<template>
  <IndikatorGciOfficial v-if="resmi" :data="resmi" />
  <IndikatorDataLinks framework="GCI" />
  <IndikatorFrameworkView v-if="data" v-bind="JUDUL_FRAMEWORK.GCI" :data="data" />
  <p v-else role="status" class="mx-auto max-w-[1320px] px-6 py-6">Memuat kesiapan data GCI…</p>
</template>
