import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma's generated client should not be bundled by the server compiler.
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prisma query engine (.so / wasm) must be included in serverless output,
  // otherwise Prisma throws "Failed to load query engine" / Internal error
  // at runtime on Vercel. This traces and bundles the binary.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/.prisma/client/**"],
  },
};

export default nextConfig;