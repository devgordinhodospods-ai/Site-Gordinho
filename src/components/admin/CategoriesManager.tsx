"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { FileInput } from "@/components/ui/FileInput";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HelpTip } from "@/components/ui/HelpTip";
import type { Category } from "@/lib/types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function load() {
    const { categories } = await adminApi<{ categories: Category[] }>("listCategories");
    setCategories(categories);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = `categories/${Date.now()}-${slugify(file.name)}`;
      const { upload } = await adminApi<{ upload: { path: string; token: string } }>(
        "createUploadUrl",
        { path }
      );
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(upload.path, upload.token, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(upload.path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi("saveCategory", {
        fields: {
          name,
          slug: slugify(name),
          image_url: imageUrl,
          position: categories.length,
          active: true,
        },
      });
      setName("");
      setImageUrl(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  }

  async function toggleActive(cat: Category) {
    await adminApi("saveCategory", { id: cat.id, fields: { active: !cat.active } });
    await load();
  }

  async function handleDelete(id: string, name: string) {
    if (!(await confirm(`Tem certeza que deseja excluir a categoria "${name}"? Essa ação não pode ser desfeita.`))) {
      return;
    }
    await adminApi("deleteCategory", { id });
    await load();
  }

  return (
    <div>
      <h1 className="font-display mb-2 text-2xl text-slate-900">Categorias</h1>
      <p className="mb-6 text-sm text-slate-500">
        A imagem de capa aparece na vitrine &ldquo;Compre por categoria&rdquo; da home.
      </p>

      <form onSubmit={handleAdd} className="card mb-6 space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Nome da categoria
            <HelpTip text="Como a categoria aparece pro cliente na loja (ex: Pods, Essências, Acessórios). Produtos são agrupados por categoria no filtro e na home." />
          </label>
          <div className="flex gap-2">
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Adicionar
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Imagem de capa
            <HelpTip text="Foto que representa a categoria na vitrine “Compre por categoria” da home. Opcional." />
          </label>
          <div className="flex items-center gap-3">
            {imageUrl && (
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-blue-100">
                <Image src={imageUrl} alt="" fill className="object-cover" />
              </div>
            )}
            <FileInput onFileSelected={handleImageUpload} disabled={uploading} label="Escolher imagem" />
          </div>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                {c.image_url && <Image src={c.image_url} alt="" fill className="object-cover" />}
              </div>
              <span>
                {c.name} {!c.active && <span className="text-xs text-slate-400">(oculta)</span>}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => toggleActive(c)}>
                {c.active ? "Ocultar" : "Mostrar"}
              </button>
              <button className="btn-secondary text-red-600" onClick={() => handleDelete(c.id, c.name)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
      {dialog}
    </div>
  );
}
