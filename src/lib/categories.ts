import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Category } from "@/lib/types";

export async function getActiveCategories(): Promise<Category[]> {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("categories")
      .select("id, name, slug, image_url, position, active")
      .eq("active", true)
      .order("position");

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
