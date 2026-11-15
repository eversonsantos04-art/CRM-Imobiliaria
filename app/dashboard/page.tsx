"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; role: string };
type FollowUpRow = { id: string; client_id: string; due_at: string; note: string | null; clients: { name: string } | { name: string }[] | null };
type Metric = { label: string; count: number };
type SummaryIconName = "properties" | "clients" | "followups" | "available";
const dateLabel = (value:string) => new Date(value).toLocaleString("pt-BR");
const propertyStatuses = [["disponivel","Disponíveis"],["reservado","Reservados"],["vendido","Vendidos"],["alugado","Alugados"],["inativo","Inativos"]];
const propertyTypes = [["casa","Casas"],["apartamento","Apartamentos"],["terreno","Terrenos"],["comercial","Comerciais"],["rural","Rurais"]];
const clientRoles = [["comprador","Compradores"],["locatario","Locatários"],["proprietario","Proprietários"],["investidor","Investidores"]];

function SummaryIcon({ name }: { name: SummaryIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "properties") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m3 11 9-8 9 8v10H3zM8 21v-8h8v8" /></svg>;
  if (name === "clients") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a4 4 0 0 1 0 7m2 3a5 5 0 0 1 3 4v2" /></svg>;
  if (name === "followups") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
}

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
  const [propertyTotal,setPropertyTotal]=useState(0);
  const [clientTotal,setClientTotal]=useState(0);

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

        const [profileResult, propertiesCount, clientsCount] = await Promise.all([
          supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
          supabase.from("properties").select("id", { count: "exact", head: true }),
          supabase.from("clients").select("id", { count: "exact", head: true }),
        ]);
        const { data, error: profileError } = profileResult;
        if (profileError) throw profileError;
        const now = new Date();
        if (active) {
          setProfile(data as Profile);
          if (propertiesCount.error || clientsCount.error) {
            setMetricsError("Não foi possível carregar todos os indicadores.");
          } else {
            setPropertyTotal(propertiesCount.count ?? 0);
            setClientTotal(clientsCount.count ?? 0);
          }
        }
        const followUpQueries = Promise.all([
          supabase.from("follow_ups").select("id,client_id,due_at,note,clients!inner(name)", { count: "exact" }).is("completed_at", null).lte("due_at", now.toISOString()).order("due_at").limit(6),
          supabase.from("follow_ups").select("id,client_id,due_at,note,clients!inner(name)", { count: "exact" }).is("completed_at", null).gt("due_at", now.toISOString()).order("due_at").limit(6),
        ]);
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
          const [overdueResult,upcomingResult] = await followUpQueries;
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

  const availableCount = propertyStatusMetrics.find((item) => item.label === "Disponíveis")?.count ?? 0;
  const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
  const summary = [
    { label: "Imóveis cadastrados", value: propertyTotal, hint: "Abrir carteira", href: "/imoveis", icon: "properties" as const },
    { label: "Clientes na carteira", value: clientTotal, hint: "Ver clientes", href: "/clientes", icon: "clients" as const },
    { label: "Follow-ups vencidos", value: overdueCount, hint: "Acompanhar hoje", href: "/agenda", icon: "followups" as const },
    { label: "Imóveis disponíveis", value: availableCount, hint: "Publicados na vitrine", href: "/imoveis?status=disponivel", icon: "available" as const },
  ];
  const charts = [
    { title: "Imóveis por status", items: propertyStatusMetrics },
    { title: "Imóveis por tipo", items: propertyTypeMetrics },
    { title: "Clientes por papel", items: clientRoleMetrics },
    { title: profile.role === "admin" ? "Clientes por corretor" : "Minha carteira", items: agentMetrics },
  ];

  return <main className="min-h-screen"><AppHeader />
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-7 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--green)]">Painel / Visão geral</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Olá{profile.full_name ? `, ${profile.full_name}` : ""}.</h1><p className="mt-2 text-sm text-[var(--muted)]">Acompanhe os imóveis, clientes e próximos atendimentos.</p></div>
        <Link href="/imoveis/novo" className="crm-primary-action">+ Cadastrar imóvel</Link>
      </div>

      {metricsError && <p role="alert" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-200/10 p-3 text-sm text-amber-100">{metricsError}</p>}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da carteira">
        {summary.map((item) => <Link key={item.label} href={item.href} className="crm-dashboard-stat">
          <span className="crm-dashboard-stat__label">{item.label}</span><span className="crm-dashboard-stat__icon"><SummaryIcon name={item.icon} /></span>
          <span className="crm-dashboard-stat__value">{number(item.value)}</span><span className="crm-dashboard-stat__hint">{item.hint} ↗</span>
        </Link>)}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Acompanhamentos">
        <article className="crm-dashboard-panel crm-dashboard-panel--warning p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Acompanhamentos vencidos</h2><p className="crm-dashboard-muted mt-1 text-xs">Clientes que precisam de retorno</p></div><strong className="text-2xl text-amber-300">{number(overdueCount)}</strong></div>
          {followUpError ? <p role="alert" className="mt-4 text-sm text-amber-100">{followUpError}</p> : overdue.length === 0 ? <p className="crm-dashboard-muted mt-5 text-sm">Nenhum follow-up vencido.</p> : <ul className="mt-4 space-y-3">{overdue.map((item) => { const person = Array.isArray(item.clients) ? item.clients[0] : item.clients; return <li key={item.id} className="crm-dashboard-panel__row border-t pt-3"><Link href={`/clientes/${item.client_id}`} className="crm-dashboard-panel__name text-sm font-semibold hover:underline">{person?.name ?? "Cliente"}</Link><p className="crm-dashboard-panel__detail mt-1 text-xs">Venceu em {dateLabel(item.due_at)}{item.note ? ` · ${item.note}` : ""}</p></li>; })}</ul>}
        </article>
        <article className="crm-dashboard-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Próximos follow-ups</h2><p className="crm-dashboard-muted mt-1 text-xs">Agenda da equipe</p></div><strong className="text-2xl text-[#f1eee5]">{number(upcomingCount)}</strong></div>
          {followUpError ? <p role="alert" className="crm-dashboard-muted mt-4 text-sm">{followUpError}</p> : upcoming.length === 0 ? <p className="crm-dashboard-muted mt-5 text-sm">Nenhum follow-up pendente.</p> : <ul className="mt-4 space-y-3">{upcoming.map((item) => { const person = Array.isArray(item.clients) ? item.clients[0] : item.clients; return <li key={item.id} className="crm-dashboard-panel__row border-t pt-3"><Link href={`/clientes/${item.client_id}`} className="crm-dashboard-panel__name text-sm font-semibold hover:underline">{person?.name ?? "Cliente"}</Link><p className="crm-dashboard-panel__detail mt-1 text-xs">{dateLabel(item.due_at)}{item.note ? ` · ${item.note}` : ""}</p></li>; })}</ul>}
        </article>
      </section>
    </div>

    <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-10 sm:grid-cols-2 sm:px-7 xl:grid-cols-4" aria-label="Indicadores da carteira">
      {charts.map((group) => <article key={group.title} className="crm-dashboard-panel p-5"><h2 className="text-sm font-semibold">{group.title}</h2><ul className="mt-4 space-y-3">{group.items.map((item) => <li key={item.label} className="flex items-center justify-between gap-3 border-b border-[#302f28] pb-2 text-xs last:border-0 last:pb-0"><span className="crm-dashboard-muted">{item.label}</span><span className="font-semibold text-[#f1eee5]">{number(item.count)}</span></li>)}</ul></article>)}
    </section>
  </main>;
}
