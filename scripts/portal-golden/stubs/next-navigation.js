// Stub `next/navigation` untuk render di luar app router Next.js. Navigasi hanya dipakai
// pada interaksi (klik), yang tidak terjadi saat render statis; nilai baca dibuat netral.
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
module.exports = {
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  notFound: () => { throw new Error("notFound() dipanggil saat render golden"); },
  redirect: (url) => { throw new Error(`redirect(${url}) dipanggil saat render golden`); },
};
