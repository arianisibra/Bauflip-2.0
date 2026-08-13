
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

// Turbopack walks up for lockfiles; a stray ~/package-lock.json makes Next pick the wrong root.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Kennung des Deployments — Next nutzt sie für den Schutz gegen Versionsversatz:
 * Assets bekommen `?dpl=`, Navigationen einen `x-deployment-id`-Header, und bei
 * Abweichung lädt der Client hart neu statt in fehlende Chunks oder unbekannte
 * Server-Action-IDs zu laufen.
 *
 * Der Deploy auf dem VPS ist ein `git pull` + `npm run build`, deshalb reicht der
 * Commit-SHA. Fällt Git aus (Docker-Build ohne .git o. ä.), springt der
 * Build-Zeitstempel ein — Hauptsache, pro Build ein anderer Wert.
 */
function resolveDeploymentId(): string {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID;
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return `build-${Date.now()}`;
  }
}

const deploymentId = resolveDeploymentId();

// Bundle-Grössen: `npm run analyze` setzt ANALYZE=true und öffnet den Analyzer nach dem Build.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  deploymentId,
  // Damit der Client seine eigene Version kennt und sie gegen /api/version prüfen
  // kann — Next selbst greift erst bei Navigationen, nicht beim blossen Klick
  // auf «Speichern» (siehe components/app/version-banner.tsx).
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId,
  },
  // Netlify: static /public PNGs load (200) but `/_next/image` returns 404 — serve logos directly.
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
  },
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
