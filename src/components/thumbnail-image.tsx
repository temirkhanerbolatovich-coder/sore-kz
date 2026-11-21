"use client";

import { useState, type ComponentProps } from "react";

type Props = Pick<ComponentProps<"img">, "loading" | "fetchPriority" | "decoding" | "className"> & {
  original: string;
  thumbnail: string;
  alt: string;
};

export function ThumbnailImage({ original, thumbnail, alt, ...props }: Props) {
  const [failed, setFailed] = useState<string>();
  const useThumbnail = failed !== thumbnail;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      src={useThumbnail ? thumbnail : original}
      onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
      onError={() => { if (useThumbnail) setFailed(thumbnail); }}
      ref={(image) => {
        if (image?.complete && image.naturalWidth > 0) image.dataset.loaded = "true";
        // An old upload may have failed to load its thumbnail before React hydrated.
        if (useThumbnail && image?.complete && image.naturalWidth === 0) setFailed(thumbnail);
      }}
    />
  );
}
