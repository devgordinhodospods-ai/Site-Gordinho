"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, X, Eye, EyeOff } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { brlToCents, centsToBRL } from "@/lib/money";
import { FileInput } from "@/components/ui/FileInput";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HelpTip } from "@/components/ui/HelpTip";
import type { ProductWithFullFlavors, Category, ProductFlavor } from "@/lib/types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type FlavorForm = { id?: string; name: string; stock: string; image_url: string | null };

const EMPTY_FORM = {
  id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  cost: "",
  stock: "0",
  category_id: "",
  active: true,
  images: [] as string[],
  flavors: [] as FlavorForm[],
};

export function ProductsManager() {
  const [products, setProducts] = useState<ProductWithFullFlavors[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [uploadingFlavorIdx, setUploadingFlavorIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function load() {
    const [p, c] = await Promise.all([
      adminApi<{ products: ProductWithFullFlavors[] }>("listProducts"),
      adminApi<{ categories: Category[] }>("listCategories"),
    ]);
    setProducts(p.products);
    setCategories(c.categories);
  }

  useEffect(() => {
    load();
  }, []);

  function edit(product: ProductWithFullFlavors) {
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: (product.price_cents / 100).toString(),
      cost: product.cost_cents != null ? (product.cost_cents / 100).toString() : "",
      stock: product.stock.toString(),
      category_id: product.category_id ?? "",
      active: product.active,
      images: product.images ?? [],
      flavors: (product.product_flavors ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((f) => ({ id: f.id, name: f.name, stock: f.stock.toString(), image_url: f.image_url })),
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function uploadFile(file: File, folder: string) {
    const path = `${folder}/${Date.now()}-${slugify(file.name)}`;
    const { upload } = await adminApi<{ upload: { signedUrl: string; token: string; path: string } }>(
      "createUploadUrl",
      { path }
    );
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .uploadToSignedUrl(upload.path, upload.token, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("product-images").getPublicUrl(upload.path);
    return data.publicUrl;
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, "products");
      setForm((f) => ({ ...f, images: [...f.images, url] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFlavorImageUpload(file: File, index: number) {
    setUploadingFlavorIdx(index);
    setError(null);
    try {
      const url = await uploadFile(file, "flavors");
      setForm((f) => ({
        ...f,
        flavors: f.flavors.map((fl, i) => (i === index ? { ...fl, image_url: url } : fl)),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem do sabor.");
    } finally {
      setUploadingFlavorIdx(null);
    }
  }

  function addFlavor() {
    setForm((f) => ({ ...f, flavors: [...f.flavors, { name: "", stock: "0", image_url: null }] }));
  }

  function updateFlavor(index: number, patch: Partial<FlavorForm>) {
    setForm((f) => ({
      ...f,
      flavors: f.flavors.map((fl, i) => (i === index ? { ...fl, ...patch } : fl)),
    }));
  }

  function removeFlavor(index: number) {
    setForm((f) => ({ ...f, flavors: f.flavors.filter((_, i) => i !== index) }));
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
          cost_cents: form.cost ? brlToCents(Number(form.cost.replace(",", "."))) : null,
          stock: Number(form.stock),
          category_id: form.category_id || null,
          active: form.active,
          images: form.images,
        },
        flavors: form.flavors
          .filter((fl) => fl.name.trim())
          .map((fl) => ({ id: fl.id, name: fl.name.trim(), stock: Number(fl.stock) || 0, image_url: fl.image_url })),
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!(await confirm(`Tem certeza que deseja excluir o produto "${name}"? Essa ação não pode ser desfeita.`))) {
      return;
    }
    await adminApi("deleteProduct", { id });
    await load();
  }

  async function toggleActive(p: ProductWithFullFlavors) {
    await adminApi("saveProduct", { id: p.id, fields: { active: !p.active } });
    await load();
  }

  function totalStock(p: ProductWithFullFlavors) {
    const flavors = p.product_flavors ?? [];
    return flavors.length > 0 ? flavors.reduce((sum: number, f: ProductFlavor) => sum + f.stock, 0) : p.stock;
  }

  const margemPercent =
    form.price && form.cost && Number(form.price.replace(",", ".")) > 0
      ? ((Number(form.price.replace(",", ".")) - Number(form.cost.replace(",", "."))) /
          Number(form.price.replace(",", "."))) *
        100
      : null;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl text-slate-900">Produtos &amp; Sabores</h1>

      <form onSubmit={handleSubmit} className="card mb-8 grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Nome do produto
            <HelpTip text="O nome exibido pro cliente na loja, na página do produto e no carrinho." />
          </label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Slug (endereço na URL)
            <HelpTip text="Parte do link do produto (ex: /produtos/seu-slug-aqui). É gerado automaticamente a partir do nome, mas pode editar se quiser. Sem espaços ou acentos." />
          </label>
          <input
            className="input"
            placeholder="slug-do-produto"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Preço de venda (R$)
            <HelpTip text="O preço que o cliente vê e paga por esse produto." />
          </label>
          <input
            className="input"
            placeholder="0,00"
            required
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Valor de fornecimento / custo (R$)
            <HelpTip text="Quanto você pagou pra conseguir esse produto (custo do fornecedor). Usado só internamente pra calcular sua margem de lucro — o cliente nunca vê esse valor." />
          </label>
          <input
            className="input"
            placeholder="Opcional"
            inputMode="decimal"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
          />
        </div>

        {margemPercent != null && (
          <p className="text-sm font-bold text-brand md:col-span-2">
            Margem estimada: {margemPercent.toFixed(1)}%
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Estoque
            <HelpTip text="Quantas unidades você tem disponíveis pra vender. Esse campo é ignorado se o produto tiver sabores cadastrados abaixo — nesse caso, o estoque é o de cada sabor." />
          </label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Categoria
            <HelpTip text="Em qual categoria esse produto aparece na loja (ex: Pods, Essências). Pode deixar sem categoria se preferir." />
          </label>
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
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-bold text-slate-500">
            Descrição
            <HelpTip text="Texto que aparece na página do produto explicando detalhes pro cliente." />
          </label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-bold text-slate-700">
            Imagem principal
            <HelpTip text="Foto(s) do produto exibidas na loja. Pode adicionar mais de uma." />
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.images.map((url) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded border">
                <Image src={url} alt="" fill className="object-cover" />
              </div>
            ))}
          </div>
          <FileInput onFileSelected={handleImageUpload} disabled={uploading} label="Escolher imagem" />
        </div>

        <div className="card md:col-span-2 space-y-3 border-blue-100 bg-blue-50/40 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">
              Sabores (opcional — cada um com seu próprio estoque)
              <HelpTip text="Use quando o produto tem variações (ex: sabores de essência, cores). Cada sabor tem seu próprio estoque, descontado separadamente a cada venda. Se não cadastrar nenhum sabor, o produto usa o campo Estoque normal acima." />
            </label>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={addFlavor}>
              <Plus size={14} /> Adicionar sabor
            </button>
          </div>

          {form.flavors.length === 0 && (
            <p className="text-xs text-slate-500">
              Sem sabores cadastrados — o estoque do produto acima é usado diretamente.
            </p>
          )}

          {form.flavors.map((flavor, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
              {flavor.image_url && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={flavor.image_url} alt="" fill className="object-cover" />
                </div>
              )}
              <input
                className="input flex-1"
                placeholder="Nome do sabor"
                value={flavor.name}
                onChange={(e) => updateFlavor(index, { name: e.target.value })}
              />
              <input
                className="input w-24"
                type="number"
                min={0}
                placeholder="Estoque"
                value={flavor.stock}
                onChange={(e) => updateFlavor(index, { stock: e.target.value })}
              />
              <FileInput
                onFileSelected={(file) => handleFlavorImageUpload(file, index)}
                disabled={uploadingFlavorIdx === index}
                label="Imagem"
                className="shrink-0"
              />
              <button
                type="button"
                className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                onClick={() => removeFlavor(index)}
                aria-label="Remover sabor"
              >
                <X size={14} />
              </button>
            </div>
          ))}
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
          <div
            key={p.id}
            className={`card flex flex-wrap items-center justify-between gap-2 p-3 ${p.active ? "" : "bg-slate-50"}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100 ${p.active ? "" : "opacity-50"}`}>
                {p.images?.[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={p.active ? "text-slate-900" : "text-slate-500"}>{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.active ? "No ar" : "Fora do ar"}
                  </span>
                </p>
                <p className="text-sm text-slate-500">
                  {centsToBRL(p.price_cents)} ·{" "}
                  <span className={totalStock(p) <= 0 ? "text-red-600" : ""}>
                    {totalStock(p) <= 0 ? "sem estoque" : `estoque: ${totalStock(p)}`}
                  </span>
                  {(p.product_flavors?.length ?? 0) > 0 && ` (${p.product_flavors!.length} sabores)`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => edit(p)}>
                Editar
              </button>
              <button className="btn-secondary" onClick={() => toggleActive(p)}>
                {p.active ? <EyeOff size={16} /> : <Eye size={16} />}
                {p.active ? "Tirar do ar" : "Colocar no ar"}
              </button>
              <button className="btn-secondary text-red-600" onClick={() => handleDelete(p.id, p.name)}>
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
