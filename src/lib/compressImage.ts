/**
 * Reduz uma foto no navegador antes de mandar pro Supabase: no máximo
 * `maxSize` px no lado maior, em WebP (ou JPEG, se o navegador não gerar
 * WebP). Foto de celular de vários MB vira algumas centenas de KB — é o
 * tráfego dessas fotos que conta na cota do Supabase.
 *
 * GIF e SVG passam direto (animação/vetor), e se não der pra comprimir ou o
 * resultado ficar maior, manda o arquivo original.
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|jpg|png|webp|bmp|heic|heif)$/i.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato que o navegador não abre (ex.: HEIC fora do Safari)
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp");
  // Navegador sem WebP devolve PNG: aí tenta JPEG, a não ser que a imagem
  // original tenha transparência (logo em PNG), que o JPEG estragaria.
  if (blob?.type !== "image/webp") {
    blob = file.type === "image/png" ? blob : await toBlob("image/jpeg");
  }
  if (!blob || blob.size >= file.size) return file;

  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
  const name = `${file.name.replace(/\.[^.]+$/, "") || "imagem"}.${ext}`;
  return new File([blob], name, { type: blob.type });
}
