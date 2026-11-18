import type { NextConfig } from "next";
import path from "path";

// Content Security Policy directive definitions
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://*.firebaseio.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: https://lh3.googleusercontent.com https://*.googleusercontent.com",
  "media-src 'self' data: blob: https: https://*.r2.cloudflarestorage.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://*.r2.cloudflarestorage.com https://*.upstash.io",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only packages that should not be bundled for the client
  serverExternalPackages: ["firebase-admin"],
  // Explicitly anchor tracing to this project directory
  outputFileTracingRoot: path.resolve(process.cwd()),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/shares",
        destination: "/shared",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
