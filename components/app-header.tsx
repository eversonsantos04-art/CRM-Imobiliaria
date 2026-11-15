"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignedInUser = { label: string; role: string | null };
type NavItem = { href: string; label: string; icon: "home" | "agenda" | "properties" | "clients" | "import" | "users" | "audit" };
const roleNames: Record<string,string> = { admin: "Administrador", corretor: "Corretor" };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: "home" },
  { href: "/agenda", label: "Agenda", icon: "agenda" },
  { href: "/imoveis", label: "Imóveis", icon: "properties" },
  { href: "/clientes", label: "Clientes", icon: "clients" },
  { href: "/importar", label: "Importar dados", icon: "import" },
  { href: "/usuarios", label: "Usuários", icon: "users" },
  { href: "/auditoria", label: "Auditoria", icon: "audit" },
];

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
  if (name === "agenda") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18m-13 4h3m-3 3h6" /></svg>;
  if (name === "properties") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3" y="7" width="18" height="14" rx="1.5" /><path d="m2 7 10-4 10 4M8 21v-8h8v8" /></svg>;
  if (name === "clients") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a4 4 0 0 1 0 7m2 3a5 5 0 0 1 3 4v2" /></svg>;
  if (name === "import") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></svg>;
  if (name === "users") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a4 4 0 0 1 0 7m2 3a5 5 0 0 1 3 4v2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M4 5l2 2m12-2-2 2" /></svg>;
}

export function AppHeader() {
  const pathname = usePathname();
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
      if (active) setSignedInUser({ label: profile?.full_name?.trim() || user.email || "Usuário", role: profile?.role ?? null });
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  const visibleItems = navItems.filter((item) => item.href !== "/importar" && item.href !== "/usuarios" && item.href !== "/auditoria" || signedInUser?.role === "admin");
  const initials = signedInUser?.label.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "DI";

  return (
    <aside className="crm-sidebar" aria-label="Navegação do CRM">
      <Link className="crm-sidebar__brand" href="/dashboard" aria-label="De Imóveis, painel inicial">
        <Image src="/site/logo.png" alt="De Imóveis — Gestores Imobiliários" width={963} height={259} priority />
      </Link>
      <p className="crm-sidebar__section-label">Menu principal</p>
      <nav className="crm-sidebar__nav">
        {visibleItems.map((item) => {
          const active = pathname === item.href || item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} className={`crm-sidebar__link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <NavIcon name={item.icon} /><span>{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="crm-sidebar__account">
        <span className="crm-sidebar__avatar" aria-hidden="true">{initials}</span>
        <span className="crm-sidebar__account-copy"><strong title={signedInUser?.label}>{signedInUser?.label || "Conta da equipe"}</strong><small>{signedInUser?.role ? roleNames[signedInUser.role] ?? signedInUser.role : "Painel de gestão"}</small></span>
        <button type="button" className="crm-sidebar__signout" onClick={() => void signOut()}>Sair</button>
      </div>
    </aside>
  );
}
