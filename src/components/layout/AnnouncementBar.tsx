export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null;

  return (
    <div
      className="px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#04121f] sm:text-xs"
      style={{ background: "linear-gradient(90deg, #22d3ee 0%, #38bdf8 50%, #0ea5e9 100%)" }}
    >
      {text}
    </div>
  );
}
