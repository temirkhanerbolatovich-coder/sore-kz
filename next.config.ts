import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabase = supabaseUrl && URL.canParse(supabaseUrl) ? new URL(supabaseUrl) : null;
    const localSupabase = supabase?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(supabase.hostname)
      ? ` ${supabase.origin}`
      : "";
    const dev = process.env.NODE_ENV === "development";
    // The Vercel SDKs use same-origin /_vercel endpoints in production and a debug script in development.
    const devScripts = dev ? " 'unsafe-eval' https://va.vercel-scripts.com" : "";
    // Счётчик Umami Cloud разрешаем в политике только когда он включён (NEXT_PUBLIC_UMAMI_ID).
    const umamiScript = process.env.NEXT_PUBLIC_UMAMI_ID ? " https://cloud.umami.is" : "";
    const umamiConnect = process.env.NEXT_PUBLIC_UMAMI_ID ? " https://cloud.umami.is https://gateway.umami.is https://api-gateway.umami.dev" : "";
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devScripts}${umamiScript}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://*.supabase.co${localSupabase}`,
      `connect-src 'self' https://*.supabase.co${localSupabase}${umamiConnect}`,
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "report-uri /api/csp-report",
    ].join("; ");

    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: process.env.CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
          value: policy,
        },
      ],
    }];
  },
  outputFileTracingIncludes: { "/*": ["./src/assets/fonts/*.woff"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
