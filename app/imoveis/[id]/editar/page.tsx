"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";
import { PropertyForm, type PropertyFormDocument, type PropertyFormPhoto, type PropertyFormProperty } from "../../property-form";

type Agent = { id: string; full_name: string | null };
type ClientOption = { id: string; name: string };

function EditPropertyContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [property, setProperty] = useState<PropertyFormProperty | null>(null);
  const [photos, setPhotos] = useState<PropertyFormPhoto[]>([]);
  const [documents, setDocuments] = useState<PropertyFormDocument[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProperty() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }

        const [profileResult, propertyResult] = await Promise.all([
          supabase.from("profiles").select("role").eq("id",user.id).single(),
          supabase.from("properties").select("*").eq("id",id).maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (propertyResult.error) throw propertyResult.error;
        if (!propertyResult.data) { if (active) setError("Imóvel não encontrado."); return; }

        const admin = profileResult.data.role === "admin";
        const editable = admin || propertyResult.data.created_by === user.id;
        const [photoResult, documentResult, agentResult, clientResult] = await Promise.all([
          supabase.from("property_photos").select("id,storage_path,position,is_cover").eq("property_id",id).order("position"),
          supabase.from("property_documents").select("id,storage_path,file_name,content_type").eq("property_id",id).order("created_at"),
          admin ? supabase.from("profiles").select("id,full_name").order("full_name") : Promise.resolve({ data: [] as Agent[], error: null }),
          supabase.from("clients").select("id,name").order("name").limit(500),
        ]);
        if (photoResult.error) throw photoResult.error;
        if (documentResult.error) throw documentResult.error;
        if (agentResult.error) throw agentResult.error;
        if (clientResult.error) throw clientResult.error;

        const [photoOptions, documentOptions] = await Promise.all([
          Promise.all((photoResult.data ?? []).map(async (photo) => {
            const { data, error: signedError } = await supabase.storage.from("property-photos").createSignedUrl(photo.storage_path,3600);
            if (signedError) throw signedError;
            return { ...photo, url: data.signedUrl };
          })),
          Promise.all((documentResult.data ?? []).map(async (document) => {
            const { data, error: signedError } = await supabase.storage.from("property-documents").createSignedUrl(document.storage_path,3600);
            if (signedError) throw signedError;
            return { ...document, url: data.signedUrl };
          })),
        ]);

        if (active) {
          setUserId(user.id);
          setIsAdmin(admin);
          setCanEdit(editable);
          setProperty(propertyResult.data as PropertyFormProperty);
          setPhotos(photoOptions);
          setDocuments(documentOptions);
          setAgents(agentResult.data ?? []);
          setClients(clientResult.data ?? []);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o imóvel.");
      } finally { if (active) setLoading(false); }
    }
    void loadProperty();
    return () => { active = false; };
  }, [id, router]);

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-4xl px-5 py-7 sm:py-10">
    <p className="text-sm text-[var(--muted)]"><Link href="/imoveis" className="text-[var(--green)] hover:underline">Imóveis</Link> / Editar</p>
    <h1 className="mt-2 text-3xl font-semibold">Editar imóvel</h1>
    {loading ? <p role="status" className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Carregando imóvel...</p>
      : error ? <section role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-900">{error}</p><Link href="/imoveis" className="mt-4 inline-block font-medium text-[var(--green)] hover:underline">Voltar aos imóveis</Link></section>
      : !property ? null
      : <>
        <p className="mt-2 text-sm text-[var(--muted)]">Código {property.internal_code}</p>
        {params.get("foto")==="erro"&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O imóvel foi salvo, mas uma foto não foi enviada. Confira o formato e tente novamente.</p>}
        {params.get("documento")==="erro"&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O imóvel foi salvo, mas um documento não foi enviado. Confira o arquivo (máximo de 50 MB) e tente novamente.</p>}
        {!canEdit ? <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-lg font-semibold">Acesso somente para consulta</h2><p className="mt-2 text-sm text-amber-900">Você pode ver este imóvel na listagem, mas só quem o cadastrou ou o admin pode alterá-lo.</p></section>
          : <div className="mt-6"><PropertyForm property={property} photos={photos} documents={documents} agents={agents} clients={clients} userId={userId} isAdmin={isAdmin}/></div>}
      </>}
  </div></main>;
}

export default function EditPropertyPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Carregando imóvel...</main>}><EditPropertyContent/></Suspense>;
}
