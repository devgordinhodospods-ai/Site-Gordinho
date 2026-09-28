import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Category } from "@/lib/types";

export async function getActiveCategories(): Promise<Category[]> {
  try {
    const db = getSupabaseAdmin();
    // select("*") em vez de listar colunas: se o banco ainda não tiver a
    // coluna image_url (migração não rodada), a consulta não quebra.
    const { data, error } = await db
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("position");

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[getActiveCategories]", error.message);
      return [];
    }
    return (data ?? []).map((c) => ({ ...c, image_url: c.image_url ?? null }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[getActiveCategories]", err);
    return [];
  }
}
