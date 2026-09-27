"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { brlToCents, centsToBRL } from "@/lib/money";
import type { Product, Category } from "@/lib/types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EMPTY_FORM = {
  id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  stock: "0",
  category_id: "",
  active: true,
  images: [] as string[],
};

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [p, c] = await Promise.all([
      adminApi<{ products: Product[] }>("listProducts"),
      adminApi<{ categories: Category[] }>("listCategories"),
    ]);
    setProducts(p.products);
    setCategories(c.categories);
  }

  useEffect(() => {
    load();
  }, []);

  function edit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: (product.price_cents / 100).toString(),
      stock: product.stock.toString(),
      category_id: product.category_id ?? "",
      active: product.active,
      images: product.images ?? [],
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const path = `products/${Date.now()}-${slugify(file.name)}`;
      const { upload } = await adminApi<{ upload: { signedUrl: string; token: string; path: string } }>(
        "createUploadUrl",
        { path }
      );

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .uploadToSignedUrl(upload.path, upload.token, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(upload.path);
      setForm((f) => ({ ...f, images: [...f.images, data.publicUrl] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await adminApi("saveProduct", {
        id: form.id || undefined,
        fields: {
          name: form.name,
          slug: form.slug || slugify(form.name),
          description: form.description,
          price_cents: brlToCents(Number(form.price.replace(",", "."))),
          stock: Number(form.stock),
          category_id: form.category_id || null,
          active: form.active,
          images: form.images,
        },
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto?")) return;
    await adminApi("deleteProduct", { id });
    await load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Produtos</h1>

      <form onSubmit={handleSubmit} className="card mb-8 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="input"
          placeholder="Nome do produto"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })}
        />
        <input
          className="input"
          placeholder="slug-do-produto"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
        />
        <input
          className="input"
          placeholder="Preço (R$)"
          required
          inputMode="decimal"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          className="input"
          placeholder="Estoque"
          type="number"
          min={0}
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
        />
        <select
          className="input"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Ativo (visível na loja)
        </label>
        <textarea
          className="input md:col-span-2"
          placeholder="Descrição"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Imagens</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.images.map((url) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded border">
                <Image src={url} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />
          {uploading && <span className="ml-2 text-sm text-neutral-500">Enviando...</span>}
        </div>

        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : form.id ? "Atualizar produto" : "Criar produto"}
          </button>
          {form.id && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="card flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded bg-neutral-100">
                {p.images?.[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
              </div>
              <div>
                <p className="font-medium">
                  {p.name} {!p.active && <span className="text-xs text-neutral-400">(inativo)</span>}
                </p>
                <p className="text-sm text-neutral-500">
                  {centsToBRL(p.price_cents)} · estoque: {p.stock}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => edit(p)}>
                Editar
              </button>
              <button className="btn-secondary text-red-600" onClick={() => handleDelete(p.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
