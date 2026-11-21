import sharp from "sharp";
import type { BBox } from "@/lib/bbox";
import { THUMB_QUALITY, THUMB_WIDTH } from "@/lib/photos";

/**
 * Вырезки товаров из фото полки. Только сервер: sharp.
 * Каждая рамка расширяется на отступ и, насколько позволяет кадр, до квадрата; результат вписывается в 600×600
 * (без обрезки товара) и сохраняется как JPEG вместе с миниатюрой `_s.jpg` — так же, как обычные фото товаров.
 */

export const CROP_SIZE = 600;
const PAD = 0.06;
const BACKGROUND = { r: 255, g: 255, b: 255 };

export type Rect = { left: number; top: number; width: number; height: number };
export type Crop = { full: Buffer; thumb: Buffer };

/** Прямоугольник вырезки в пикселях: рамка + отступ, дополненная до квадрата в пределах кадра. */
export function cropRect(box: BBox, width: number, height: number, pad = PAD): Rect {
  const bw = (box.x2 - box.x1) * width;
  const bh = (box.y2 - box.y1) * height;
  const cx = ((box.x1 + box.x2) / 2) * width;
  const cy = ((box.y1 + box.y2) / 2) * height;
  const side = Math.max(bw, bh) * (1 + 2 * pad);
  const w = Math.max(1, Math.min(width, Math.round(side)));
  const h = Math.max(1, Math.min(height, Math.round(side)));
  const left = Math.round(Math.min(Math.max(cx - w / 2, 0), width - w));
  const top = Math.round(Math.min(Math.max(cy - h / 2, 0), height - h));
  return { left, top, width: w, height: h };
}

/** Режет фото полки по рамкам. Не удалась вырезка — на её месте null: товар покажет фото полки. */
export async function cropShelfPhoto(input: Buffer, boxes: BBox[]): Promise<(Crop | null)[]> {
  // Поворот по EXIF один раз: дальше рамки и пиксели в одной системе координат.
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
  return Promise.all(
    boxes.map(async (box) => {
      try {
        const region = sharp(data).extract(cropRect(box, info.width, info.height));
        const square = await region
          .resize(CROP_SIZE, CROP_SIZE, { fit: "contain", background: BACKGROUND, withoutEnlargement: false })
          .flatten({ background: BACKGROUND })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
        const thumb = await sharp(square).resize(THUMB_WIDTH).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toBuffer();
        return { full: square, thumb };
      } catch {
        return null;
      }
    }),
  );
}
