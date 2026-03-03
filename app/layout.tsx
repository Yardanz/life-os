import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:border focus:border-cyan-400/70 focus:bg-zinc-950 focus:px-3 focus:py-2 focus:text-sm focus:text-cyan-100"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
