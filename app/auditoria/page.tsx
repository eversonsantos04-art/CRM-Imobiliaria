"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type Actor = { id: string; full_name: string | null };
type AuditRow = { id: number; actor_id: string | null; entity_type: string; entity_id: string; operation: string; field_name: string; old_value: unknown; new_value: unknown; occurred_at: string };
type Filters = { actor: string; from: string; to: string; entity: string };
const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--green)]";
const entityNames: Record<string,string> = { clients:"Clientes", client_roles:"Papéis do cliente", client_interests:"Interesses", client_interest_neighborhoods:"Bairros de interesse", properties:"Imóveis", property_photos:"Fotos", property_documents:"Documentos", client_interactions:"Histórico de contato", follow_ups:"Follow-ups", profiles:"Usuários" };
const operationNames: Record<string,string> = { INSERT:"Criação", UPDATE:"Alteração", DELETE:"Exclusão" };
const fieldNames: Record<string,string> = {
  account_created:"Conta criada pelo admin", account_edited:"Conta editada pelo admin", account_deactivated:"Acesso desativado", account_restored:"Acesso restaurado", password_reset:"Senha redefinida pelo admin", account_deleted:"Conta excluída pelo admin",
  id:"Identificador", name:"Nome", full_name:"Nome completo", role:"Papel", document_number:"CPF/CNPJ", phone:"Telefone", whatsapp:"WhatsApp", email:"E-mail", address:"Endereço", income:"Renda", contact_source:"Origem do contato", assigned_agent:"Corretor responsável", notes:"Observações", consent_at:"Data do consentimento", consent_method:"Forma do consentimento", anonymized_at:"Data de anonimização", created_by:"Cadastrado por", created_at:"Data de cadastro", updated_at:"Última atualização",
  internal_code:"Cód. imóvel", title:"Título", description:"Descrição", property_type:"Tipo do imóvel", purpose:"Finalidade", status:"Status", postal_code:"CEP", street:"Logradouro", street_number:"Número", complement:"Complemento", neighborhood:"Bairro", city:"Cidade", state:"Estado", sale_price:"Valor de venda", rent_price:"Valor do aluguel", condo_fee:"Condomínio", property_tax:"IPTU", total_area:"Área total", built_area:"Área construída", bedrooms:"Quartos", suites:"Suítes", bathrooms:"Banheiros", parking_spaces:"Vagas", owner_client_id:"Proprietário",
  client_id:"Cliente", interaction_type:"Tipo de atividade", occurred_at:"Data da atividade", note:"Anotação", due_at:"Data do follow-up", completed_at:"Data de conclusão", position:"Ordem da foto", is_cover:"Foto de capa", storage_path:"Arquivo", file_name:"Nome do arquivo", entity_id:"Identificador do registro", replacement_user_id:"Responsável pelos registros", former_name:"Nome anterior",
};
const valueNames: Record<string,string> = { admin:"Administrador", corretor:"Corretor", comprador:"Comprador", locatario:"Locatário", proprietario:"Proprietário", investidor:"Investidor", casa:"Casa", apartamento:"Apartamento", terreno:"Terreno", comercial:"Comercial", rural:"Rural", venda:"Venda", aluguel:"Aluguel", ambos:"Venda e aluguel", disponivel:"Disponível", reservado:"Reservado", vendido:"Vendido", alugado:"Alugado", inativo:"Inativo", contato:"Contato", visita:"Visita", negociacao:"Negociação" };
const dateFields = new Set(["consent_at","anonymized_at","created_at","updated_at","occurred_at","due_at","completed_at"]);
const currencyFields = new Set(["income","sale_price","rent_price","condo_fee","property_tax"]);
function displayScalar(field:string,value:unknown) {
  if(value===null||value===undefined)return "—";
  if(typeof value==="boolean")return value?"Sim":"Não";
  if(dateFields.has(field)&&typeof value==="string") { const date=new Date(value); if(!Number.isNaN(date.getTime()))return date.toLocaleString("pt-BR"); }
  if(currencyFields.has(field)) { const number=typeof value==="number"?value:typeof value==="string"?Number(value):NaN; if(Number.isFinite(number))return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(number); }
  if(typeof value==="string")return valueNames[value]??value;
  if(typeof value==="object")try{return JSON.stringify(value);}catch{return String(value);}
  return String(value);
}
function displayValue(field:string,value:unknown) {
  if(value===null||value===undefined)return "—";
  if(typeof value==="object"&&!Array.isArray(value)){
    const entries=Object.entries(value as Record<string,unknown>);
    if(field==="password_reset"&&entries.length===0)return "Senha redefinida. O valor não é armazenado.";
    return entries.length?entries.map(([key,item])=>`${fieldNames[key]??key}: ${displayScalar(key,item)}`).join(" · "):"—";
  }
  return displayScalar(field,value);
}
function dateTime(value:string) { const date=new Date(value); return Number.isNaN(date.getTime())?value:date.toLocaleString("pt-BR"); }

export default function AuditPage() {
  const router=useRouter();
  const [authorized,setAuthorized]=useState(false);
  const [ready,setReady]=useState(false);
  const [actors,setActors]=useState<Actor[]>([]);
  const [rows,setRows]=useState<AuditRow[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [draft,setDraft]=useState<Filters>({actor:"",from:"",to:"",entity:""});
  const [filters,setFilters]=useState<Filters>({actor:"",from:"",to:"",entity:""});
  const [page,setPage]=useState(1);
  const perPage=50;

  useEffect(()=>{
    let active=true;
    async function checkAdmin(){
      try{
        const supabase=createClient();
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError)throw authError;
        if(!user){router.replace("/login");return;}
        const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).single();
        if(profileError)throw profileError;
        if(profile.role!=="admin"){if(active)setReady(true);return;}
        const {data:profiles,error:profilesError}=await supabase.from("profiles").select("id,full_name").order("full_name");
        if(profilesError)throw profilesError;
        if(active){setActors(profiles??[]);setAuthorized(true);setReady(true);}
      }catch(cause){if(active){setError(cause instanceof Error?cause.message:"Não foi possível conferir seu acesso.");setReady(true);}}
    }
    void checkAdmin();
    return()=>{active=false;};
  },[router]);

  useEffect(()=>{
    if(!authorized)return;
    let active=true;
    async function loadLogs(){
      setLoading(true);setError("");
      try{
        const supabase=createClient();
        let request=supabase.from("audit_logs").select("id,actor_id,entity_type,entity_id,operation,field_name,old_value,new_value,occurred_at",{count:"exact"}).neq("field_name","updated_at").order("occurred_at",{ascending:false});
        if(filters.actor)request=request.eq("actor_id",filters.actor);
        if(filters.entity)request=request.eq("entity_type",filters.entity);
        if(filters.from)request=request.gte("occurred_at",new Date(`${filters.from}T00:00:00`).toISOString());
        if(filters.to){const nextDay=new Date(`${filters.to}T00:00:00`);nextDay.setDate(nextDay.getDate()+1);request=request.lt("occurred_at",nextDay.toISOString());}
        const {data,count,error:queryError}=await request.range((page-1)*perPage,page*perPage-1);
        if(queryError)throw queryError;
        if(active){setRows((data??[]) as AuditRow[]);setTotal(count??0);}
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:"Não foi possível carregar o log.");}
      finally{if(active)setLoading(false);}
    }
    void loadLogs();
    return()=>{active=false;};
  },[authorized,filters,page]);

  function applyFilters(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(draft.from&&draft.to&&draft.from>draft.to){setError("A data inicial não pode ser posterior à data final.");return;}
    setPage(1);setFilters({...draft});
  }

  if(!ready)return <main className="flex min-h-screen items-center justify-center">Verificando acesso...</main>;
  if(!authorized)return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-3xl px-5 py-10"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-amber-900">O log de alterações pode ser acessado somente por um administrador.</p></section></div></main>;

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
    <p className="text-sm font-medium text-[var(--green)]">Administração</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Log de alterações</h1><p className="mt-1 text-sm text-[var(--muted)]">{total} alterações registradas. Esta área é exclusiva do admin.</p>
    <form onSubmit={applyFilters} className="mt-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium">Usuário<select value={draft.actor} onChange={event=>setDraft(current=>({...current,actor:event.target.value}))} className={field}><option value="">Todos</option>{actors.map(actor=><option key={actor.id} value={actor.id}>{actor.full_name||"Usuário sem nome"}</option>)}</select></label>
      <label className="text-sm font-medium">Tipo de registro<select value={draft.entity} onChange={event=>setDraft(current=>({...current,entity:event.target.value}))} className={field}><option value="">Todos</option>{Object.entries(entityNames).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
      <label className="text-sm font-medium">De<input type="date" value={draft.from} onChange={event=>setDraft(current=>({...current,from:event.target.value}))} className={field}/></label>
      <label className="text-sm font-medium">Até<input type="date" value={draft.to} onChange={event=>setDraft(current=>({...current,to:event.target.value}))} className={field}/></label>
      <div className="flex items-end gap-2 lg:col-span-4"><button className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white">Filtrar</button><button type="button" onClick={()=>{const clean={actor:"",from:"",to:"",entity:""};setDraft(clean);setPage(1);setFilters(clean);}} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm">Limpar</button></div>
    </form>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading?<p role="status" className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">Carregando alterações...</p>:rows.length===0?<div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center"><h2 className="font-semibold">Nenhuma alteração encontrada</h2><p className="mt-2 text-sm text-[var(--muted)]">Altere os filtros ou aguarde novos registros.</p></div>
      :<div className="mt-6 space-y-3">{rows.map(row=>{const actor=actors.find(item=>item.id===row.actor_id);return <article key={row.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{operationNames[row.operation]??row.operation}</span><span className="ml-2 text-sm font-semibold">{entityNames[row.entity_type]??row.entity_type}</span><p className="mt-2 text-xs text-[var(--muted)]">{actor?.full_name||"Usuário removido ou sem identificação"} · {dateTime(row.occurred_at)} · Registro {row.entity_id}</p></div><p className="text-sm font-medium">Campo: {fieldNames[row.field_name]??row.field_name}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-red-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-red-800">Valor anterior</p><p className="mt-1 break-words text-sm text-red-900">{displayValue(row.field_name,row.old_value)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Valor novo</p><p className="mt-1 break-words text-sm text-emerald-900">{displayValue(row.field_name,row.new_value)}</p></div></div></article>})}</div>}
    {total>perPage&&<nav aria-label="Paginação do log" className="mt-7 flex items-center justify-center gap-3"><button disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm disabled:opacity-40">Anterior</button><span className="text-sm text-[var(--muted)]">Página {page} de {Math.ceil(total/perPage)}</span><button disabled={page>=Math.ceil(total/perPage)} onClick={()=>setPage(value=>value+1)} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm disabled:opacity-40">Próxima</button></nav>}
  </div></main>;
}
