"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
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
  const [error, setError] = useState<string | null>(null);

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
        fields: { name, slug: slugify(name), position: categories.length, active: true },
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  }

  async function toggleActive(cat: Category) {
    await adminApi("saveCategory", { id: cat.id, fields: { active: !cat.active } });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta categoria?")) return;
    await adminApi("deleteCategory", { id });
    await load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Categorias</h1>

      <form onSubmit={handleAdd} className="card mb-6 flex gap-2 p-4">
        <input
          className="input"
          placeholder="Nome da categoria"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Adicionar
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3">
            <span>
              {c.name} {!c.active && <span className="text-xs text-neutral-400">(oculta)</span>}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => toggleActive(c)}>
                {c.active ? "Ocultar" : "Mostrar"}
              </button>
              <button className="btn-secondary text-red-600" onClick={() => handleDelete(c.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
