export function Loader({
  size = 40,
  color = "#1d4ed8",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`loader-ring ${className}`}
      style={{
        ["--loader-size" as string]: `${size}px`,
        borderTopColor: color,
      }}
      role="status"
      aria-label="Carregando"
    />
  );
}

export function LoaderDots({ className = "" }: { className?: string }) {
  return (
    <span className={`loader-dots ${className}`} role="status" aria-label="Carregando">
      <span />
      <span />
      <span />
    </span>
  );
}

export function LoaderPage({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Loader size={36} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
