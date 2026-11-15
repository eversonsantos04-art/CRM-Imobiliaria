"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type FollowUp = {
  id: string;
  client_id: string;
  due_at: string;
  note: string | null;
  completed_at: string | null;
  assigned_agent: string;
  clients: { name: string } | { name: string }[] | null;
};
type ClientOption = { id: string; name: string; assigned_agent: string };
type Agent = { id: string; full_name: string | null };
type View = "today" | "next" | "overdue" | "pending" | "completed";

const views: { id: View; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "next", label: "Próximos 7 dias" },
  { id: "overdue", label: "Atrasados" },
  { id: "pending", label: "Todos pendentes" },
  { id: "completed", label: "Concluídos" },
];
const inputClass = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)]";
const labelClass = "block text-sm font-medium text-[var(--ink)]";
const clientName = (item: FollowUp) => Array.isArray(item.clients) ? item.clients[0]?.name ?? "Cliente" : item.clients?.name ?? "Cliente";
const dateTimeLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateInputValue = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
const dayEnd = (value: Date) => dayStart(value) + 24 * 60 * 60 * 1000 - 1;

function AgendaContent() {
  const router = useRouter();
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<View>("today");
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [dueAtInput, setDueAtInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAgenda() {
      setDueAtInput(dateInputValue(new Date(Date.now() + 60 * 60 * 1000)));
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        if (authError) throw authError;
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profileError) throw profileError;
        const admin = profile.role === "admin";
        const [followUpsResult, clientsResult, agentsResult] = await Promise.all([
          supabase.from("follow_ups").select("id,client_id,due_at,note,completed_at,assigned_agent,clients!inner(name)").is("completed_at", null).order("due_at", { ascending: true }).limit(500),
          supabase.from("clients").select("id,name,assigned_agent").order("name", { ascending: true }).limit(1000),
          admin ? supabase.from("profiles").select("id,full_name").order("full_name") : Promise.resolve({ data: [{ id: user.id, full_name: null }] as Agent[], error: null }),
        ]);
        if (followUpsResult.error) throw followUpsResult.error;
        if (clientsResult.error) throw clientsResult.error;
        if (agentsResult.error) throw agentsResult.error;
        const { data: completedData, error: completedError } = await supabase.from("follow_ups")
          .select("id,client_id,due_at,note,completed_at,assigned_agent,clients!inner(name)")
          .not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(100);
        if (completedError) throw completedError;
        if (active) {
          setUserId(user.id);
          setIsAdmin(admin);
          setRows([...(followUpsResult.data ?? []), ...(completedData ?? [])] as unknown as FollowUp[]);
          setClients((clientsResult.data ?? []) as ClientOption[]);
          setAgents((agentsResult.data ?? []) as Agent[]);
          setSelectedClient((clientsResult.data ?? [])[0]?.id ?? "");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a agenda.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAgenda();
    return () => { active = false; };
  }, [router]);

  const counts = useMemo(() => {
    const now = new Date();
    const todayStart = dayStart(now);
    const todayEnd = dayEnd(now);
    const nextWeekEnd = todayStart + 8 * 24 * 60 * 60 * 1000 - 1;
    return {
      today: rows.filter(item => !item.completed_at && Date.parse(item.due_at) >= todayStart && Date.parse(item.due_at) <= todayEnd).length,
      next: rows.filter(item => !item.completed_at && Date.parse(item.due_at) > todayEnd && Date.parse(item.due_at) <= nextWeekEnd).length,
      overdue: rows.filter(item => !item.completed_at && Date.parse(item.due_at) < todayStart).length,
      pending: rows.filter(item => !item.completed_at).length,
      completed: rows.filter(item => Boolean(item.completed_at)).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const now = new Date();
    const todayStart = dayStart(now);
    const todayEnd = dayEnd(now);
    const nextWeekEnd = todayStart + 8 * 24 * 60 * 60 * 1000 - 1;
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(item => {
      const due = Date.parse(item.due_at);
      const completed = Boolean(item.completed_at);
      const matchesView = view === "completed" ? completed
        : view === "today" ? !completed && due >= todayStart && due <= todayEnd
        : view === "next" ? !completed && due > todayEnd && due <= nextWeekEnd
        : view === "overdue" ? !completed && due < todayStart
        : !completed;
      const matchesAgent = !isAdmin || !agentFilter || item.assigned_agent === agentFilter;
      const matchesSearch = !term || `${clientName(item)} ${item.note ?? ""}`.toLocaleLowerCase("pt-BR").includes(term);
      return matchesView && matchesAgent && matchesSearch;
    }).sort((a, b) => view === "completed"
      ? Date.parse(b.completed_at ?? b.due_at) - Date.parse(a.completed_at ?? a.due_at)
      : Date.parse(a.due_at) - Date.parse(b.due_at));
  }, [agentFilter, isAdmin, rows, search, view]);

  async function addFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const clientId = String(form.get("client_id") ?? "");
    const dueValue = String(form.get("due_at") ?? "");
    const dueAt = new Date(dueValue);
    const client = clients.find(item => item.id === clientId);
    if (!client || Number.isNaN(dueAt.getTime())) { setError("Escolha um cliente e uma data válida."); return; }
    setSaving(true); setError(""); setNotice("");
    const assignedAgent = isAdmin ? String(form.get("assigned_agent") || client.assigned_agent || userId) : userId;
    const { data, error: insertError } = await createClient().from("follow_ups").insert({
      client_id: clientId,
      assigned_agent: assignedAgent,
      due_at: dueAt.toISOString(),
      note: String(form.get("note") ?? "").trim() || null,
      created_by: userId,
    }).select("id,client_id,due_at,note,completed_at,assigned_agent,clients!inner(name)").single();
    if (insertError || !data) {
      setError(`Não foi possível criar o acompanhamento: ${insertError?.message ?? "erro desconhecido"}`);
      setSaving(false);
      return;
    }
    setRows(current => [data as unknown as FollowUp, ...current]);
    setView("pending");
    setNotice("Acompanhamento adicionado à agenda.");
    formElement.reset();
    setSelectedClient(clients[0]?.id ?? "");
    setDueAtInput(dateInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setSaving(false);
  }

  async function completeFollowUp(item: FollowUp) {
    setSavingId(item.id); setError(""); setNotice("");
    const completedAt = new Date().toISOString();
    const { error: updateError } = await createClient().from("follow_ups").update({ completed_at: completedAt }).eq("id", item.id);
    if (updateError) {
      setError(`Não foi possível concluir o acompanhamento: ${updateError.message}`);
      setSavingId("");
      return;
    }
    setRows(current => current.map(row => row.id === item.id ? { ...row, completed_at: completedAt } : row));
    setNotice("Acompanhamento concluído.");
    setSavingId("");
  }

  return <main className="min-h-screen"><AppHeader />
    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-7 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--green)]">CRM / Rotina</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Agenda</h1><p className="mt-2 text-sm text-[var(--muted)]">Organize retornos e acompanhe o próximo passo de cada cliente.</p></div>
        <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">{counts.pending} pendentes</span>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/30 bg-red-200/10 p-3 text-sm text-red-100">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300/30 bg-emerald-200/10 p-3 text-sm text-emerald-100">{notice}</p>}

      <section className="crm-dashboard-panel mt-7 p-5 sm:p-6" aria-labelledby="agenda-new-title">
        <div className="mb-5"><h2 id="agenda-new-title" className="text-base font-semibold">Novo acompanhamento</h2><p className="crm-dashboard-muted mt-1 text-sm">Agende um retorno, visita ou outra tarefa ligada a um cliente.</p></div>
        {clients.length === 0 && !loading ? <p className="crm-dashboard-muted rounded-xl border border-dashed border-[#302f28] p-4 text-sm">Cadastre um cliente antes de criar um acompanhamento.</p> :
          <form onSubmit={addFollowUp} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>Cliente<select required name="client_id" value={selectedClient} onChange={event => setSelectedClient(event.target.value)} className={inputClass}><option value="" disabled>Selecione um cliente</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelClass}>Data e horário<input required type="datetime-local" name="due_at" value={dueAtInput} onChange={event => setDueAtInput(event.target.value)} className={inputClass} /></label>
            {isAdmin && <label className={labelClass}>Responsável<select name="assigned_agent" defaultValue="" key={selectedClient} className={inputClass}><option value="">Responsável pelo cliente</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.full_name || "Corretor"}</option>)}</select></label>}
            <label className={`${labelClass} ${isAdmin ? "lg:col-span-1" : "sm:col-span-2 lg:col-span-2"}`}>Anotação<input name="note" maxLength={500} placeholder="Ex.: confirmar visita" className={inputClass} /></label>
            <div className="sm:col-span-2 lg:col-span-4"><button disabled={saving || loading || clients.length === 0} className="crm-primary-action disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando…" : "+ Adicionar à agenda"}</button></div>
          </form>}
      </section>

      <section className="mt-7" aria-label="Acompanhamentos da agenda">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar agenda">
            {views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${view === item.id ? "border-[#a9711e] bg-[#211b0e] text-[#f1cb6d]" : "border-[#302f28] bg-[#111313] text-[#b9b7ad] hover:border-[#65532d]"}`}>{item.label}<span className="ml-2 text-xs opacity-70">{counts[item.id]}</span></button>)}
          </div>
          <div className="flex min-w-[250px] flex-1 flex-wrap gap-2 sm:flex-none">
            <label className="sr-only" htmlFor="agenda-search">Buscar cliente ou anotação</label><input id="agenda-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente ou anotação" className="min-w-[190px] flex-1 rounded-xl border border-[#302f28] bg-[#111313] px-3 py-2.5 text-sm text-[#f1eee5] placeholder:text-[#89887f] sm:w-56 sm:flex-none" />
            {isAdmin && <><label className="sr-only" htmlFor="agenda-agent">Filtrar por responsável</label><select id="agenda-agent" value={agentFilter} onChange={event => setAgentFilter(event.target.value)} className="rounded-xl border border-[#302f28] bg-[#111313] px-3 py-2.5 text-sm text-[#f1eee5]"><option value="">Todos os responsáveis</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.full_name || "Corretor"}</option>)}</select></>}
          </div>
        </div>

        {loading ? <p role="status" className="crm-dashboard-panel crm-dashboard-muted mt-5 p-8 text-center text-sm">Carregando agenda…</p>
          : visibleRows.length === 0 ? <div className="crm-dashboard-panel crm-dashboard-muted mt-5 p-9 text-center"><p className="font-semibold text-[#f1eee5]">{view === "today" ? "Nenhum acompanhamento para hoje." : "Nenhum acompanhamento encontrado."}</p><p className="mt-2 text-sm">Use os filtros ou crie um novo acompanhamento acima.</p></div>
          : <div className="mt-5 space-y-3">{visibleRows.map(item => {
            const due = new Date(item.due_at);
            const overdue = !item.completed_at && dayStart(due) < dayStart(new Date());
            const dueToday = !item.completed_at && dayStart(due) === dayStart(new Date());
            const agentName = agents.find(agent => agent.id === item.assigned_agent)?.full_name;
            return <article key={item.id} className={`crm-dashboard-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${overdue ? "crm-dashboard-panel--warning" : ""}`}>
              <div className="flex min-w-0 gap-4">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-center ${overdue ? "border-[#69452e] bg-[#211511] text-[#e4a47b]" : item.completed_at ? "border-[#302f28] bg-[#171916] text-[#99978c]" : "border-[#544321] bg-[#211b0e] text-[#f1cb6d]"}`}><span className="text-[10px] uppercase leading-none">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(due).replace(".", "")}</span></div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/clientes/${item.client_id}`} className="truncate font-semibold text-[#f1eee5] hover:text-[#f1cb6d] hover:underline">{clientName(item)}</Link><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.completed_at ? "bg-[#20231f] text-[#aaa99f]" : overdue ? "bg-[#321e16] text-[#e4a47b]" : dueToday ? "bg-[#2a2415] text-[#f1cb6d]" : "bg-[#17251e] text-[#a7d2af]"}`}>{item.completed_at ? "Concluído" : overdue ? "Atrasado" : dueToday ? "Hoje" : "Agendado"}</span></div>
                  <p className="mt-1 text-sm text-[#aaa99f]"><time dateTime={item.due_at}>{dateTimeLabel(item.due_at)}</time>{isAdmin && agentName ? ` · ${agentName}` : ""}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm text-[#d2cfc3]">{item.note}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:pl-4">{!item.completed_at && <button type="button" disabled={savingId === item.id} onClick={() => void completeFollowUp(item)} className="rounded-lg border border-[#51421f] px-3 py-2 text-sm font-semibold text-[#f1cb6d] hover:bg-[#211b0e] disabled:opacity-50">{savingId === item.id ? "Salvando…" : "Concluir"}</button>}<Link href={`/clientes/${item.client_id}`} className="text-sm font-semibold text-[#f1cb6d] hover:underline">Abrir cliente ↗</Link></div>
            </article>;
          })}</div>}
        {rows.filter(item => item.completed_at).length >= 100 && view === "completed" && <p className="crm-dashboard-muted mt-4 text-center text-xs">Mostrando os 100 acompanhamentos concluídos mais recentes.</p>}
        {rows.filter(item => !item.completed_at).length >= 500 && view !== "completed" && <p className="crm-dashboard-muted mt-4 text-center text-xs">A lista mostra até 500 acompanhamentos pendentes. Use a busca para localizar um cliente.</p>}
      </section>
    </div>
  </main>;
}

export default function AgendaPage() { return <AgendaContent />; }
