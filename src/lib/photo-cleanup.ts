import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedPhotoPath, thumbPath, thumbUrl } from "@/lib/photos";

/**
 * A file may be reused by another product, a shelf (source_photo_url) or the shop avatar.
 * Delete only owner files that nothing references any more.
 */
export async function removeUnusedPhoto(supabase: SupabaseClient, url: string | null | undefined, owner: string) {
  const path = ownedPhotoPath(url, owner);
  if (!path || !url) return;
  const smallPath = thumbPath(path);
  const smallUrl = thumbUrl(url);
  const urls = [...new Set([url, smallUrl])];
  const [products, shelves, shops] = await Promise.all([
    supabase.from("products").select("photo_url").in("photo_url", urls),
    supabase.from("products").select("source_photo_url").in("source_photo_url", urls),
    supabase.from("shops").select("avatar_url").in("avatar_url", urls),
  ]);
  if (products.error || shelves.error || shops.error) throw new Error("Не удалось проверить использование фото");

  const used = new Set([
    ...products.data.map((product) => product.photo_url),
    ...shelves.data.map((product) => product.source_photo_url),
    ...shops.data.map((shop) => shop.avatar_url),
  ]);
  if (used.has(url)) return;
  const paths = smallPath !== path && !used.has(smallUrl) ? [path, smallPath] : [path];
  const { error } = await supabase.storage.from("product-photos").remove(paths);
  if (error) throw new Error("Не удалось удалить старое фото");
}
