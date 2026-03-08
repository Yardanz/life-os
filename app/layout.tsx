import type { Metadata } from "next";
import "./globals.css";
import { GlobalThemeToggle } from "@/components/theme/GlobalThemeToggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "LIFE OS",
  description: "LIFE OS MVP",
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
        <GlobalThemeToggle />
        {children}
      </body>
    </html>
  );
}
