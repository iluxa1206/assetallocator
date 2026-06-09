import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8010";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.8.127", "192.168.8.138", "172.20.10.2"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
    ];
  },
};

export default nextConfig;
