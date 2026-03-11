import type { Metadata } from "next";
import "./globals.css";
import { BackScrollResetOnNavigation } from "@/components/navigation/BackScrollResetOnNavigation";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const DEFAULT_SITE_URL = "https://life-os-tau-five.vercel.app";

function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    DEFAULT_SITE_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      return parsed.origin;
    } catch {
      // no-op
    }
  }

  return DEFAULT_SITE_URL;
}

const siteUrl = resolveSiteUrl();
const defaultTitle = "LIFE OS - Operator System";
const defaultDescription = "Personal operating system for trajectory control, diagnostics, and anti-chaos operations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | LIFE OS",
  },
  description: defaultDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: siteUrl,
    siteName: "LIFE OS",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "LIFE OS - Operator System",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:border focus:border-cyan-400/70 focus:bg-zinc-950 focus:px-3 focus:py-2 focus:text-sm focus:text-cyan-100"
        >
          Skip to content
        </a>
        <BackScrollResetOnNavigation />
        {children}
      </body>
    </html>
  );
}
