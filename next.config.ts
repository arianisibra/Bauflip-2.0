import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/rapport/:projectId",
        destination: "/auftrag/:projectId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
