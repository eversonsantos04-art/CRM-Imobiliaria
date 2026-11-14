"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { openPrintableReport } from "@/lib/print-report";

type ClientRow = {
  id: string; name: string; document_number: string | null; phone: string | null;
  whatsapp: string | null; email: string | null; contact_source: string | null;
  assigned_agent: string; created_by: string; client_roles: { role: string }[];
};
type Agent = { id: string; full_name: string | null };
const roleLabels: Record<string,string> = { comprador:"Comprador", locatario:"Locatário", proprietario:"Proprietário", investidor:"Investidor" };
const first = (value:string|string[]|undefined) => Array.isArray(value) ? value[0] : value ?? "";
function safeSearch(value:string) { return value.replace(/[,*()%_\\]/g," ").replace(/\s+/g," ").trim().slice(0,80); }

function ClientsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const search = params.toString();
  const query = new URLSearchParams(search);
  const q = safeSearch(query.get("q") ?? "");
  const role = query.get("papel") ?? "";
  const source = (query.get("origem") ?? "").trim().slice(0,80);
  const agent = query.get("corretor") ?? "";
  const pageValue = Number(query.get("page"));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const perPage = 20;
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadClients() {
      setLoading(true); setError("");
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        if (active) setUserId(user.id);
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role,full_name").eq("id",user.id).single();
        if (profileError) throw profileError;
        const admin = profile.role === "admin";
        if (active) setIsAdmin(admin);
        if (admin) {
          const { data: agentRows, error: agentsError } = await supabase.from("profiles").select("id,full_name").order("full_name");
          if (agentsError) throw agentsError;
          if (active) setAgents(agentRows ?? []);
        } else if (active) setAgents([{id:user.id,full_name:profile.full_name}]);

        const join = role ? "client_roles!inner(role)" : "client_roles(role)";
        let request = supabase.from("clients")
          .select(`id,name,document_number,phone,whatsapp,email,contact_source,assigned_agent,created_by,${join}`, { count:"exact" })
          .order("name", { ascending:true });
        if (q) request = request.or(["name","document_number","phone","email"].map(column => `${column}.ilike.%${q}%`).join(","));
        if (role && Object.keys(roleLabels).includes(role)) request = request.eq("client_roles.role",role);
        if (source) request = request.ilike("contact_source",`%${source.replace(/[%_*]/g," ")}%`);
        if (admin && agent) request = request.eq("assigned_agent",agent);
        const { data, count, error: listError } = await request.range((page-1)*perPage,page*perPage-1);
        if (listError) throw listError;
        if (active) { setRows((data ?? []) as ClientRow[]); setTotal(count ?? 0); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os clientes.");
      } finally { if (active) setLoading(false); }
    }
    void loadClients();
    return () => { active = false; };
  }, [search,q,role,source,agent,page,router]);

  function pageHref(next:number) { const nextQuery=new URLSearchParams(search); nextQuery.set("page",String(next)); return `/clientes?${nextQuery.toString()}`; }

  async function exportClients() {
    setExporting(true);setExportError("");
    try{
      const supabase=createClient();
      const join=role?"client_roles!inner(role)":"client_roles(role)";
      let exported:Record<string,unknown>[]=[];
      for(let start=0;;start+=1000){
        let request=supabase.from("clients").select(`name,document_number,phone,whatsapp,email,address,income,contact_source,assigned_agent,notes,consent_at,consent_method,created_at,${join}`).order("name",{ascending:true});
        if(q)request=request.or(["name","document_number","phone","email"].map(column=>`${column}.ilike.%${q}%`).join(","));
        if(role&&Object.keys(roleLabels).includes(role))request=request.eq("client_roles.role",role);
        if(source)request=request.ilike("contact_source",`%${source.replace(/[%_*]/g," ")}%`);
        if(isAdmin&&agent)request=request.eq("assigned_agent",agent);
        const {data,error:queryError}=await request.range(start,start+999);
        if(queryError)throw queryError;
        const batch=(data??[]) as Record<string,unknown>[];exported.push(...batch);
        if(batch.length<1000)break;
      }
      const headers=["Nome","CPF/CNPJ","Telefone","WhatsApp","E-mail","Endereço","Renda","Origem do contato","Corretor responsável","Papéis","Observações","Consentimento em","Forma do consentimento","Cadastrado em"];
      const rows=exported.map(item=>{
        const roleValues=(item.client_roles as {role:string}[]|null)?.map(value=>roleLabels[value.role]??value.role).join(", ")??"";
        const agentName=agents.find(value=>value.id===item.assigned_agent)?.full_name;
        return [item.name,item.document_number,item.phone,item.whatsapp,item.email,item.address,item.income,item.contact_source,agentName||item.assigned_agent,roleValues,item.notes,item.consent_at,item.consent_method,item.created_at] as (string|number|null)[];
      });
      downloadCsv(`clientes-${new Date().toISOString().slice(0,10)}.csv`,headers,rows);
    }catch(cause){setExportError(cause instanceof Error?cause.message:"Não foi possível exportar os clientes.");}
    finally{setExporting(false);}
  }

  async function printClients() {
    const reportWindow=window.open("","_blank");
    if(!reportWindow){setExportError("Permita pop-ups para gerar o PDF.");return;}
    setPrinting(true);setExportError("");
    try{
      const supabase=createClient();
      const join=role?"client_roles!inner(role)":"client_roles(role)";
      let exported:Record<string,unknown>[]=[];
      for(let start=0;;start+=1000){
        let request=supabase.from("clients").select(`name,document_number,phone,whatsapp,email,address,income,contact_source,assigned_agent,notes,consent_at,consent_method,created_at,${join}`).order("name",{ascending:true});
        if(q)request=request.or(["name","document_number","phone","email"].map(column=>`${column}.ilike.%${q}%`).join(","));
        if(role&&Object.keys(roleLabels).includes(role))request=request.eq("client_roles.role",role);
        if(source)request=request.ilike("contact_source",`%${source.replace(/[%_*]/g," ")}%`);
        if(isAdmin&&agent)request=request.eq("assigned_agent",agent);
        const {data,error:queryError}=await request.range(start,start+999);if(queryError)throw queryError;
        const batch=(data??[]) as Record<string,unknown>[];exported.push(...batch);if(batch.length<1000)break;
      }
      const rows=exported.map(item=>{
        const roleValues=(item.client_roles as {role:string}[]|null)?.map(value=>roleLabels[value.role]??value.role).join(", ")??"";
        const agentName=agents.find(value=>value.id===item.assigned_agent)?.full_name||String(item.assigned_agent??"");
        return [String(item.name??""),String(item.document_number??""),[item.phone,item.whatsapp].filter(Boolean).join(" / "),String(item.email??""),String(item.address??""),roleValues,String(item.contact_source??""),agentName];
      });
      openPrintableReport("Relatório de clientes",["Nome","CPF/CNPJ","Telefone / WhatsApp","E-mail","Endereço","Papéis","Origem do contato","Corretor responsável"],rows,reportWindow);
    }catch(cause){reportWindow.close();const detail=cause instanceof Error?cause.message:typeof cause==="object"&&cause!==null&&"message" in cause?String(cause.message):"Não foi possível gerar o relatório de clientes.";setExportError(detail);}
    finally{setPrinting(false);}
  }

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[var(--green)]">CRM / Clientes</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Clientes</h1><p className="mt-1 text-sm text-[var(--muted)]">{total} {total===1?"cliente":"clientes"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={exporting} onClick={()=>void exportClients()} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">{exporting?"Exportando...":"Exportar CSV"}</button><button type="button" disabled={printing} onClick={()=>void printClients()} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">{printing?"Preparando PDF...":"Exportar PDF"}</button><Link href="/clientes/novo" className="rounded-xl bg-[var(--green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--green-dark)]">+ Cadastrar cliente</Link></div></div>
    {exportError&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Falha ao exportar clientes: {exportError}</p>}
    {query.get("salvo")==="1"&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Cliente cadastrado com sucesso.</p>}
    {query.get("atualizado")==="1"&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Cliente atualizado com sucesso.</p>}
    <form method="get" className="mt-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium">Busca<input name="q" defaultValue={query.get("q") ?? ""} placeholder="Nome, CPF/CNPJ, telefone ou e-mail" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      <label className="text-sm font-medium">Papel<select name="papel" defaultValue={role} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"><option value="">Todos</option>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Origem do contato<input name="origem" defaultValue={source} placeholder="Ex.: indicação" className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"/></label>
      {isAdmin&&<label className="text-sm font-medium">Corretor responsável<select name="corretor" defaultValue={agent} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"><option value="">Todos</option>{agents.map(item=><option key={item.id} value={item.id}>{item.full_name||"Corretor"}</option>)}</select></label>}
      <div className="flex items-end gap-2 lg:col-span-4"><button className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white">Filtrar</button><Link href="/clientes" className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm">Limpar</Link></div>
    </form>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar os clientes: {error}</p>}
    {loading?<p role="status" className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">Carregando clientes...</p>:rows.length===0?<div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center"><h2 className="font-semibold">Nenhum cliente encontrado</h2><p className="mt-2 text-sm text-[var(--muted)]">Ajuste os filtros ou cadastre o primeiro cliente.</p></div>
      : <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white"><div className="divide-y divide-[var(--line)]">{rows.map(item=><article key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="min-w-0"><h2 className="truncate font-semibold">{item.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{[item.document_number,item.phone,item.email].filter(Boolean).join(" · ")||"Sem telefone ou e-mail"}</p><div className="mt-2 flex flex-wrap gap-2">{item.client_roles?.map(({role:clientRole})=><span key={clientRole} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{roleLabels[clientRole]??clientRole}</span>)}</div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-sm text-[var(--muted)]">{item.contact_source||"Origem não informada"}</span><div className="flex gap-3"><Link href={`/clientes/${item.id}`} className="shrink-0 text-sm font-semibold text-[var(--green)] hover:underline">Abrir</Link>{(isAdmin||item.created_by===userId)&&<Link href={`/clientes/${item.id}/editar`} className="shrink-0 text-sm font-semibold text-[var(--green)] hover:underline">Editar</Link>}</div></div></article>)}</div></div>}
    {total>perPage&&<nav aria-label="Paginação de clientes" className="mt-7 flex items-center justify-center gap-3"><Link aria-disabled={page<=1} href={pageHref(Math.max(1,page-1))} className={`rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm ${page<=1?"pointer-events-none opacity-40":""}`}>Anterior</Link><span className="text-sm text-[var(--muted)]">Página {page} de {Math.ceil(total/perPage)}</span><Link aria-disabled={page>=Math.ceil(total/perPage)} href={pageHref(Math.min(Math.ceil(total/perPage),page+1))} className={`rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm ${page>=Math.ceil(total/perPage)?"pointer-events-none opacity-40":""}`}>Próxima</Link></nav>}
  </div></main>;
}

export default function ClientsPage() { return <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Carregando clientes...</main>}><ClientsContent/></Suspense>; }
