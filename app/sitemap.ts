import type { MetadataRoute } from "next";
import { getPublicListingPaths } from "@/lib/public-listings";
import { getSiteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteBaseUrl();
  const listings = await getPublicListingPaths();

  return [
    {
      url: baseUrl.toString(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...listings.map((listing) => ({
      url: new URL(`/anuncio/${listing.id}`, baseUrl).toString(),
      lastModified: new Date(listing.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
