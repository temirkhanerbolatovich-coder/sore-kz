import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_TYPES, THUMB_QUALITY, THUMB_WIDTH, thumbPath } from "@/lib/photos";

function decodeImage(file: File): Promise<ImageBitmap> {
  if (!PHOTO_TYPES.includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error("Выберите JPEG, PNG или WebP до 20 МБ.");
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function encodeJpeg(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", quality),
  );
}

/** Уменьшает фото до max px по длинной стороне и сжимает в JPEG прямо на телефоне. */
export async function compressImage(file: File, max = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await decodeImage(file);
  try {
    return await encodeJpeg(bitmap, max, quality);
  } finally {
    bitmap.close();
  }
}

/** Загружает полноразмерное фото и миниатюру и возвращает URL полноразмерного фото. */
export async function uploadProductPhoto(supabase: SupabaseClient, owner: string, file: File): Promise<string> {
  const bitmap = await decodeImage(file);
  let original: Blob;
  let thumbnail: Blob;
  try {
    [original, thumbnail] = await Promise.all([
      encodeJpeg(bitmap, 1200, 0.82),
      encodeJpeg(bitmap, THUMB_WIDTH, THUMB_QUALITY / 100),
    ]);
  } finally {
    bitmap.close();
  }

  const path = `${owner}/${crypto.randomUUID()}.jpg`;
  const small = thumbPath(path);
  const bucket = supabase.storage.from("product-photos");
  const options = { contentType: "image/jpeg", cacheControl: "31536000" };
  const uploaded = await bucket.upload(path, original, options);
  if (uploaded.error) throw uploaded.error;

  try {
    const uploadedThumbnail = await bucket.upload(small, thumbnail, options);
    if (uploadedThumbnail.error) throw uploadedThumbnail.error;
  } catch (error) {
    // The product never references a partial upload. A best-effort removal also covers a lost response.
    await bucket.remove([path, small]).catch(() => undefined);
    throw error;
  }
  return bucket.getPublicUrl(path).data.publicUrl;
}
