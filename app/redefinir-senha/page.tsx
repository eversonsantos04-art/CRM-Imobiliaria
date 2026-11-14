"use client";
import Link from "next/link";
import { useState,type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
export default function NewPasswordPage() {
  const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const {error:changeError}=await createClient().auth.updateUser({password});
    if(changeError) {setError("O link expirou ou não é válido. Solicite outro link.");setBusy(false);return;}
    setMessage("Senha atualizada. Você já pode entrar com ela.");setBusy(false);
  }
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
    <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[var(--green)]">CRM Imobiliária</p><h1 className="text-2xl font-semibold">Defina uma nova senha</h1>
    <form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-medium">Nova senha<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--green)]"/><span className="mt-1 block text-xs text-[var(--muted)]">Use pelo menos 8 caracteres.</span></label>
    {message&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-[var(--green)] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy?"Salvando...":"Salvar nova senha"}</button></form>
    {message&&<p className="mt-5 text-center text-sm"><Link className="text-[var(--green)] hover:underline" href="/login">Ir para o login</Link></p>}
  </section></main>;
}

