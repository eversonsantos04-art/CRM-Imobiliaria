"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PropertyForm } from "../property-form";
import { createClient } from "@/lib/supabase/client";

type Agent = { id: string; full_name: string | null };
type ClientOption = { id: string; name: string };

export default function NewPropertyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadFormOptions() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }

        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profileError) throw profileError;
        const admin = profile.role === "admin";
        const [agentResult, clientResult] = await Promise.all([
          admin ? supabase.from("profiles").select("id,full_name").order("full_name") : Promise.resolve({ data: [] as Agent[], error: null }),
          supabase.from("clients").select("id,name").order("name").limit(500),
        ]);
        if (agentResult.error) throw agentResult.error;
        if (clientResult.error) throw clientResult.error;
        if (active) {
          setUserId(user.id);
          setIsAdmin(admin);
          setAgents(agentResult.data ?? []);
          setClients(clientResult.data ?? []);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível preparar o cadastro.");
      } finally { if (active) setLoading(false); }
    }
    void loadFormOptions();
    return () => { active = false; };
  }, [router]);

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-4xl px-5 py-7 sm:py-10">
    <p className="text-sm text-[var(--muted)]"><Link href="/imoveis" className="text-[var(--green)] hover:underline">Imóveis</Link> / Novo</p>
    <h1 className="mt-2 text-3xl font-semibold">Cadastrar imóvel</h1><p className="mt-2 text-sm text-[var(--muted)]">Preencha os dados principais e adicione fotos.</p>
    {loading ? <p role="status" className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Preparando o formulário...</p>
      : error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar as opções: {error}</p>
      : <div className="mt-6"><PropertyForm photos={[]} documents={[]} agents={agents} clients={clients} userId={userId} isAdmin={isAdmin}/></div>}
  </div></main>;
}
