import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma's generated client should not be bundled by the server compiler.
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
