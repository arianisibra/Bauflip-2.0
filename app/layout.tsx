import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { WebVitalsReporter } from "@/components/observability/web-vitals-reporter";
import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
import { QueryProvider } from "@/lib/query/provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-store";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Bauflip 2.0",
  description: "Bauflip 2.0 - Operatives System für Storen-, Rollladen- und Sonnenschutzservice",
  icons: {
    icon: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  viewportFit: "cover",
  // Reduziert Scroll-/Zoom-Zwang, wenn die Tastatur den sichtbaren Bereich verkleinert (v. a. Android Chrome).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" className="h-full antialiased" suppressHydrationWarning>
      <body
        className={`${poppins.className} min-h-full flex flex-col`}
        suppressHydrationWarning
      >
        {/* Setzt data-theme vor dem ersten Paint (Hell/Dunkel/System) — verhindert Flackern. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ServiceWorkerRegister />
        <QueryProvider>
          {children}
          <WebVitalsReporter />
          <Toaster richColors closeButton position="top-center" />
        </QueryProvider>
      </body>
    </html>
  );
}

