import "server-only";

import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ListingPhoto = {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  is_cover: boolean;
};

export type PublicProperty = {
  id: string;
  internal_code: string;
  title: string;
  description: string | null;
  property_type: string;
  purpose: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  sale_price: number | null;
  rent_price: number | null;
  condo_fee: number | null;
  property_tax: number | null;
  total_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  created_at: string;
  photos: ListingPhoto[];
};

export type PublicPropertyCard = Pick<PublicProperty,
  | "id"
  | "internal_code"
  | "title"
  | "property_type"
  | "purpose"
  | "neighborhood"
  | "city"
  | "state"
  | "sale_price"
  | "rent_price"
  | "total_area"
  | "built_area"
  | "bedrooms"
  | "parking_spaces"
  | "created_at"
> & { photos: ListingPhoto[] };

type PropertyPhotoRow = {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  position: number;
  is_cover: boolean;
};

const propertyFields =
  "id,internal_code,title,description,property_type,purpose,neighborhood,city,state,sale_price,rent_price,condo_fee,property_tax,total_area,built_area,bedrooms,suites,bathrooms,parking_spaces,created_at";
const propertyCardFields =
  "id,internal_code,title,property_type,purpose,neighborhood,city,state,sale_price,rent_price,total_area,built_area,bedrooms,parking_spaces,created_at";

type PublicPropertyBase = Omit<PublicProperty, "photos">;

function createPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createPhotoClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function addPhotos<T extends { id: string }>(properties: T[], coversOnly: boolean): Promise<(T & { photos: ListingPhoto[] })[]> {
  if (properties.length === 0) return properties.map((property) => ({ ...property, photos: [] }));

  const storage = createPhotoClient();
  if (!storage) return properties.map((property) => ({ ...property, photos: [] }));

  let query = storage
    .from("property_photos")
    .select("id,property_id,storage_path,caption,position,is_cover")
    .in("property_id", properties.map((property) => property.id))
    .order("position", { ascending: true });

  if (coversOnly) query = query.eq("is_cover", true);

  const { data, error } = await query;
  if (error || !data?.length) return properties.map((property) => ({ ...property, photos: [] }));

  const photoRows = data as PropertyPhotoRow[];
  const { data: signedPhotos, error: signingError } = await storage.storage
    .from("property-photos")
    .createSignedUrls(photoRows.map((photo) => photo.storage_path), 3600);

  if (signingError || !signedPhotos) return properties.map((property) => ({ ...property, photos: [] }));

  const urls = new Map<string, string>();
  for (const photo of signedPhotos) {
    if (photo.path && photo.signedUrl) urls.set(photo.path, photo.signedUrl);
  }
  const photosByProperty = new Map<string, ListingPhoto[]>();

  for (const photo of photoRows) {
    const url = urls.get(photo.storage_path);
    if (!url) continue;
    const list = photosByProperty.get(photo.property_id) ?? [];
    list.push({
      id: photo.id,
      url,
      caption: photo.caption,
      position: photo.position,
      is_cover: photo.is_cover,
    });
    photosByProperty.set(photo.property_id, list);
  }

  return properties.map((property) => ({
    ...property,
    photos: photosByProperty.get(property.id) ?? [],
  }));
}

export async function getPublicListings(): Promise<{
  properties: PublicPropertyCard[];
  connected: boolean;
}> {
  const supabase = createPublicClient();
  if (!supabase) return { properties: [], connected: false };

  const { data, error } = await supabase
    .from("public_available_properties")
    .select(propertyCardFields)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error || !data) {
    if (error) console.error("Falha ao carregar a vitrine pública:", error.message);
    return { properties: [], connected: false };
  }

  const properties = (data as Omit<PublicPropertyCard, "photos">[]).map((property) => ({
    ...property,
    photos: [],
  }));

  return { properties: await addPhotos(properties, true), connected: true };
}

export async function getPublicListingPaths(): Promise<{ id: string; updated_at: string }[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("public_available_properties")
    .select("id,updated_at")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("Falha ao carregar anúncios para indexação:", error.message);
    return [];
  }

  return data as { id: string; updated_at: string }[];
}

export async function getPublicListing(id: string): Promise<PublicProperty | null> {
  const base = await getPublicListingBase(id);
  if (!base) return null;

  const property = { ...base, photos: [] };
  const [withPhotos] = await addPhotos([property], false);
  return withPhotos;
}

const getPublicListingBase = cache(async (id: string): Promise<PublicPropertyBase | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("public_available_properties")
    .select(propertyFields)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as PublicPropertyBase;
});

export async function getPublicListingSummary(id: string): Promise<Pick<PublicProperty, "id" | "title" | "description"> | null> {
  const property = await getPublicListingBase(id);
  if (!property) return null;
  return { id: property.id, title: property.title, description: property.description };
}
