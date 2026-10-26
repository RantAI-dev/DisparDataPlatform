// Stub `leaflet`: setiap properti dan pemanggilan menghasilkan stub yang sama, sehingga kode
// tingkat modul (mis. `L.Icon.Default.mergeOptions(...)`) tidak gagal di Node. Peta sendiri
// hanya dibuat di dalam effect, yang tidak dijalankan renderToStaticMarkup.
const stub = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "__esModule" ? false : stub),
  apply: () => stub,
  construct: () => stub,
  deleteProperty: () => true,
  set: () => true,
});
module.exports = stub;
