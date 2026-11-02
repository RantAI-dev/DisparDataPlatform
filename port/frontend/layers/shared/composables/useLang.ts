/**
 * Bahasa UI direktori restoran (Dashboard.tsx platform-v2): bawaan "id", pilihan disimpan di
 * localStorage `dpj.lang` dan dibaca setelah mount (hindari beda SSR). Tiap pemanggil punya
 * state sendiri, seperti useState di React.
 */
export function useLang() {
  const lang = ref<Lang>(DEFAULT_LANG);

  onMounted(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "id" || stored === "en") lang.value = stored;
    } catch {}
  });
  // <html lang> ikut bahasa aktif (aksesibilitas / SEO).
  watch(lang, (l) => {
    document.documentElement.lang = l;
  });

  const t = (key: string, vars?: Record<string, string | number>) => translate(lang.value, key, vars);

  const toggle = () => {
    const next: Lang = lang.value === "id" ? "en" : "id";
    lang.value = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  return { lang, t, toggle };
}
