/**
 * Callout catatan kriteria — penyesuaian yang belum tercermin di data mentah. Tema oranye (branding enjoy.jakarta).
 */
export function MomNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#f4a06b] bg-[#fff4ec] p-4 flex gap-3">
      <span className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#ed6b23] rounded px-2 py-1 h-fit">
        Catatan kriteria
      </span>
      <div className="text-[13px] text-[#4a453d] leading-relaxed">{children}</div>
    </div>
  );
}
