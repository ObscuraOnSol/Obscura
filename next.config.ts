import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint is run explicitly via `bun run lint` / CI, not as a build gate.
  eslint: { ignoreDuringBuilds: true },
  // Backend and contract live in this monorepo but are not part of the Next build.
  outputFileTracingExcludes: {
    "*": ["./backend/**", "./contract/**"],
  },
  async redirects() {
    return [
      {
        source: "/agents",
        destination: "/agent",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
