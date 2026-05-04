import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

// Bundle-Grössen: `npm run analyze` setzt ANALYZE=true und öffnet den Analyzer nach dem Build.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // File uploads via Server Actions exceed the default request payload limit on mobile photos.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
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

export default withBundleAnalyzer(nextConfig);
