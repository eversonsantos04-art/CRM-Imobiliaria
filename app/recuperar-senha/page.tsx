"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
export default function RecoverPage() {
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const {error: resetError}=await createClient().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/callback?next=/redefinir-senha`});
    if(resetError) setError(`Não foi possível enviar o link: ${resetError.message}`);
    else setMessage("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    setBusy(false);
  }
  return <main className="crm-auth-page flex min-h-screen items-center justify-center px-4 py-10"><section className="crm-auth-card w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
    <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[var(--green)]">CRM Imobiliária</p><h1 className="text-2xl font-semibold">Recuperar senha</h1><p className="mt-2 text-sm text-[var(--muted)]">Enviaremos um link para o e-mail da sua conta.</p>
    <form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-medium">E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"/></label>
    <p className="text-xs text-[var(--muted)]">Use o link mais recente uma única vez. No ambiente local, abra-o no mesmo navegador em que pediu a recuperação.</p>
    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-[var(--green)] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy?"Enviando...":"Enviar link"}</button></form>
    <p className="mt-5 text-center text-sm"><Link className="text-[var(--green)] hover:underline" href="/login">Voltar ao login</Link></p>
  </section></main>;
}

