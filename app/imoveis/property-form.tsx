"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { removePropertyDocument, removePropertyPhoto, reorderPropertyPhotos, saveProperty, setPropertyCover } from "@/lib/properties";

export type PropertyFormProperty = {
  id: string; internal_code: string; title: string; description: string | null;
  property_type: string; purpose: string; status: string;
  postal_code: string | null; street: string | null; street_number: string | null;
  complement: string | null; neighborhood: string | null; city: string | null; state: string | null;
  sale_price: number | null; rent_price: number | null; condo_fee: number | null; property_tax: number | null;
  total_area: number | null; built_area: number | null; bedrooms: number | null; suites: number | null;
  bathrooms: number | null; parking_spaces: number | null; owner_client_id: string | null;
  assigned_agent: string; created_by: string;
};
export type PropertyFormPhoto = { id: string; storage_path: string; position: number; is_cover: boolean; url: string | null };
export type PropertyFormDocument = { id: string; storage_path: string; file_name: string; content_type: string | null; url: string | null };
type Agent = { id: string; full_name: string | null };
type ClientOption = { id: string; name: string };

const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--green)]";
const label = "block text-sm font-medium text-[var(--ink)]";
const types = [["casa","Casa"],["apartamento","Apartamento"],["terreno","Terreno"],["comercial","Comercial"],["rural","Rural"]];
const purposes = [["venda","Venda"],["aluguel","Aluguel"],["ambos","Venda e aluguel"]];
const statuses = [["disponivel","Disponível"],["reservado","Reservado"],["vendido","Vendido"],["alugado","Alugado"],["inativo","Inativo"]];

function photoFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bitmap) => {
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) { bitmap.close(); reject(new Error("Não foi possível preparar a foto.")); return; }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Não foi possível comprimir a foto.")); return; }
        const extension = blob.type === "image/webp" ? "webp" : "png";
        resolve(new File([blob], `foto.${extension}`, { type: blob.type || "image/webp" }));
      }, "image/webp", 0.82);
    }).catch(() => reject(new Error("Formato de imagem inválido.")));
  });
}

export function PropertyForm({ property, photos: initialPhotos, documents: initialDocuments, agents, clients, userId, isAdmin }: {
  property?: PropertyFormProperty; photos: PropertyFormPhoto[]; documents: PropertyFormDocument[]; agents: Agent[]; clients: ClientOption[]; userId: string; isAdmin: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const editing = Boolean(property);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const files = Array.from(fileInput.current?.files ?? []);
    const documentFiles = Array.from(documentInput.current?.files ?? []);
    if (photos.length + files.length > 8) {
      setError("Cada imóvel pode ter no máximo 8 fotos.");
      setBusy(false);
      return;
    }

    const result = await saveProperty(new FormData(event.currentTarget));
    if (!result.ok) { setError(result.error); setBusy(false); return; }

    const id = result.id!;
    if (files.length) {
      const supabase = createClient();
      let uploadFailed = false;
      for (let index = 0; index < files.length; index += 1) {
        try {
          const compressed = await photoFile(files[index]);
          const path = `${id}/${crypto.randomUUID()}.${compressed.name.split(".").pop()}`;
          const { error: uploadError } = await supabase.storage.from("property-photos").upload(path, compressed, {
            contentType: compressed.type, cacheControl: "3600", upsert: false,
          });
          if (uploadError) throw uploadError;
          const { error: rowError } = await supabase.from("property_photos").insert({
            property_id: id, storage_path: path, position: photos.length + index,
            is_cover: photos.length === 0 && index === 0,
          });
          if (rowError) {
            await supabase.storage.from("property-photos").remove([path]);
            throw rowError;
          }
        } catch {
          setError("O imóvel foi salvo, mas uma foto não foi enviada. Você pode tentar novamente ao editar.");
          uploadFailed = true;
          break;
        }
      }
      if (uploadFailed) {
        window.location.assign(`/imoveis/${id}/editar?foto=erro`);
        return;
      }
    }

    if (documentFiles.length) {
      const supabase = createClient();
      for (const file of documentFiles) {
        if (file.size > 50 * 1024 * 1024) {
          window.location.assign(`/imoveis/${id}/editar?documento=erro`);
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "anexo";
        const path = `${id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("property-documents").upload(path, file, {
          contentType: file.type || "application/octet-stream", upsert: false,
        });
        if (uploadError) {
          window.location.assign(`/imoveis/${id}/editar?documento=erro`);
          return;
        }
        const { error: rowError } = await supabase.from("property_documents").insert({
          property_id: id, storage_path: path, file_name: file.name, content_type: file.type || null,
        });
        if (rowError) {
          await supabase.storage.from("property-documents").remove([path]);
          window.location.assign(`/imoveis/${id}/editar?documento=erro`);
          return;
        }
      }
    }

    window.location.assign("/imoveis?salvo=1");
  }

  async function deletePhoto(photo: PropertyFormPhoto) {
    setBusy(true); setError("");
    const result = await removePropertyPhoto(photo.id);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    setBusy(false);
  }

  async function savePhotoOrder(next: PropertyFormPhoto[]) {
    if (!property) return;
    setBusy(true); setError("");
    const cover = next.find((photo) => photo.is_cover)?.id ?? next[0]?.id ?? null;
    const normalized = next.map((photo, index) => ({ ...photo, position: index, is_cover: photo.id === cover }));
    const result = await reorderPropertyPhotos(property.id, normalized.map((photo) => photo.id), cover);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    setPhotos(normalized);
    setBusy(false);
  }

  async function chooseCover(photo: PropertyFormPhoto) {
    if (!property) return;
    setBusy(true); setError("");
    const result = await setPropertyCover(photo.id);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    setPhotos((current) => current.map((item) => ({ ...item, is_cover: item.id === photo.id })));
    setBusy(false);
  }

  async function deleteDocument(document: PropertyFormDocument) {
    setBusy(true); setError("");
    const result = await removePropertyDocument(document.id);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setBusy(false);
  }

  function fieldInput(name: string, title: string, value?: string | number | null, options: { type?: string; required?: boolean; min?: string; step?: string; placeholder?: string } = {}) {
    return <label className={label}>{title}<input className={field} name={name} type={options.type ?? "text"} defaultValue={value ?? ""} required={options.required} min={options.min} step={options.step} placeholder={options.placeholder} /></label>;
  }
  function select(name: string, title: string, options: string[][], selected?: string) {
    return <label className={label}>{title}<select className={field} name={name} defaultValue={selected ?? options[0][0]}>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  }

  return <form onSubmit={submit} className="space-y-6">
    <input type="hidden" name="id" value={property?.id ?? ""} />
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Identificação</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {property
          ? <label className={label}>Cód. imóvel<input className={field + " bg-[var(--canvas)] text-[var(--muted)]"} value={property.internal_code} readOnly aria-readonly="true" /></label>
          : <p className="rounded-xl bg-[var(--canvas)] p-3 text-sm text-[var(--muted)] sm:col-span-2"><span className="font-semibold text-[var(--ink)]">Cód. imóvel:</span> gerado automaticamente pelo sistema ao salvar.</p>}
        {fieldInput("title","Título",property?.title,{required:true})}
        {select("property_type","Tipo do imóvel",types,property?.property_type)}
        {select("purpose","Finalidade",purposes,property?.purpose)}
        {select("status","Status",statuses,property?.status ?? "disponivel")}
        {isAdmin && agents.length > 0 && <label className={label}>Corretor responsável<select className={field} name="assigned_agent" defaultValue={property?.assigned_agent ?? userId}>{agents.map((agent)=><option key={agent.id} value={agent.id}>{agent.full_name || "Corretor"}</option>)}</select></label>}
        <label className={label}>Proprietário (cliente)<select className={field} name="owner_client_id" defaultValue={property?.owner_client_id ?? ""}><option value="">Não informado</option>{clients.map((client)=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      </div>
      <label className={label + " mt-4"}>Descrição<textarea className={field + " min-h-28"} name="description" defaultValue={property?.description ?? ""} /></label>
    </section>

    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Endereço</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fieldInput("postal_code","CEP",property?.postal_code)}
        {fieldInput("street","Logradouro",property?.street)}
        {fieldInput("street_number","Número",property?.street_number)}
        {fieldInput("complement","Complemento",property?.complement)}
        {fieldInput("neighborhood","Bairro",property?.neighborhood)}
        {fieldInput("city","Cidade",property?.city)}
        {fieldInput("state","UF",property?.state)}
      </div>
    </section>

    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Valores e características</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fieldInput("sale_price","Valor de venda (R$)",property?.sale_price,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("rent_price","Valor do aluguel (R$)",property?.rent_price,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("condo_fee","Condomínio (R$)",property?.condo_fee,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("property_tax","IPTU (R$)",property?.property_tax,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("total_area","Área total (m²)",property?.total_area,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("built_area","Área construída (m²)",property?.built_area,{type:"number",min:"0",step:"0.01"})}
        {fieldInput("bedrooms","Quartos",property?.bedrooms,{type:"number",min:"0",step:"1"})}
        {fieldInput("suites","Suítes",property?.suites,{type:"number",min:"0",step:"1"})}
        {fieldInput("bathrooms","Banheiros",property?.bathrooms,{type:"number",min:"0",step:"1"})}
        {fieldInput("parking_spaces","Vagas",property?.parking_spaces,{type:"number",min:"0",step:"1"})}
      </div>
    </section>

    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Fotos</h2><p className="mt-1 text-sm text-[var(--muted)]">{photos.length} de 8 fotos. A primeira enviada vira a capa.</p></div></div>
      {photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo,index)=><div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
        {photo.url ? <img src={photo.url} alt="Foto do imóvel" loading="lazy" className="h-32 w-full object-cover" /> : <div className="h-32 bg-[var(--canvas)]" />}
        <div className="space-y-2 p-2"><p className="text-xs font-medium">{photo.is_cover?"Capa":`Foto ${index+1}`}</p>
        <div className="flex gap-1"><button type="button" disabled={busy||index===0} onClick={()=>void savePhotoOrder(photos.map((item,i)=>i===index?photos[index-1]:i===index-1?photos[index]:item))} className="rounded border px-2 py-1 text-xs disabled:opacity-40" aria-label="Mover foto para cima">↑</button>
        <button type="button" disabled={busy||index===photos.length-1} onClick={()=>void savePhotoOrder(photos.map((item,i)=>i===index?photos[index+1]:i===index+1?photos[index]:item))} className="rounded border px-2 py-1 text-xs disabled:opacity-40" aria-label="Mover foto para baixo">↓</button>
        <button type="button" disabled={busy||photo.is_cover} onClick={()=>void chooseCover(photo)} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Definir capa</button>
        <button type="button" disabled={busy} onClick={()=>void deletePhoto(photo)} className="ml-auto rounded border px-2 py-1 text-xs text-red-700">Excluir</button></div></div>
      </div>)}</div>}
      {photos.length < 8 && <label className={label + " mt-4"}>Adicionar fotos<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className={field + " file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2"} /><span className="mt-1 block text-xs text-[var(--muted)]">As imagens serão redimensionadas e comprimidas antes do envio.</span></label>}
      {!editing && <p className="mt-3 text-xs text-[var(--muted)]">As fotos serão enviadas depois de salvar os dados do imóvel.</p>}
    </section>

    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Documentos</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Anexe documentos opcionais de até 50 MB cada.</p>
      {documents.length > 0 && <ul className="mt-4 divide-y divide-[var(--line)]">{documents.map((document)=><li key={document.id} className="flex items-center justify-between gap-3 py-3"><a href={document.url ?? "#"} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-[var(--green)] hover:underline">{document.file_name}</a><button type="button" disabled={busy} onClick={()=>void deleteDocument(document)} className="shrink-0 text-sm text-red-700 hover:underline">Excluir</button></li>)}</ul>}
      <label className={label + " mt-4"}>Adicionar documentos<input ref={documentInput} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" className={field + " file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2"}/></label>
      {!editing && <p className="mt-2 text-xs text-[var(--muted)]">Os documentos serão enviados depois de salvar o imóvel.</p>}
    </section>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/imoveis" className="rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-center text-sm font-medium">Cancelar</Link>
      <button disabled={busy} className="rounded-xl bg-[var(--green)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--green-dark)] disabled:opacity-60">{busy?"Salvando...":editing?"Salvar alterações":"Cadastrar imóvel"}</button></div>
  </form>;
}

