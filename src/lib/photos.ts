const PUBLIC_PHOTO_PREFIX = "/storage/v1/object/public/product-photos/";
const PHOTO_FILE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

/** Accept only canonical files in this owner's folder, never URL traversal or another origin. */
export function ownedPhotoPath(url: unknown, owner: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (typeof url !== "string" || !base) return null;
  const prefix = `${base.replace(/\/$/, "")}${PUBLIC_PHOTO_PREFIX}${owner}/`;
  if (!url.startsWith(prefix)) return null;
  const file = url.slice(prefix.length);
  if (!PHOTO_FILE.test(file)) return null;
  return `${owner}/${file}`;
}

/** Map a canonical owner/file path to its sibling thumbnail. */
export function thumbPath(path: string): string {
  const [owner, file, nested] = path.split("/");
  if (!owner || nested !== undefined || !file || !PHOTO_FILE.test(file) || file.endsWith("_s.jpg")) return path;
  return `${owner}/${file.slice(0, file.lastIndexOf("."))}_s.jpg`;
}

export function thumbUrl(url: string): string {
  if (!URL.canParse(url)) return url;
  const image = new URL(url);
  if (!image.pathname.startsWith(PUBLIC_PHOTO_PREFIX)) return url;
  const path = image.pathname.slice(PUBLIC_PHOTO_PREFIX.length);
  const thumbnail = thumbPath(path);
  if (thumbnail === path) return url;
  image.pathname = `${PUBLIC_PHOTO_PREFIX}${thumbnail}`;
  return image.href;
}

export const THUMB_WIDTH = 480;
export const THUMB_QUALITY = 78;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
