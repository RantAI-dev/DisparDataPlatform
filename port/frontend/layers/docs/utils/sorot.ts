/** Sorotan sintaks ringan (app/docs/docs-client.tsx v2): escape dulu, lalu regex. */
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sorotJson(code: string) {
  return esc(code)
    .replace(/"([^"]*)"(\s*:)/g, "<span class='tok-key'>\"$1\"</span>$2")
    .replace(/:(\s*)"([^"]*)"/g, ":$1<span class='tok-str'>\"$2\"</span>")
    .replace(/\[(\s*)"([^"]*)"/g, "[$1<span class='tok-str'>\"$2\"</span>")
    .replace(/,(\s*)"([^"]*)"(?!\s*:)/g, ",$1<span class='tok-str'>\"$2\"</span>")
    .replace(/: (-?\d[\d.]*)/g, ": <span class='tok-num'>$1</span>")
    .replace(/\b(true|false|null)\b/g, "<span class='tok-num'>$1</span>");
}

export function sorotShell(code: string) {
  return esc(code)
    .replace(/^curl/gm, "<span class='tok-cmd'>curl</span>")
    .replace(/ (-[A-Za-z]+|--[a-z-]+)/g, " <span class='tok-flag'>$1</span>")
    .replace(/"([^"]*)"/g, "<span class='tok-str'>\"$1\"</span>")
    .replace(/\$[A-Z_]+/g, "<span class='tok-num'>$&</span>")
    .replace(/(https?:\/\/[^\s"'<]+)/g, "<span class='tok-url'>$1</span>");
}

export function sorotHttp(code: string) {
  return esc(code)
    .replace(/^(HTTP\/[\d.]+) (\d+) (.*)$/m, "<span class='tok-cmd'>$1</span> <span class='tok-num'>$2 $3</span>")
    .replace(/^([A-Za-z-]+):/gm, "<span class='tok-key'>$1</span>:");
}

/** `kode` dalam teks deskripsi → <code>, setelah di-escape. */
export function kodeSebaris(teks: string) {
  return esc(teks).replace(/`([^`]+)`/g, "<code class='text-[13px]' style='font-family: var(--font-mono)'>$1</code>");
}
