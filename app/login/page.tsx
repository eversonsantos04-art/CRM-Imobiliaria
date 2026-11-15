"use client";
import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
function LoginForm() {
  const params = useSearchParams();
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [error,setError] = useState(params.get("error") === "link-invalido" ? "O link expirou ou não é válido." : "");
  const [message,setMessage] = useState(params.get("message") ?? ""); const [busy,setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const client = createClient();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        client.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("O Supabase demorou para responder.")), 15000);
        }),
      ]).finally(() => { if (timeoutId) clearTimeout(timeoutId); });
      const { error: authError } = result;
      if (authError) {
        setError(`Não foi possível entrar: ${authError.message}`);
        setBusy(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : "";
      setError(`Não foi possível concluir o login.${detail}`);
      setBusy(false);
    }
  }
  return <main className="crm-auth-page flex min-h-screen items-center justify-center px-4 py-10"><section className="crm-auth-card w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
    <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[var(--green)]">CRM Imobiliária</p><h1 className="text-3xl font-semibold">Acesse sua conta</h1><p className="mt-2 text-sm text-[var(--muted)]">Entre com seu e-mail e senha.</p>
    <form onSubmit={submit} className="mt-7 space-y-5">
      <label className="block text-sm font-medium">E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"/></label>
      <label className="block text-sm font-medium">Senha<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"/></label>
      {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[var(--green)] px-4 py-3 font-semibold text-white hover:bg-[var(--green-dark)] disabled:opacity-60">{busy?"Entrando...":"Entrar"}</button>
    </form><p className="mt-5 text-center text-sm"><Link href="/recuperar-senha" className="font-medium text-[var(--green)] hover:underline">Esqueci minha senha</Link></p>
  </section></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Carregando...</main>}><LoginForm /></Suspense>;
}

