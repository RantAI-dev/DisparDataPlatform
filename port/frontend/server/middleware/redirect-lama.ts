// Menjalankan tujuanRedirect (server/utils/redirect-lama.ts) untuk setiap request halaman.
export default defineEventHandler((event) => {
  const hasil = tujuanRedirect(getRequestURL(event).pathname);
  if (hasil === null) return;
  if (hasil.status === 404) {
    throw createError({ statusCode: 404, statusMessage: "Page Not Found" });
  }
  return sendRedirect(event, hasil.lokasi, hasil.status);
});
