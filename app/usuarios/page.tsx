"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "corretor";
type ProfileData = { id: string; full_name: string; role: Role; created_at: string; disabled_at: string|null };
type UserRow = {
  id: string;
  email: string;
  lastSignInAt: string | null;
  createdAt: string;
  bannedUntil: string | null;
  profile: ProfileData | null;
};
const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "Ainda não entrou";
const isActive = (user: UserRow) => !user.profile?.disabled_at && (!user.bannedUntil || Date.parse(user.bannedUntil) <= Date.now());
async function authorizationHeaders(){
  const {data:{session},error}=await createClient().auth.getSession();
  if(error||!session?.access_token)throw new Error("Sua sessão expirou. Entre novamente no CRM.");
  return {Authorization:`Bearer ${session.access_token}`};
}
async function readJsonResponse(response:Response){
  const text=await response.text();
  if(!text.trim())throw new Error(`O servidor retornou uma resposta vazia (HTTP ${response.status}). Confira as variáveis do Supabase no .env.local e reinicie o servidor.`);
  try{return JSON.parse(text) as {users?:UserRow[];error?:string;message?:string;warning?:string};}
  catch{throw new Error(`O servidor retornou uma resposta inválida (HTTP ${response.status}). Reinicie o servidor local e tente novamente.`);}
}

export default function UsersPage() {
  const [users,setUsers] = useState<UserRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [fullName,setFullName] = useState("");
  const [email,setEmail] = useState("");
  const [role,setRole] = useState<Role>("corretor");
  const [password,setPassword] = useState("");
  const [passwordConfirm,setPasswordConfirm] = useState("");
  const [currentUserId,setCurrentUserId] = useState("");
  const [passwordTarget,setPasswordTarget] = useState<UserRow|null>(null);
  const [newPassword,setNewPassword] = useState("");
  const [newPasswordConfirm,setNewPasswordConfirm] = useState("");
  const [deleteTarget,setDeleteTarget] = useState<UserRow|null>(null);
  const [replacementId,setReplacementId] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);setError("");
    try {
      const response = await fetch("/api/admin/users",{cache:"no-store",headers:await authorizationHeaders()});
      const result = await readJsonResponse(response);
      if(!response.ok)throw new Error(result.error||"Não foi possível carregar os usuários.");
      setUsers(result.users as UserRow[]);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Não foi possível carregar os usuários.");
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{
    let active=true;
    async function checkCurrentUser(){
      const {data:{user}}=await createClient().auth.getUser();
      if(active&&user)setCurrentUserId(user.id);
    }
    void checkCurrentUser();void loadUsers();
    return()=>{active=false;};
  },[loadUsers]);

  async function sendAction(body:Record<string,unknown>,method:"POST"|"PATCH"="PATCH"){
    const response=await fetch("/api/admin/users",{method,headers:{"Content-Type":"application/json",...await authorizationHeaders()},body:JSON.stringify(body)});
    const result=await readJsonResponse(response);
    if(!response.ok)throw new Error(result.error||"Não foi possível concluir a operação.");
    return result as {message?:string;warning?:string};
  }

  async function createUser(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");setSuccess("");
    if(password!==passwordConfirm){setError("As senhas não coincidem.");setSaving(false);return;}
    try{
      const result=await sendAction({email,fullName,role,password},"POST");
      setSuccess(`${result.message||"Usuário criado."}${result.warning?` Atenção: ${result.warning}`:""}`);setEmail("");setFullName("");setPassword("");setPasswordConfirm("");setRole("corretor");
      await loadUsers();
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível criar o usuário.");}
    finally{setSaving(false);}
  }

  function changeUser(id:string,changes:Partial<Pick<UserRow,"email"> & Pick<ProfileData,"full_name"|"role">>){
    setUsers(current=>current.map(user=>{
      if(user.id!==id||!user.profile)return user;
      const {email:updatedEmail,...profileChanges}=changes;
      return {...user,...(updatedEmail===undefined?{}:{email:updatedEmail}),profile:{...user.profile,...profileChanges}};
    }));
  }

  async function saveUser(user:UserRow){
    if(!user.profile)return;
    setSaving(true);setError("");setSuccess("");
    try{
      const result=await sendAction({action:"edit",id:user.id,email:user.email,fullName:user.profile.full_name,role:user.profile.role});
      setSuccess(`${result.message||"Usuário atualizado."}${result.warning?` Atenção: ${result.warning}`:""}`);await loadUsers();
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar o usuário.");}
    finally{setSaving(false);}
  }

  async function toggleAccess(user:UserRow){
    const action=isActive(user)?"deactivate":"restore";
    const prompt=action==="deactivate"?"Desativar este acesso? O usuário não conseguirá entrar até que o admin o restaure.":"Restaurar o acesso deste usuário?";
    if(!window.confirm(prompt))return;
    setSaving(true);setError("");setSuccess("");
    try{const result=await sendAction({action,id:user.id,email:user.email});setSuccess(`${result.message||"Acesso atualizado."}${result.warning?` Atenção: ${result.warning}`:""}`);await loadUsers();}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível alterar o acesso.");}
    finally{setSaving(false);}
  }

  async function resetPassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!passwordTarget)return;
    if(newPassword!==newPasswordConfirm){setError("As senhas não coincidem.");return;}
    setSaving(true);setError("");setSuccess("");
    try{const result=await sendAction({action:"password",id:passwordTarget.id,password:newPassword});setSuccess(`${result.message||"Senha alterada."}${result.warning?` Atenção: ${result.warning}`:""}`);setPasswordTarget(null);setNewPassword("");setNewPasswordConfirm("");}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível redefinir a senha.");}
    finally{setSaving(false);}
  }

  async function deleteUser(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!deleteTarget)return;
    if(!window.confirm(`Excluir a conta ${deleteTarget.email}? Esta operação é permanente. Os registros atribuídos a ela serão transferidos ao usuário escolhido.`))return;
    setSaving(true);setError("");setSuccess("");
    try{const result=await sendAction({action:"delete",id:deleteTarget.id,replacementId});setSuccess(`${result.message||"Usuário excluído."}${result.warning?` Atenção: ${result.warning}`:""}`);setDeleteTarget(null);await loadUsers();}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível excluir o usuário.");}
    finally{setSaving(false);}
  }

  const replacements=users.filter(user=>user.id!==deleteTarget?.id&&isActive(user));

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
    <p className="text-sm font-medium text-[var(--green)]">Administração</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Usuários</h1><p className="mt-1 text-sm text-[var(--muted)]">O admin cadastra e gerencia as contas sem envio de e-mail.</p>
    <form onSubmit={event=>void createUser(event)} className="mt-6 grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Adicionar usuário</h2>
      <label className="text-sm font-medium">Nome<input required maxLength={120} value={fullName} onChange={event=>setFullName(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">E-mail<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">Senha inicial<input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={event=>setPassword(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">Confirmar senha<input required minLength={8} autoComplete="new-password" type="password" value={passwordConfirm} onChange={event=>setPasswordConfirm(event.target.value)} className={field}/></label>
      <label className="text-sm font-medium">Perfil<select value={role} onChange={event=>setRole(event.target.value as Role)} className={field}><option value="corretor">Corretor</option><option value="admin">Administrador</option></select></label>
      <div className="sm:col-span-2"><button disabled={saving} className="rounded-xl bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving?"Salvando...":"Criar conta"}</button><p className="mt-2 text-xs text-[var(--muted)]">A conta fica confirmada no Supabase sem e-mail. Compartilhe a senha por um canal seguro. O admin poderá redefini-la nesta tela.</p></div>
    </form>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Equipe</h2><button type="button" onClick={()=>void loadUsers()} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium">Atualizar</button></div>
      {loading?<p role="status" className="py-8 text-center text-sm text-[var(--muted)]">Carregando usuários...</p>:users.length===0?<p className="py-8 text-center text-sm text-[var(--muted)]">Nenhum usuário encontrado.</p>:<div className="mt-4 space-y-3">{users.map(user=><article key={user.id} className="grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-end">
        <div className="min-w-0"><label className="block text-xs font-medium">E-mail<input aria-label={`E-mail de ${user.email}`} type="email" value={user.email} onChange={event=>changeUser(user.id,{email:event.target.value})} className={field+" mt-1"}/></label><label className="mt-1 block text-xs font-medium">Nome<input aria-label={`Nome de ${user.email}`} value={user.profile?.full_name??""} onChange={event=>changeUser(user.id,{full_name:event.target.value})} className={field+" mt-1"}/></label><p className="mt-1 text-xs text-[var(--muted)]">Último acesso: {dateLabel(user.lastSignInAt)}</p></div>
        <label className="text-xs font-medium">Perfil<select aria-label={`Perfil de ${user.email}`} value={user.profile?.role??"corretor"} onChange={event=>changeUser(user.id,{role:event.target.value as Role})} className={field+" mt-1"}><option value="corretor">Corretor</option><option value="admin">Administrador</option></select></label>
        <p className={`text-xs font-semibold ${isActive(user)?"text-emerald-700":"text-red-700"}`}>{isActive(user)?"Ativo":"Desativado"} · cadastrado em {dateLabel(user.profile?.created_at??user.createdAt)}</p>
        <div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" disabled={saving||!user.profile||user.id===currentUserId} onClick={()=>void saveUser(user)} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold disabled:opacity-50">Salvar</button><button type="button" disabled={saving||user.id===currentUserId} onClick={()=>void toggleAccess(user)} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium disabled:opacity-50">{isActive(user)?"Desativar":"Restaurar"}</button><button type="button" disabled={saving||user.id===currentUserId} onClick={()=>{setPasswordTarget(user);setNewPassword("");setNewPasswordConfirm("");}} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-medium disabled:opacity-50">Redefinir senha</button><button type="button" disabled={saving||user.id===currentUserId||replacements.length===0} onClick={()=>{setDeleteTarget(user);setReplacementId(replacements.find(item=>item.id===currentUserId)?.id??replacements[0]?.id??"");}} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-50">Excluir</button></div>
      </article>)}</div>}
    </section>

    {passwordTarget&&<div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={event=>void resetPassword(event)} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold">Redefinir senha</h2><p className="mt-1 text-sm text-[var(--muted)]">Conta: {passwordTarget.email}. A senha não será enviada por e-mail.</p><label className="mt-4 block text-sm font-medium">Nova senha<input required minLength={8} autoComplete="new-password" type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} className={field}/></label><label className="mt-3 block text-sm font-medium">Confirmar nova senha<input required minLength={8} autoComplete="new-password" type="password" value={newPasswordConfirm} onChange={event=>setNewPasswordConfirm(event.target.value)} className={field}/></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setPasswordTarget(null)} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving} className="rounded-xl bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Atualizar senha</button></div></form></div>}
    {deleteTarget&&<div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={event=>void deleteUser(event)} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold">Excluir conta</h2><p className="mt-1 text-sm text-[var(--muted)]">Os registros permanecem no CRM. A responsabilidade atual será transferida; a autoria ficará sem vínculo com uma conta ativa.</p><label className="mt-4 block text-sm font-medium">Transferir registros para<select required value={replacementId} onChange={event=>setReplacementId(event.target.value)} className={field}><option value="">Selecione uma conta ativa</option>{replacements.map(user=><option key={user.id} value={user.id}>{user.profile?.full_name||user.email} · {user.email}</option>)}</select></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setDeleteTarget(null)} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm">Cancelar</button><button disabled={saving||!replacementId} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Excluir conta</button></div></form></div>}
  </div></main>;
}
