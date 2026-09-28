import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Category } from "@/lib/types";

export const CATEGORIES_TAG = "active-categories";

async function fetchActiveCategories(): Promise<Category[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("categories")
    .select("id, name, slug, image_url, position, active")
    .eq("active", true)
    .order("position");

  if (error || !data) return [];
  return data;
}

// Igual site_settings: lida em toda página (navbar) mas só muda quando o
// admin mexe em categorias — cacheia e invalida sob demanda em vez de
// consultar o banco a cada request.
const getCachedActiveCategories = unstable_cache(fetchActiveCategories, ["active-categories"], {
  tags: [CATEGORIES_TAG],
  revalidate: 60,
});

export async function getActiveCategories(): Promise<Category[]> {
  try {
    return await getCachedActiveCategories();
  } catch {
    return [];
  }
}
