export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null;

  return (
    <div
      className="py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
      style={{ background: "linear-gradient(90deg, #0f2f8f, #1d4ed8)" }}
    >
      {text}
    </div>
  );
}
