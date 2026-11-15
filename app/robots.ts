import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/recuperar-senha",
        "/redefinir-senha",
        "/dashboard",
        "/clientes",
        "/imoveis",
        "/importar",
        "/usuarios",
        "/auditoria",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
