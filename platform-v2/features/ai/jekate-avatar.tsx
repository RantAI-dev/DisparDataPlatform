/**
 * Avatar Jekate — maskot macan oranye asisten AI dispar-v2.
 * Gambar di public/jekate.png (256px, transparan) dan jekate-96.png untuk ukuran kecil.
 */
export const AI_NAME = "Jekate";

export function JekateAvatar({ size = 32, className }: { size?: number; className?: string }) {
  const src = size <= 48 ? "/jekate-96.png" : "/jekate.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
      draggable={false}
    />
  );
}
