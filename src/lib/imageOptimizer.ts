import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "product-images";
/** Acima disso a foto vale a pena ser recomprimida. */
const MIN_BYTES = 300 * 1024;
/**
 * Cache de 1 ano: usado nas fotos já otimizadas (por este código ou pelo
 * envio do painel, que já comprime) — serve de marca pra não baixar de novo.
 */
const OPTIMIZED_CACHE = "31536000";

export type ImageCandidate = { path: string; size: number };

/** Lista (recursivamente) as fotos do bucket que estão pesadas. */
export async function listHeavyImages(): Promise<ImageCandidate[]> {
  const db = getSupabaseAdmin();
  const found: ImageCandidate[] = [];
  const queue = [""];
  while (queue.length) {
    const prefix = queue.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        // Pasta não tem id nem metadata.
        if (!item.id) {
          queue.push(path);
          continue;
        }
        const size = Number(item.metadata?.size ?? 0);
        const type = String(item.metadata?.mimetype ?? "");
        const optimized = String(item.metadata?.cacheControl ?? "").includes(OPTIMIZED_CACHE);
        if (!optimized && size > MIN_BYTES && /^image\/(jpeg|jpg|png|webp|bmp|tiff|heic|heif|avif)$/i.test(type)) {
          found.push({ path, size });
        }
      }
      if (!data || data.length < 1000) break;
    }
  }
  return found;
}

/**
 * Recomprime fotos no mesmo endereço (o link salvo nos produtos não muda):
 * no máximo 1600px (banners e rodapé, 1920px), em WebP. Se não ficar pelo
 * menos 10% menor, regrava o original — só pra marcar como já otimizada.
 */
export async function optimizeImages(paths: string[]) {
  const db = getSupabaseAdmin();
  let before = 0;
  let after = 0;
  const failed: string[] = [];
  for (const path of paths) {
    try {
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error || !data) throw error ?? new Error("download vazio");
      const original = Buffer.from(await data.arrayBuffer());
      const wide = /^store\/(hero|footer)/.test(path);
      const max = wide ? 1920 : 1600;
      const output = await sharp(original, { failOn: "none" })
        .rotate() // aplica a rotação da câmera (EXIF) antes de tirar os metadados
        .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const smaller = output.length < original.length * 0.9;
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, smaller ? output : original, {
        upsert: true,
        contentType: smaller ? "image/webp" : data.type || "application/octet-stream",
        cacheControl: OPTIMIZED_CACHE,
      });
      if (upErr) throw upErr;
      before += original.length;
      after += smaller ? output.length : original.length;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[optimizeImages]", path, err instanceof Error ? err.message : err);
      failed.push(path);
    }
  }
  return { before, after, failed };
}
