import { ViewTransition } from "react";
import { ThumbnailImage } from "@/components/thumbnail-image";
import { thumbUrl } from "@/lib/photos";

const TINTS = ["var(--thumb)", "var(--thumb-2)", "var(--thumb-3)", "var(--thumb-4)", "var(--thumb-5)", "var(--thumb-6)"];

/** Устойчивый номер оттенка по названию: у соседних товаров без фото заглушки разного цвета, но у одного товара всегда одинаковая. */
function tintOf(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Фото товара или цветная заглушка с первой буквой названия, если фото нет. */
export function ProductPhoto({
  url,
  alt,
  seed = 0,
  className = "",
  initial,
  priority = false,
  eager = false,
  thumbnail = false,
  transitionName,
}: {
  url: string | null;
  alt: string;
  seed?: number;
  className?: string;
  /** Текст, из которого берётся буква для заглушки (по умолчанию alt). */
  initial?: string;
  priority?: boolean;
  eager?: boolean;
  thumbnail?: boolean;
  /** Имя общего перехода: фото витрины плавно превращается в фото карточки (View Transitions). */
  transitionName?: string;
}) {
  const letter = (initial ?? alt).trim().charAt(0).toUpperCase();
  const tint = seed || tintOf((initial ?? alt).trim());
  const small = url && thumbnail ? thumbUrl(url) : url;
  const imageProps = {
    loading: priority || eager ? "eager" : "lazy",
    fetchPriority: priority ? "high" : undefined,
    decoding: priority || eager ? undefined : "async",
    className: `size-full object-cover ${priority || eager ? "" : "photo-reveal"}`,
  } as const;
  const frame = (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: TINTS[tint % TINTS.length] }}
      role={!url && alt ? "img" : undefined}
      aria-label={!url && alt ? alt : undefined}
    >
      {url && small && small !== url ? (
        <ThumbnailImage original={url} thumbnail={small} alt={alt} {...imageProps} />
      ) : url ? (
        <ThumbnailImage original={url} thumbnail={url} alt={alt} {...imageProps} />
      ) : letter && (
        <span aria-hidden="true" className="select-none text-[clamp(1.5rem,32%,3.5rem)] font-extrabold leading-none text-ink/70">
          {letter}
        </span>
      )}
    </div>
  );
  // share: фото «перелетает» только между витриной и карточкой товара. default="none": при других переходах
  // (смена категории, поиск) карточки не анимируются, иначе iOS Safari оставлял картинку не на своём месте.
  return transitionName ? (
    <ViewTransition name={transitionName} share="auto" default="none">
      {frame}
    </ViewTransition>
  ) : (
    frame
  );
}
