<script setup lang="ts">
/**
 * Galeri sementara SpatialMap (dihapus di plan 17) dengan titik statis golden plan 01. Kepadatan
 * dihitung di browser khusus galeri; titik di halaman sungguhan datang dari /v1/spasial.
 */
import type { SpasialDetail, SpasialTitik } from "../../../layers/shared/components/map/SpatialMap.vue";
import { hitungKepadatan } from "../../kerangka/kepadatan";

useHead({ title: "Kerangka · SpatialMap", meta: [{ name: "robots", content: "noindex" }] });

const titik = shallowRef<SpasialTitik[]>([]);
const kepadatan = shallowRef<Record<string, { total: number; byCat: Partial<Record<SpatialCategory, number>> }>>({});
const loading = ref(true);
let detail = new Map<string, SpasialDetail>();

onMounted(async () => {
  const [g, geo] = await Promise.all([
    import("../../kerangka/golden/spasial.statis.json").then((m) => m.default),
    fetch("/geo/dki-jakarta.geojson").then((r) => r.json()),
  ]);
  const semua = g.points as SpasialDetail[];
  detail = new Map(semua.map((p) => [p.id, p]));
  titik.value = semua.map(({ address: _a, cert: _c, ...ringkas }) => ringkas);
  kepadatan.value = hitungKepadatan(semua, geo.features);
  loading.value = false;
});

const kota = computed(() => [...new Set(titik.value.map((p) => p.city).filter(Boolean))].sort());
// Tunda kecil supaya popup "ringkas → detail" terlihat seperti panggilan API sungguhan.
const muatDetail = (id: string) => new Promise<SpasialDetail>((ok) => setTimeout(() => ok(detail.get(id)!), 150));
</script>

<template>
  <SpatialMap
    :points="titik"
    :cities="kota"
    :kepadatan-berkoordinat="kepadatan"
    :kepadatan-tanpa-koordinat="{}"
    :kecamatan-tanpa-poligon="['Kepulauan Seribu Utara', 'Kepulauan Seribu Selatan']"
    :loading="loading"
    :muat-detail="muatDetail"
  />
</template>
