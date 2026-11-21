import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

async function font(file: string) {
  return readFile(path.join(process.cwd(), "src/assets/fonts", file));
}

/** Картинка-превью ссылки для Instagram, WhatsApp и Telegram (1200×630). */
export async function renderOg({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  // cyrillic-ext нужен для казахских букв (ө, ү, қ…) в названиях магазинов и товаров.
  const [cyr, lat, ext] = await Promise.all([
    font("onest-cyrillic-700-normal.woff"),
    font("onest-latin-700-normal.woff"),
    font("onest-cyrillic-ext-700-normal.woff"),
  ]);

  const tints = ["#f3d9c4", "#e8d5e6", "#d9e6d0", "#f6e3a8"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fff8f0",
          color: "#2b2118",
          padding: 72,
          fontFamily: "OnestLatin, Onest, OnestExt",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40 }}>
            S<span style={{ color: "#c73e1d" }}>Ö</span>RE
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              background: "#fce8e1",
              color: "#8f2a12",
              padding: "10px 24px",
              borderRadius: 999,
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: title.length > 28 ? 72 : 92, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 38, color: "#6b5b4d" }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {tints.map((c) => (
            <div key={c} style={{ display: "flex", width: 120, height: 80, borderRadius: 20, background: c }} />
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
              background: "#0e7c3f",
              color: "#fff",
              fontSize: 32,
              padding: "0 36px",
              borderRadius: 20,
            }}
          >
            Заказать в WhatsApp
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Onest", data: cyr, weight: 700, style: "normal" },
        { name: "OnestLatin", data: lat, weight: 700, style: "normal" },
        { name: "OnestExt", data: ext, weight: 700, style: "normal" },
      ],
    },
  );
}
