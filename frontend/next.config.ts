/** Showcase demos may be framed from arnold-rg.github.io; production RAGI itself must never be served from that origin. */
import type { NextConfig } from "next";

// RAGI v2 frontend — created by Arnold Rurangwa / Arnova Group.
// The browser only talks to this origin; /api/* is proxied to the FastAPI service
// so the session cookie stays first-party and HttpOnly.
const API_ORIGIN = process.env.RAGI_API_ORIGIN ?? "http://127.0.0.1:8410";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'; frame-src 'self' https://arnold-rg.github.io https://arnova-africa-preview.onrender.com https://twodaymovie-site.onrender.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  agentRules: false, // no generated agent-instruction files in the repo
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/ws/:path*", destination: `${API_ORIGIN}/ws/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
