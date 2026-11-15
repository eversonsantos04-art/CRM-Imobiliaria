export function getSiteBaseUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    try {
      return new URL(configuredUrl);
    } catch {
      console.error("NEXT_PUBLIC_SITE_URL precisa ser uma URL completa, incluindo https://.");
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return new URL(`https://${vercelUrl}`);
  return new URL("http://localhost:3000");
}
