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
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
