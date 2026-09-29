"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Pencil, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { HelpTip } from "@/components/ui/HelpTip";
import { Pagination } from "@/components/ui/Pagination";
import type { Category } from "@/lib/types";

const PAGE_SIZE = 15;

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { confirm, dialog } = useConfirm();

  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCategories = categories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function load() {
    const { categories } = await adminApi<{ categories: Category[] }>("listCategories");
    setCategories(categories);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi("saveCategory", {
        fields: { name: name.trim(), slug: slugify(name), position: categories.length, active: true },
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  }

  async function handleRename(cat: Category) {
    const newName = editingName.trim();
    if (!newName || newName === cat.name) {
      setEditingId(null);
      return;
    }
    setError(null);
    try {
      // O slug (endereço da categoria) não muda, pra não quebrar links já compartilhados.
      await adminApi("saveCategory", { id: cat.id, fields: { name: newName } });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao renomear categoria.");
    }
  }

  async function toggleActive(cat: Category) {
    await adminApi("saveCategory", { id: cat.id, fields: { active: !cat.active } });
    await load();
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm(
      `Os produtos dessa categoria continuam na loja, só ficam sem categoria. Essa ação não pode ser desfeita.`,
      { title: `Excluir a categoria "${name}"?` },
    );
    if (!ok) return;
    await adminApi("deleteCategory", { id });
    await load();
  }

  return (
    <div>
      <h1 className="font-display mb-1 text-2xl text-slate-900">Categorias</h1>
      <p className="mb-6 text-sm text-slate-500">
        Viram os filtros da vitrine (ex: Pod, Essência). Categoria oculta some da loja, mas os produtos continuam
        aparecendo em &ldquo;Todos&rdquo;.
      </p>

      <form onSubmit={handleAdd} className="card mb-6 p-4">
        <label className="mb-1 block text-xs text-slate-500">
          Nova categoria
          <HelpTip text="Como a categoria aparece pro cliente nos filtros da loja (ex: Pod, Essência, Acessórios)." />
        </label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Nome da categoria"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn-primary whitespace-nowrap">
            Adicionar
          </button>
        </div>
      </form>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {categories.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <>
          <div className="card divide-y divide-blue-50">
            {pageCategories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                {editingId === c.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename(c);
                    }}
                  >
                    <input
                      className="input py-2"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <button type="submit" className="btn-primary px-3 py-2" aria-label="Salvar nome">
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="flex items-center gap-2">
                      <span className={c.active ? "text-slate-900" : "text-slate-400"}>{c.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          c.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {c.active ? "Visível" : "Oculta"}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary px-3 py-2"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                      >
                        <Pencil size={15} /> Renomear
                      </button>
                      <button className="btn-secondary px-3 py-2" onClick={() => toggleActive(c)}>
                        {c.active ? <EyeOff size={15} /> : <Eye size={15} />}
                        {c.active ? "Ocultar" : "Mostrar"}
                      </button>
                      <button
                        className="btn-secondary px-3 py-2 text-red-600"
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} scrollTarget={null} />
        </>
      )}
      {dialog}
    </div>
  );
}
