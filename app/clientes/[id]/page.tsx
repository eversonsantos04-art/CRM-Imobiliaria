"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type ClientData = { id: string; name: string; document_number: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; contact_source: string | null; notes: string | null; assigned_agent: string; created_by: string; anonymized_at: string | null };
type Interaction = { id: string; interaction_type: string; occurred_at: string; note: string | null };
type FollowUp = { id: string; due_at: string; note: string | null; completed_at: string | null; assigned_agent: string };
type Agent = { id: string; full_name: string | null };
type Interest = { id: string; property_type: string | null; purpose: string | null; min_price: number | null; max_price: number | null; min_bedrooms: number | null };
type InterestNeighborhood = { interest_id: string; neighborhood: string };
type PropertySuggestion = { id: string; internal_code: string; title: string; property_type: string; purpose: string; neighborhood: string | null; city: string | null; sale_price: number | null; rent_price: number | null; bedrooms: number | null; created_at: string };
const interactionLabels: Record<string,string> = { contato:"Contato", visita:"Visita", negociacao:"Negociação" };
const propertyTypeLabels: Record<string,string> = { casa:"Casa", apartamento:"Apartamento", terreno:"Terreno", comercial:"Comercial", rural:"Rural" };
const purposeLabels: Record<string,string> = { venda:"Venda", aluguel:"Aluguel", ambos:"Venda e aluguel" };
const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--green)]";
const label = "block text-sm font-medium text-[var(--ink)]";
const localDateTime = (value:string) => { const date=new Date(value); return Number.isNaN(date.getTime())?value:date.toLocaleString("pt-BR"); };
function normalize(value:string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }
function getSuggestedProperties(properties:PropertySuggestion[],interests:Interest[],neighborhoods:InterestNeighborhood[]) {
  return properties.filter(property=>interests.some(interest=>{
    const wantedNeighborhoods=neighborhoods.filter(item=>item.interest_id===interest.id).map(item=>normalize(item.neighborhood));
    const hasCriteria=Boolean(interest.property_type||interest.purpose||interest.min_price!==null||interest.max_price!==null||interest.min_bedrooms!==null||wantedNeighborhoods.length);
    if(!hasCriteria)return false;
    if(interest.property_type&&interest.property_type!==property.property_type)return false;
    if(interest.purpose==="venda"&&!(["venda","ambos"].includes(property.purpose)))return false;
    if(interest.purpose==="aluguel"&&!(["aluguel","ambos"].includes(property.purpose)))return false;
    if(interest.min_bedrooms!==null&&(property.bedrooms===null||property.bedrooms<interest.min_bedrooms))return false;
    if(wantedNeighborhoods.length&&(!property.neighborhood||!wantedNeighborhoods.includes(normalize(property.neighborhood))))return false;
    if(interest.min_price!==null||interest.max_price!==null){
      const prices=interest.purpose==="venda"?[property.sale_price]:interest.purpose==="aluguel"?[property.rent_price]:property.purpose==="venda"?[property.sale_price]:property.purpose==="aluguel"?[property.rent_price]:[property.sale_price,property.rent_price];
      const inRange=prices.some(price=>price!==null&&(interest.min_price===null||price>=interest.min_price)&&(interest.max_price===null||price<=interest.max_price));
      if(!inRange)return false;
    }
    return true;
  })).slice(0,6);
}

export default function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [hasInterestProfile, setHasInterestProfile] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        const [profileResult, clientResult, rolesResult, interactionResult, followUpResult, interestsResult] = await Promise.all([
          supabase.from("profiles").select("role").eq("id",user.id).single(),
          supabase.from("clients").select("id,name,document_number,phone,whatsapp,email,address,contact_source,notes,assigned_agent,created_by,anonymized_at").eq("id",id).maybeSingle(),
          supabase.from("client_roles").select("role").eq("client_id",id),
          supabase.from("client_interactions").select("id,interaction_type,occurred_at,note").eq("client_id",id).order("occurred_at",{ascending:false}),
          supabase.from("follow_ups").select("id,due_at,note,completed_at,assigned_agent").eq("client_id",id).order("due_at",{ascending:true}),
          supabase.from("client_interests").select("id,property_type,purpose,min_price,max_price,min_bedrooms").eq("client_id",id),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (clientResult.error) throw clientResult.error;
        if (!clientResult.data) { if (active) setError("Cliente não encontrado ou sem permissão de visualização."); return; }
        if (rolesResult.error) throw rolesResult.error;
        if (interactionResult.error) throw interactionResult.error;
        if (followUpResult.error) throw followUpResult.error;
        if (interestsResult.error) throw interestsResult.error;
        const interests=(interestsResult.data??[]) as Interest[];
        let matchedProperties:PropertySuggestion[]=[];
        let matchedNeighborhoods:InterestNeighborhood[]=[];
        let matchError="";
        if(interests.length){
          const interestIds=interests.map(item=>item.id);
          const {data:neighborhoodRows,error:neighborhoodError}=await supabase.from("client_interest_neighborhoods").select("interest_id,neighborhood").in("interest_id",interestIds);
          if(neighborhoodError)matchError=neighborhoodError.message;
          else matchedNeighborhoods=(neighborhoodRows??[]) as InterestNeighborhood[];
          if(!matchError){
            const {data:availableProperties,error:propertiesError}=await supabase.from("properties").select("id,internal_code,title,property_type,purpose,neighborhood,city,sale_price,rent_price,bedrooms,created_at").eq("status","disponivel").order("created_at",{ascending:false}).limit(1000);
            if(propertiesError)matchError=propertiesError.message;
            else matchedProperties=getSuggestedProperties((availableProperties??[]) as PropertySuggestion[],interests,matchedNeighborhoods);
          }
        }
        const admin = profileResult.data.role === "admin";
        let agentRows: Agent[] = [];
        if (admin) {
          const { data, error: agentError } = await supabase.from("profiles").select("id,full_name").order("full_name");
          if (agentError) throw agentError;
          agentRows = data ?? [];
        }
        if (active) {
          setUserId(user.id); setIsAdmin(admin); setCanEdit(!clientResult.data.anonymized_at&&(admin||clientResult.data.created_by===user.id));
          setClient(clientResult.data as ClientData); setRoles((rolesResult.data??[]).map(item=>item.role));
          setInteractions((interactionResult.data??[]) as Interaction[]); setFollowUps((followUpResult.data??[]) as FollowUp[]); setAgents(agentRows);
          setHasInterestProfile(interests.length>0); setSuggestions(matchedProperties); setSuggestionError(matchError);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error?cause.message:"Não foi possível carregar o cliente.");
      } finally { if (active) setLoading(false); }
    }
    void loadDetails();
    return () => { active = false; };
  }, [id,router]);

  async function addInteraction(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!client)return;
    setSaving(true); setError("");
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const payload={client_id:client.id,interaction_type:String(form.get("interaction_type")??"contato"),occurred_at:new Date(String(form.get("occurred_at")??"")).toISOString(),note:String(form.get("note")??"").trim()||null,created_by:userId};
    const {data,error:insertError}=await createClient().from("client_interactions").insert(payload).select("id,interaction_type,occurred_at,note").single();
    if(insertError||!data){setError(`Não foi possível registrar o histórico: ${insertError?.message??"erro desconhecido"}`);setSaving(false);return;}
    setInteractions(current=>[data as Interaction,...current].sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at)));
    formElement.reset();setSaving(false);
  }

  async function addFollowUp(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!client)return;
    setSaving(true);setError("");
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const dueAt=String(form.get("due_at")??"");
    const assignedAgent=isAdmin?String(form.get("assigned_agent")??userId):userId;
    const {data,error:insertError}=await createClient().from("follow_ups").insert({client_id:client.id,assigned_agent:assignedAgent,due_at:new Date(dueAt).toISOString(),note:String(form.get("note")??"").trim()||null,created_by:userId}).select("id,due_at,note,completed_at,assigned_agent").single();
    if(insertError||!data){setError(`Não foi possível criar o lembrete: ${insertError?.message??"erro desconhecido"}`);setSaving(false);return;}
    setFollowUps(current=>[...current,data as FollowUp].sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at)));
    formElement.reset();setSaving(false);
  }

  async function completeFollowUp(followUp:FollowUp) {
    setSaving(true);setError("");
    const completedAt=new Date().toISOString();
    const {error:updateError}=await createClient().from("follow_ups").update({completed_at:completedAt}).eq("id",followUp.id);
    if(updateError){setError(`Não foi possível concluir o lembrete: ${updateError.message}`);setSaving(false);return;}
    setFollowUps(current=>current.map(item=>item.id===followUp.id?{...item,completed_at:completedAt}:item));
    setSaving(false);
  }

  async function anonymizeClient() {
    if(!client||!window.confirm("Anonimizar este cliente? Dados de contato, documentos, observações, papéis, interesses e lembretes serão removidos. A ação não pode ser desfeita."))return;
    setSaving(true);setError("");
    try{
      const {error:anonymizeError}=await createClient().rpc("anonymize_client",{target_client_id:client.id});
      if(anonymizeError)throw anonymizeError;
      window.location.reload();
    }catch(cause){
      const message=cause instanceof Error?cause.message:typeof cause==="object"&&cause!==null&&"message" in cause?String(cause.message):"erro desconhecido";
      setError(`Não foi possível anonimizar o cliente: ${message}`);setSaving(false);
    }
  }

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-5xl px-5 py-7 sm:py-10">
    <p className="text-sm text-[var(--muted)]"><Link href="/clientes" className="text-[var(--green)] hover:underline">Clientes</Link> / Detalhes</p>
    {loading?<p role="status" className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Carregando histórico...</p>
      :error&&!client?<section role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-900">{error}</p><Link href="/clientes" className="mt-4 inline-block font-medium text-[var(--green)]">Voltar aos clientes</Link></section>
      :client&&<>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{client.name}</h1>{client.anonymized_at?<p className="mt-2 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">Dados anonimizados</p>:<p className="mt-2 text-sm text-[var(--muted)]">{[client.document_number,client.phone,client.whatsapp,client.email].filter(Boolean).join(" · ")}</p>}<div className="mt-3 flex flex-wrap gap-2">{roles.map(role=><span key={role} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{({comprador:"Comprador",locatario:"Locatário",proprietario:"Proprietário",investidor:"Investidor"} as Record<string,string>)[role]??role}</span>)}</div></div><div className="flex flex-wrap gap-3">{canEdit&&<Link href={`/clientes/${client.id}/editar`} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold">Editar cliente</Link>}{isAdmin&&!client.anonymized_at&&<button type="button" disabled={saving} onClick={()=>void anonymizeClient()} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-60">Anonimizar dados</button>}<Link href="/clientes" className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm">Voltar</Link></div></div>
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Contato</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-[var(--muted)]">Endereço:</span> {client.address||"Não informado"}</p><p><span className="text-[var(--muted)]">Origem:</span> {client.contact_source||"Não informada"}</p></div>{client.notes&&<p className="mt-4 whitespace-pre-wrap text-sm"><span className="text-[var(--muted)]">Observações:</span> {client.notes}</p>}</section>
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Imóveis compatíveis</h2>{suggestions.length>0&&<span className="text-sm text-[var(--muted)]">Até 6 sugestões</span>}</div>
          {suggestionError?<p role="alert" className="mt-3 text-sm text-red-700">Não foi possível buscar imóveis: {suggestionError}</p>
            :!hasInterestProfile?<p className="mt-3 text-sm text-[var(--muted)]">Este cliente ainda não tem perfil de interesse.{canEdit&&<> Adicione os critérios em <Link href={`/clientes/${client.id}/editar`} className="font-medium text-[var(--green)] hover:underline">Editar cliente</Link>.</>}</p>
            :suggestions.length===0?<p className="mt-3 text-sm text-[var(--muted)]">Nenhum imóvel disponível corresponde a todos os critérios informados.</p>
            :<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{suggestions.map(property=><article key={property.id} className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--green)]">Cód. imóvel: {property.internal_code}</p><h3 className="mt-1 font-semibold">{property.title}</h3><p className="mt-2 text-sm text-[var(--muted)]">{[propertyTypeLabels[property.property_type]??property.property_type,purposeLabels[property.purpose]??property.purpose,property.neighborhood,property.city].filter(Boolean).join(" · ")}</p>{property.sale_price!==null&&<p className="mt-3 text-sm font-medium">Venda: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(property.sale_price)}</p>}{property.rent_price!==null&&<p className="mt-1 text-sm font-medium">Aluguel: {new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(property.rent_price)}/mês</p>}<Link href={`/imoveis?q=${encodeURIComponent(property.internal_code)}`} className="mt-3 inline-block text-sm font-semibold text-[var(--green)] hover:underline">Ver imóvel na listagem</Link></article>)}</div>}
        </section>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Registrar contato ou visita</h2>{!client.anonymized_at&&<form onSubmit={addInteraction} className="mt-4 space-y-3"><label className={label}>Tipo<select name="interaction_type" className={field}><option value="contato">Contato</option><option value="visita">Visita</option><option value="negociacao">Negociação</option></select></label><label className={label}>Data e hora<input required type="datetime-local" name="occurred_at" defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} className={field}/></label><label className={label}>Anotação<textarea name="note" className={field+" min-h-20"} placeholder="Resumo do contato, visita ou negociação"/></label><button disabled={saving} className="rounded-xl bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Registrar</button></form>}
            <h3 className="mt-6 border-t border-[var(--line)] pt-5 font-semibold">Histórico</h3>{interactions.length===0?<p className="mt-3 text-sm text-[var(--muted)]">Nenhuma atividade registrada.</p>:<ol className="mt-3 space-y-4">{interactions.map(item=><li key={item.id} className="border-l-2 border-emerald-200 pl-4"><p className="text-sm font-medium">{interactionLabels[item.interaction_type]??item.interaction_type}<span className="ml-2 font-normal text-[var(--muted)]">{localDateTime(item.occurred_at)}</span></p>{item.note&&<p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{item.note}</p>}</li>)}</ol>}</section>
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Lembrete de follow-up</h2>{!client.anonymized_at&&<form onSubmit={addFollowUp} className="mt-4 space-y-3"><label className={label}>Data e hora<input required type="datetime-local" name="due_at" className={field}/></label>{isAdmin&&<label className={label}>Responsável<select name="assigned_agent" defaultValue={client.assigned_agent} className={field}>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.full_name||"Corretor"}</option>)}</select></label>}<label className={label}>Anotação<textarea name="note" className={field+" min-h-20"} placeholder="O que precisa ser acompanhado?"/></label><button disabled={saving} className="rounded-xl bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Criar lembrete</button></form>}
            <h3 className="mt-6 border-t border-[var(--line)] pt-5 font-semibold">Próximos e pendentes</h3>{followUps.length===0?<p className="mt-3 text-sm text-[var(--muted)]">Nenhum lembrete registrado.</p>:<ul className="mt-3 space-y-3">{followUps.map(item=>{const overdue=!item.completed_at&&Date.parse(item.due_at)<Date.now();return <li key={item.id} className={`rounded-xl border p-3 ${overdue?"border-red-200 bg-red-50":"border-[var(--line)]"}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-medium ${overdue?"text-red-800":""}`}>{localDateTime(item.due_at)}{overdue&&<span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs">Vencido</span>}{item.completed_at&&<span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs">Concluído</span>}</p>{item.note&&<p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{item.note}</p>}</div>{!item.completed_at&&<button type="button" disabled={saving} onClick={()=>void completeFollowUp(item)} className="shrink-0 text-sm font-semibold text-[var(--green)] hover:underline">Concluir</button>}</div></li>})}</ul>}
          </section>
        </div>
        {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </>}
  </div></main>;
}
