import { expect, test } from "vitest";
import { ownedPhotoPath, thumbPath, thumbUrl } from "@/lib/photos";

const base = "https://project.supabase.co";
const root = `${base}/storage/v1/object/public/product-photos`;

test("ownedPhotoPath принимает исходное фото и миниатюру только в папке владельца", () => {
  for (const file of ["image.jpg", "image_s.jpg", "image.jpeg", "image.png", "image.webp"]) {
    expect(ownedPhotoPath(`${root}/owner/${file}`, "owner", base)).toBe(`owner/${file}`);
  }
  for (const url of [
    `${root}/another-owner/image.jpg`,
    `${root}/owner/../another-owner/image.jpg`,
    `${root}/owner/%2e%2e/image.jpg`,
    `${root}/owner/image.svg`,
    `${root}/owner/image.jpg.exe`,
    `${root}/owner/image.jpg?query=changed`,
    `${root.replace("supabase.co", "supabase.co.other.example")}/owner/image.jpg`,
  ]) {
    expect(ownedPhotoPath(url, "owner", base)).toBeNull();
  }
});

test("миниатюра получает суффикс _s и расширение JPEG, демо и уже уменьшенные фото сохраняют адрес", () => {
  for (const extension of ["jpg", "jpeg", "png", "webp"]) {
    expect(thumbPath(`owner/image-42.${extension}`)).toBe("owner/image-42_s.jpg");
    expect(thumbUrl(`${root}/owner/image-42.${extension}`)).toBe(`${root}/owner/image-42_s.jpg`);
  }
  expect(thumbUrl(`${root}/owner/image-42_s.jpg`)).toBe(`${root}/owner/image-42_s.jpg`);
  expect(thumbUrl(`${root}/owner/image-42.webp?a=1#preview`)).toBe(`${root}/owner/image-42_s.jpg?a=1#preview`);
  expect(thumbUrl("/demo/prague.svg")).toBe("/demo/prague.svg");
  expect(thumbUrl("https://example.test/direct.jpg")).toBe("https://example.test/direct.jpg");
});
