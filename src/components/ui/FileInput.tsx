"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export function FileInput({
  onFileSelected,
  disabled,
  label = "Escolher imagem",
  accept = "image/*",
  className = "",
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  label?: string;
  accept?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Upload size={14} /> {label}
      </button>
      <span className="truncate text-xs text-slate-500">
        {disabled ? "Enviando..." : (fileName ?? "Nenhum arquivo selecionado")}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setFileName(file.name);
            onFileSelected(file);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
