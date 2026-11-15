import type { Metadata } from "next";
import Script from "next/script";
import { getSiteBaseUrl } from "@/lib/site-url";
import "./globals.css";
import "./site.css";

export const metadata: Metadata = {
  metadataBase: getSiteBaseUrl(),
  title: "CRM Imobiliária",
  description: "Painel de gestão de clientes e imóveis",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script id="estate-theme-init" strategy="beforeInteractive">
          {`try { const theme = localStorage.getItem("de-imoveis-theme"); document.documentElement.dataset.estateTheme = ["light", "dark", "logo"].includes(theme) ? theme : "light"; } catch { document.documentElement.dataset.estateTheme = "light"; }`}
        </Script>
        {children}
      </body>
    </html>
  );
}

