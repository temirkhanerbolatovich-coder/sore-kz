import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SÖRE",
    short_name: "SÖRE",
    description: "Полка в интернете: фото полки или прайс, ИИ-карточки и заказ в WhatsApp и Telegram.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fff8f0",
    theme_color: "#fff8f0",
    lang: "ru",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
