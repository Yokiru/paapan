import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const getSupabaseOrigins = () => {
  if (!supabaseUrl) return [];

  try {
    const url = new URL(supabaseUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${wsProtocol}//${url.host}`];
  } catch {
    return [];
  }
};

const buildCsp = () => {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseOrigins = getSupabaseOrigins();

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${supabaseOrigins.join(" ")}`.trim(),
    `img-src 'self' data: blob: https: ${supabaseOrigins.join(" ")}`.trim(),
    "font-src 'self' data: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
};

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
