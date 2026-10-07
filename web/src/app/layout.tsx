import type { Metadata } from "next";
import "./globals.css";
import "./bertaut.css";

export const metadata: Metadata = {
  title: "BERTAUT — Beranda Aplikasi & Tautan Terpadu",
  description: "Pintu masuk terpadu ke seluruh aplikasi kerja Anda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Fraunces:opsz,ital,wght@9..144,0,300;9..144,0,500;9..144,0,600;9..144,1,400&family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
