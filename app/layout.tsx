import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CRM Imobiliária", description: "Painel de gestão de clientes e imóveis" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

