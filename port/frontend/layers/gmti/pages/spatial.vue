<script setup lang="ts">
/**
 * /spatial (GmtiMapView, client-only). Titik ringkas + kepadatan dari `spasial` (kelas T); detail
 * popup dari `spasial/titik/{id}`. Kecamatan tanpa poligon diambil dari ringkasan GMTI. Sumber yang
 * gagal (`complete: false`) tampil sebagai peringatan dengan "Coba lagi".
 */
import type { SpasialDetail } from "../../shared/components/map/SpatialMap.vue";

const { spasial, titik, ringkasan } = useGmti();
const { data, pending, error, refresh } = useLazyAsyncData("spasial", () => Promise.all([spasial(), ringkasan()]), { server: false });
const errors = computed(() => {
  // Teks sama dengan GmtiMapView v2.
  if (error.value) return ["Titik lakehouse belum dapat dimuat."];
  return data.value && !data.value[0].complete ? ["Sebagian dataset lakehouse gagal dimuat."] : [];
});
const muatDetail = (id: string) => titik(id) as Promise<SpasialDetail>;
</script>

<template>
  <SpatialMap
    :points="data?.[0].points ?? []"
    :cities="data?.[0].cities ?? []"
    :kepadatan-berkoordinat="data?.[0].kepadatan_berkoordinat ?? {}"
    :kepadatan-tanpa-koordinat="data?.[0].kepadatan_tanpa_koordinat ?? {}"
    :kecamatan-tanpa-poligon="data?.[1].meta.kecamatan_tanpa_poligon ?? []"
    :loading="pending"
    :errors="errors"
    :muat-detail="muatDetail"
    @muat-ulang="refresh()"
  />
</template>
