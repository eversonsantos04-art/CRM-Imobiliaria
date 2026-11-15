"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DeletePropertyButton } from "./delete-button";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { openPrintableReport } from "@/lib/print-report";

type Property = {
  id: string; internal_code: string; title: string; property_type: string;
  purpose: string; status: string; neighborhood: string | null; city: string | null;
  sale_price: number | null; rent_price: number | null; bedrooms: number | null;
  built_area: number | null; created_by: string; created_at: string;
};
type PropertyRow = Property & { cover?: string };
type Query = Record<string, string | string[] | undefined>;
const typeLabels: Record<string,string> = { casa:"Casa", apartamento:"Apartamento", terreno:"Terreno", comercial:"Comercial", rural:"Rural" };
const statusLabels: Record<string,string> = { disponivel:"Disponível", reservado:"Reservado", vendido:"Vendido", alugado:"Alugado", inativo:"Inativo" };
const purposeLabels: Record<string,string> = { venda:"Venda", aluguel:"Aluguel", ambos:"Venda e aluguel" };
const money = (value:number|null) => value == null ? null : new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(value);
const first = (value:string|string[]|undefined) => Array.isArray(value) ? value[0] : value ?? "";
function escapeSearch(value:string) { return value.replace(/[,*()%_\\]/g," ").replace(/\s+/g," ").trim().slice(0,80); }

function PropertiesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const search = params.toString();
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [error, setError] = useState("");
  const values = new URLSearchParams(search);
  const query: Query = Object.fromEntries(values.entries());
  const q = escapeSearch(first(query.q));
  const type = first(query.type), status = first(query.status), purpose = first(query.purpose);
  const neighborhood = first(query.bairro).trim().slice(0,80);
  const rawBedrooms = first(query.quartos), rawMinimum = first(query.min), rawMaximum = first(query.max);
  const pageValue = Number(first(query.page));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const perPage = 20;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        if (active) setUserId(user.id);
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profileError) throw profileError;

        let request = supabase.from("properties")
          .select("id,internal_code,title,property_type,purpose,status,neighborhood,city,sale_price,rent_price,bedrooms,built_area,created_by,created_at", { count:"exact" })
          .order("created_at", { ascending:false });
        if (q) request = request.or(["internal_code","title","neighborhood","city"].map(column => `${column}.ilike.%${q}%`).join(","));
        if (["casa","apartamento","terreno","comercial","rural"].includes(type)) request = request.eq("property_type",type);
        if (["disponivel","reservado","vendido","alugado","inativo"].includes(status)) request = request.eq("status",status);
        if (purpose === "venda") request = request.in("purpose",["venda","ambos"]);
        else if (purpose === "aluguel") request = request.in("purpose",["aluguel","ambos"]);
        else if (purpose === "ambos") request = request.eq("purpose","ambos");
        if (neighborhood) request = request.ilike("neighborhood",`%${neighborhood.replace(/[%_*]/g," ")}%`);
        const bedrooms = rawBedrooms ? Number(rawBedrooms) : NaN;
        if (Number.isInteger(bedrooms) && bedrooms >= 0) request = request.gte("bedrooms",bedrooms);
        const minimum = rawMinimum ? Number(rawMinimum) : NaN;
        const maximum = rawMaximum ? Number(rawMaximum) : NaN;
        const priceColumn = purpose === "aluguel" ? "rent_price" : "sale_price";
        if (Number.isFinite(minimum) && minimum >= 0) request = request.gte(priceColumn,minimum);
        if (Number.isFinite(maximum) && maximum >= 0) request = request.lte(priceColumn,maximum);
        const { data, count, error: listError } = await request.range((page-1)*perPage,page*perPage-1);
        if (listError) throw listError;
        const properties = (data ?? []) as Property[];
        const { data: photos, error: photoError } = properties.length
          ? await supabase.from("property_photos").select("property_id,storage_path").in("property_id",properties.map(item => item.id)).eq("is_cover",true)
          : { data: [], error: null };
        if (photoError) throw photoError;
        const covers = await Promise.all((photos ?? []).map(async photo => {
          const { data: signed, error: signedError } = await supabase.storage.from("property-photos").createSignedUrl(photo.storage_path,3600);
          if (signedError) throw signedError;
          return [photo.property_id, signed.signedUrl] as const;
        }));
        if (active) {
          const coverMap = new Map(covers);
          setRows(properties.map(item => ({ ...item, cover: coverMap.get(item.id) })));
          setTotal(count ?? 0);
          setIsAdmin(profile.role === "admin");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os imóveis.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [search, q, type, status, purpose, neighborhood, rawBedrooms, rawMinimum, rawMaximum, page, router]);

  function pageHref(next:number) {
    const nextParams = new URLSearchParams(search);
    nextParams.set("page",String(next));
    return `/imoveis?${nextParams.toString()}`;
  }

  async function exportProperties() {
    setExporting(true);setExportError("");
    try {
      const supabase=createClient();
      const exported:Record<string,unknown>[]=[];
      for(let start=0;;start+=1000){
        let request=supabase.from("properties").select("internal_code,title,property_type,purpose,status,postal_code,street,street_number,complement,neighborhood,city,state,sale_price,rent_price,condo_fee,property_tax,total_area,built_area,bedrooms,suites,bathrooms,parking_spaces,created_at").order("created_at",{ascending:false});
        if(q)request=request.or(["internal_code","title","neighborhood","city"].map(column=>`${column}.ilike.%${q}%`).join(","));
        if(["casa","apartamento","terreno","comercial","rural"].includes(type))request=request.eq("property_type",type);
        if(["disponivel","reservado","vendido","alugado","inativo"].includes(status))request=request.eq("status",status);
        if(purpose==="venda")request=request.in("purpose",["venda","ambos"]);
        else if(purpose==="aluguel")request=request.in("purpose",["aluguel","ambos"]);
        else if(purpose==="ambos")request=request.eq("purpose","ambos");
        if(neighborhood)request=request.ilike("neighborhood",`%${neighborhood.replace(/[%_*]/g," ")}%`);
        const bedroomsValue=rawBedrooms?Number(rawBedrooms):NaN;
        if(Number.isInteger(bedroomsValue)&&bedroomsValue>=0)request=request.gte("bedrooms",bedroomsValue);
        const minValue=rawMinimum?Number(rawMinimum):NaN, maxValue=rawMaximum?Number(rawMaximum):NaN;
        const priceColumn=purpose==="aluguel"?"rent_price":"sale_price";
        if(Number.isFinite(minValue)&&minValue>=0)request=request.gte(priceColumn,minValue);
        if(Number.isFinite(maxValue)&&maxValue>=0)request=request.lte(priceColumn,maxValue);
        const {data,error:queryError}=await request.range(start,start+999);
        if(queryError)throw queryError;
        const batch=(data??[]) as Record<string,unknown>[];exported.push(...batch);
        if(batch.length<1000)break;
      }
      const columns=["internal_code","title","property_type","purpose","status","postal_code","street","street_number","complement","neighborhood","city","state","sale_price","rent_price","condo_fee","property_tax","total_area","built_area","bedrooms","suites","bathrooms","parking_spaces","created_at"];
      const labels=["Cód. imóvel","Título","Tipo","Finalidade","Status","CEP","Logradouro","Número","Complemento","Bairro","Cidade","UF","Venda","Aluguel","Condomínio","IPTU","Área total","Área construída","Quartos","Suítes","Banheiros","Vagas","Cadastrado em"];
      downloadCsv(`imoveis-${new Date().toISOString().slice(0,10)}.csv`,labels,exported.map(item=>columns.map(column=>item[column] as string|number|null)));
    }catch(cause){setExportError(cause instanceof Error?cause.message:"Não foi possível exportar os imóveis.");}
    finally{setExporting(false);}
  }

  async function printProperties() {
    const reportWindow=window.open("","_blank");
    if(!reportWindow){setExportError("Permita pop-ups para gerar o PDF.");return;}
    setPrinting(true);setExportError("");
    try{
      const supabase=createClient();
      const exported:Record<string,unknown>[]=[];
      for(let start=0;;start+=1000){
        let request=supabase.from("properties").select("internal_code,title,property_type,purpose,status,neighborhood,city,sale_price,rent_price,created_at").order("created_at",{ascending:false});
        if(q)request=request.or(["internal_code","title","neighborhood","city"].map(column=>`${column}.ilike.%${q}%`).join(","));
        if(["casa","apartamento","terreno","comercial","rural"].includes(type))request=request.eq("property_type",type);
        if(["disponivel","reservado","vendido","alugado","inativo"].includes(status))request=request.eq("status",status);
        if(purpose==="venda")request=request.in("purpose",["venda","ambos"]);else if(purpose==="aluguel")request=request.in("purpose",["aluguel","ambos"]);else if(purpose==="ambos")request=request.eq("purpose","ambos");
        if(neighborhood)request=request.ilike("neighborhood",`%${neighborhood.replace(/[%_*]/g," ")}%`);
        const bedroomsValue=rawBedrooms?Number(rawBedrooms):NaN;if(Number.isInteger(bedroomsValue)&&bedroomsValue>=0)request=request.gte("bedrooms",bedroomsValue);
        const minValue=rawMinimum?Number(rawMinimum):NaN,maxValue=rawMaximum?Number(rawMaximum):NaN,priceColumn=purpose==="aluguel"?"rent_price":"sale_price";
        if(Number.isFinite(minValue)&&minValue>=0)request=request.gte(priceColumn,minValue);if(Number.isFinite(maxValue)&&maxValue>=0)request=request.lte(priceColumn,maxValue);
        const {data,error:queryError}=await request.range(start,start+999);if(queryError)throw queryError;
        const batch=(data??[]) as Record<string,unknown>[];exported.push(...batch);if(batch.length<1000)break;
      }
      const rows=exported.map(item=>[
        String(item.internal_code??""),String(item.title??""),typeLabels[String(item.property_type)]??String(item.property_type??""),purposeLabels[String(item.purpose)]??String(item.purpose??""),statusLabels[String(item.status)]??String(item.status??""),[item.neighborhood,item.city].filter(Boolean).join(" · "),money(item.sale_price as number|null)??"",money(item.rent_price as number|null)??"",
      ]);
      openPrintableReport("Relatório de imóveis",["Cód. imóvel","Título","Tipo","Finalidade","Status","Bairro e cidade","Valor de venda","Valor do aluguel"],rows,reportWindow);
    }catch(cause){reportWindow.close();const detail=cause instanceof Error?cause.message:typeof cause==="object"&&cause!==null&&"message" in cause?String(cause.message):"Não foi possível gerar o relatório de imóveis.";setExportError(detail);}
    finally{setPrinting(false);}
  }

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[var(--green)]">CRM / Imóveis</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Imóveis</h1><p className="mt-1 text-sm text-[var(--muted)]">{total} {total===1?"imóvel cadastrado":"imóveis cadastrados"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={exporting} onClick={()=>void exportProperties()} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">{exporting?"Exportando...":"Exportar CSV"}</button><button type="button" disabled={printing} onClick={()=>void printProperties()} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">{printing?"Preparando PDF...":"Exportar PDF"}</button><Link href="/imoveis/novo" className="rounded-xl bg-[var(--green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--green-dark)]">+ Cadastrar imóvel</Link></div></div>
    {exportError&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Falha ao exportar imóveis: {exportError}</p>}
    {first(query.salvo)&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Imóvel salvo com sucesso.</p>}
    <form method="get" className="mt-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium">Busca<input name="q" defaultValue={first(query.q)} placeholder="Código, título ou cidade" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <label className="text-sm font-medium">Tipo<select name="type" defaultValue={type} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"><option value="">Todos</option>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-sm font-medium">Status<select name="status" defaultValue={status} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"><option value="">Todos</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-sm font-medium">Finalidade<select name="purpose" defaultValue={purpose} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"><option value="">Todas</option>{Object.entries(purposeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-sm font-medium">Bairro<input name="bairro" defaultValue={first(query.bairro)} className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <label className="text-sm font-medium">Quartos (mín.)<input name="quartos" type="number" min="0" step="1" defaultValue={first(query.quartos)} className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <label className="text-sm font-medium">Preço mínimo<input name="min" type="number" min="0" step="0.01" defaultValue={first(query.min)} className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <label className="text-sm font-medium">Preço máximo<input name="max" type="number" min="0" step="0.01" defaultValue={first(query.max)} className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <div className="flex items-end gap-2 lg:col-span-4"><button className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white">Filtrar</button><Link href="/imoveis" className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm">Limpar</Link></div>
    </form>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar os imóveis: {error}</p>}
    {loading?<p role="status" className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">Carregando imóveis...</p>:rows.length===0?<div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center"><h2 className="font-semibold">Nenhum imóvel encontrado</h2><p className="mt-2 text-sm text-[var(--muted)]">Ajuste os filtros ou cadastre o primeiro imóvel.</p></div>
    :<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(item=>{
      const editable=isAdmin||item.created_by===userId;
      const price=money(item.sale_price)??money(item.rent_price);
      return <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        {item.cover?<img src={item.cover} alt="" loading="lazy" className="h-48 w-full object-cover"/>:<div className="flex h-48 items-center justify-center bg-emerald-50 text-4xl text-emerald-800" aria-hidden="true">⌂</div>}
        <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--green)]">{item.internal_code}</p><h2 className="mt-1 line-clamp-2 text-lg font-semibold">{item.title}</h2></div><span className="rounded-full bg-[var(--canvas)] px-2.5 py-1 text-xs">{statusLabels[item.status]}</span></div>
          <p className="mt-2 text-sm text-[var(--muted)]">{[typeLabels[item.property_type],purposeLabels[item.purpose],item.neighborhood,item.city].filter(Boolean).join(" · ")}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">{item.bedrooms!=null&&<span>{item.bedrooms} quartos</span>}{item.built_area!=null&&<span>{item.built_area} m²</span>}</div>
          {price&&<p className="mt-4 text-lg font-semibold">{price}<span className="ml-1 text-xs font-normal text-[var(--muted)]">{item.purpose==="aluguel"?"/mês":item.purpose==="ambos"?"ou aluguel":""}</span></p>}
          <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs text-[var(--muted)]">{editable?"Você pode editar":"Somente consulta"}</span>{editable?<div className="flex items-center gap-3"><Link href={`/imoveis/${item.id}/editar`} className="text-sm font-semibold text-[var(--green)] hover:underline">Editar</Link><DeletePropertyButton id={item.id} title={item.title}/></div>:null}</div>
        </div>
      </article>;
    })}</div>}
    {total>perPage&&<nav aria-label="Paginação dos imóveis" className="mt-7 flex items-center justify-center gap-3"><Link aria-disabled={page<=1} href={pageHref(Math.max(1,page-1))} className={`rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm ${page<=1?"pointer-events-none opacity-40":""}`}>Anterior</Link><span className="text-sm text-[var(--muted)]">Página {page} de {Math.ceil(total/perPage)}</span><Link aria-disabled={page>=Math.ceil(total/perPage)} href={pageHref(Math.min(Math.ceil(total/perPage),page+1))} className={`rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm ${page>=Math.ceil(total/perPage)?"pointer-events-none opacity-40":""}`}>Próxima</Link></nav>}
  </div></main>;
}

export default function PropertiesPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Carregando imóveis...</main>}><PropertiesContent/></Suspense>;
}
