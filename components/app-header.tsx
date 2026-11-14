"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignedInUser = { label: string; role: string | null };
const roleNames: Record<string,string> = { admin: "Administrador", corretor: "Corretor" };

export function AppHeader() {
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
      if (active) setSignedInUser({ label: profile?.full_name?.trim() || user.email || "Usuário", role: profile?.role ?? null });
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }
  return <header className="border-b border-[var(--line)] bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
    <Link href="/dashboard" className="min-w-0"><span className="block truncate font-semibold text-[var(--green)]">CRM Imobiliária</span><span className="text-xs text-[var(--muted)]">Painel de gestão</span></Link>
    <div className="ml-auto flex min-w-0 max-w-[55%] items-center gap-2 sm:order-3 sm:max-w-64">
      {signedInUser&&<div className="min-w-0 text-right"><p className="truncate text-sm font-medium" title={signedInUser.label}>{signedInUser.label}</p><p className="text-xs text-[var(--muted)]">{signedInUser.role ? roleNames[signedInUser.role] ?? signedInUser.role : "Conta"}</p></div>}
      <button type="button" onClick={()=>void signOut()} className="shrink-0 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-[var(--canvas)]">Sair</button>
    </div>
    <nav className="order-3 flex w-full flex-wrap items-center gap-4 border-t border-[var(--line)] pt-3 sm:order-2 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0"><Link href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Início</Link><Link href="/clientes" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Clientes</Link><Link href="/imoveis" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Imóveis</Link>{signedInUser?.role==="admin"&&<><Link href="/importar" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Importar</Link><Link href="/usuarios" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Usuários</Link><Link href="/auditoria" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Auditoria</Link></>}</nav>
  </div></header>;
}

