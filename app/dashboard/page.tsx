"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; role: string };
type FollowUpRow = { id: string; client_id: string; due_at: string; note: string | null; clients: { name: string } | { name: string }[] | null };
type Metric = { label: string; count: number };
const dateLabel = (value:string) => new Date(value).toLocaleString("pt-BR");
const propertyStatuses = [["disponivel","Disponíveis"],["reservado","Reservados"],["vendido","Vendidos"],["alugado","Alugados"],["inativo","Inativos"]];
const propertyTypes = [["casa","Casas"],["apartamento","Apartamentos"],["terreno","Terrenos"],["comercial","Comerciais"],["rural","Rurais"]];
const clientRoles = [["comprador","Compradores"],["locatario","Locatários"],["proprietario","Proprietários"],["investidor","Investidores"]];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [problem, setProblem] = useState("");
  const [overdue, setOverdue] = useState<FollowUpRow[]>([]);
  const [upcoming, setUpcoming] = useState<FollowUpRow[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [followUpError, setFollowUpError] = useState("");
  const [propertyStatusMetrics,setPropertyStatusMetrics]=useState<Metric[]>([]);
  const [propertyTypeMetrics,setPropertyTypeMetrics]=useState<Metric[]>([]);
  const [clientRoleMetrics,setClientRoleMetrics]=useState<Metric[]>([]);
  const [agentMetrics,setAgentMetrics]=useState<Metric[]>([]);
  const [metricsError,setMetricsError]=useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
        .select("full_name, role")
          .eq("id", user.id)
          .single();
        if (profileError) throw profileError;
        const now = new Date();
        if (active) setProfile(data as Profile);
        try {
          const agents=data.role==="admin"
            ? await supabase.from("profiles").select("id,full_name").order("full_name")
            : {data:[{id:user.id,full_name:data.full_name}],error:null};
          if(agents.error)throw agents.error;
          const [statusMetrics,typeMetrics,roleMetrics,agentResults]=await Promise.all([
            Promise.all(propertyStatuses.map(async([value,label])=>{const {count,error}=await supabase.from("properties").select("id",{count:"exact",head:true}).eq("status",value);if(error)throw error;return{label,count:count??0};})),
            Promise.all(propertyTypes.map(async([value,label])=>{const {count,error}=await supabase.from("properties").select("id",{count:"exact",head:true}).eq("property_type",value);if(error)throw error;return{label,count:count??0};})),
            Promise.all(clientRoles.map(async([value,label])=>{const {count,error}=await supabase.from("client_roles").select("client_id",{count:"exact",head:true}).eq("role",value);if(error)throw error;return{label,count:count??0};})),
            Promise.all((agents.data??[]).map(async(agent)=>{const {count,error}=await supabase.from("clients").select("id",{count:"exact",head:true}).eq("assigned_agent",agent.id);if(error)throw error;return{label:agent.full_name||"Corretor",count:count??0};})),
          ]);
          if(active){setPropertyStatusMetrics(statusMetrics);setPropertyTypeMetrics(typeMetrics);setClientRoleMetrics(roleMetrics);setAgentMetrics(agentResults);}
        }catch{if(active)setMetricsError("Não foi possível carregar todos os indicadores.");}
        try {
          const overdueQuery = supabase.from("follow_ups").select("id,client_id,due_at,note,clients!inner(name)",{count:"exact"}).is("completed_at",null).lte("due_at",now.toISOString()).order("due_at").limit(6);
          const upcomingQuery = supabase.from("follow_ups").select("id,client_id,due_at,note,clients!inner(name)",{count:"exact"}).is("completed_at",null).gt("due_at",now.toISOString()).order("due_at").limit(6);
          const [overdueResult,upcomingResult] = await Promise.all([overdueQuery,upcomingQuery]);
          if (overdueResult.error||upcomingResult.error) throw new Error("Falha ao consultar lembretes");
          if (active) {
            setOverdue((overdueResult.data??[]) as FollowUpRow[]); setUpcoming((upcomingResult.data??[]) as FollowUpRow[]);
            setOverdueCount(overdueResult.count??0); setUpcomingCount(upcomingResult.count??0);
          }
        } catch {
          if (active) setFollowUpError("Não foi possível carregar os lembretes.");
        }
      } catch (error) {
        if (active) {
          setProblem(error instanceof Error ? error.message : "Não foi possível carregar seu perfil.");
        }
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [router]);

  if (problem) return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-5"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold">Não foi possível abrir o painel</h1><p className="mt-2 text-sm text-amber-900">{problem}</p><Link href="/login" className="mt-4 inline-block font-medium text-[var(--green)] underline">Voltar ao login</Link></section></main>;
  if (!profile) return <main className="flex min-h-screen items-center justify-center px-5"><p role="status" className="text-sm text-[var(--muted)]">Conferindo seu acesso...</p></main>;

  return <main className="min-h-screen"><AppHeader />
    <div className="mx-auto max-w-6xl px-5 py-8 sm:py-12"><p className="text-sm font-medium text-[var(--green)]">Visão geral</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Olá{profile.full_name ? `, ${profile.full_name}` : ""}.</h1><p className="mt-2 text-[var(--muted)]">Seu acesso está configurado como <span className="font-medium text-[var(--ink)]">{profile.role}</span>.</p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2"><Link href="/imoveis" className="rounded-2xl border border-[var(--line)] bg-white p-6 transition hover:border-emerald-300"><p className="text-sm text-[var(--muted)]">Imóveis</p><p className="mt-2 text-xl font-semibold">Abrir imóveis</p><p className="mt-2 text-sm text-[var(--muted)]">Cadastre, busque e atualize imóveis.</p></Link><Link href="/clientes" className="rounded-2xl border border-[var(--line)] bg-white p-6 transition hover:border-emerald-300"><p className="text-sm text-[var(--muted)]">Clientes</p><p className="mt-2 text-xl font-semibold">Abrir clientes</p><p className="mt-2 text-sm text-[var(--muted)]">Cadastre e consulte sua carteira.</p></Link></section>
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-red-800">Acompanhamentos vencidos</p><p className="mt-1 text-2xl font-semibold text-red-900">{overdueCount}</p></div><Link href="/clientes" className="text-sm font-semibold text-red-800 hover:underline">Ver clientes</Link></div>{followUpError?<p className="mt-4 text-sm text-red-800">{followUpError}</p>:overdue.length===0?<p className="mt-4 text-sm text-red-800">Nenhum follow-up vencido.</p>:<ul className="mt-4 space-y-3">{overdue.map(item=>{const person=Array.isArray(item.clients)?item.clients[0]:item.clients;return <li key={item.id} className="border-t border-red-200 pt-3"><Link href={`/clientes/${item.client_id}`} className="font-medium text-red-900 hover:underline">{person?.name??"Cliente"}</Link><p className="mt-1 text-xs text-red-800">Venceu em {dateLabel(item.due_at)}{item.note?` · ${item.note}`:""}</p></li>})}</ul>}</article>
        <article className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-[var(--muted)]">Follow-ups pendentes</p><p className="mt-1 text-2xl font-semibold">{upcomingCount}</p></div><Link href="/clientes" className="text-sm font-semibold text-[var(--green)] hover:underline">Ver clientes</Link></div>{followUpError?<p className="mt-4 text-sm text-[var(--muted)]">{followUpError}</p>:upcoming.length===0?<p className="mt-4 text-sm text-[var(--muted)]">Nenhum follow-up pendente.</p>:<ul className="mt-4 space-y-3">{upcoming.map(item=>{const person=Array.isArray(item.clients)?item.clients[0]:item.clients;return <li key={item.id} className="border-t border-[var(--line)] pt-3"><Link href={`/clientes/${item.client_id}`} className="font-medium hover:underline">{person?.name??"Cliente"}</Link><p className="mt-1 text-xs text-[var(--muted)]">{dateLabel(item.due_at)}{item.note?` · ${item.note}`:""}</p></li>})}</ul>}</article>
      </section></div>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 sm:grid-cols-2 xl:grid-cols-4">
        {metricsError&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 xl:col-span-4">{metricsError}</p>}
        {[{title:"Imóveis por status",items:propertyStatusMetrics},{title:"Imóveis por tipo",items:propertyTypeMetrics},{title:"Clientes por papel",items:clientRoleMetrics},{title:profile.role==="admin"?"Clientes por corretor":"Minha carteira",items:agentMetrics}].map(group=><article key={group.title} className="rounded-2xl border border-[var(--line)] bg-white p-5"><h2 className="font-semibold">{group.title}</h2><ul className="mt-3 space-y-2">{group.items.map(item=><li key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="text-[var(--muted)]">{item.label}</span><span className="font-semibold">{item.count}</span></li>)}</ul></article>)}
      </section>
  </main>;
}
