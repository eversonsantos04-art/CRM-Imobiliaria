import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const passwordMinimum = 8;

async function getAdminSession(request:Request) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if(!token)return { response: NextResponse.json({ error: "Sua sessão expirou. Entre novamente no CRM." }, { status: 401 }) };
    const admin = createAdminClient();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return { response: NextResponse.json({ error: "Sua sessão expirou. Saia e entre novamente no CRM." }, { status: 401 }) };
    const { data: profile, error: profileError } = await admin.from("profiles").select("role,disabled_at").eq("id", user.id).single();
    if (profileError || profile?.role !== "admin" || profile.disabled_at) return { response: NextResponse.json({ error: "Somente um administrador ativo pode gerenciar usuários." }, { status: 403 }) };
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!key)return { response: NextResponse.json({error:"Configure a URL e a chave pública do Supabase no servidor."},{status:500}) };
    const supabase=createSupabaseClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{autoRefreshToken:false,persistSession:false}});
    return { supabase, user, admin };
  } catch(cause) {
    const message=cause instanceof Error?cause.message:"Falha ao validar o acesso.";
    return { response: NextResponse.json({error:message},{status:500}) };
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function validRole(value: unknown): value is "admin" | "corretor" {
  return value === "admin" || value === "corretor";
}
function messageFrom(cause: unknown) {
  return cause instanceof Error ? cause.message : typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "Não foi possível concluir a operação.";
}
async function recordAction(supabase: unknown, userId: string, action: string, details: Record<string, unknown>) {
  // O cliente Supabase não tem o tipo gerado do schema, então tipamos só esta chamada RPC.
  const rpc = (supabase as ReturnType<typeof createSupabaseClient>).rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("record_user_admin_action", { target_user_id: userId, action_name: action, details });
  if (error) throw error;
}
async function recordActionWarning(supabase: unknown, userId: string, action: string, details: Record<string, unknown>) {
  try { await recordAction(supabase,userId,action,details);return undefined; }
  catch (cause) { return messageFrom(cause); }
}

export async function GET(request:Request) {
  const session = await getAdminSession(request);
  if ("response" in session) return session.response;
  try {
    const { data, error } = await session.admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw error;
    const authUsers = data.users;
    const ids = authUsers.map(user => user.id);
    const { data: profiles, error: profilesError } = ids.length
      ? await session.admin.from("profiles").select("id,full_name,role,created_at,disabled_at").in("id", ids)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]));
    return NextResponse.json({ users: authUsers.map(user => ({
      id: user.id,
      email: user.email ?? "",
      lastSignInAt: user.last_sign_in_at,
      createdAt: user.created_at,
      bannedUntil: user.banned_until,
      profile: profileById.get(user.id) ?? null,
    })) });
  } catch (cause) {
    return NextResponse.json({ error: messageFrom(cause) }, { status: 500 });
  }
}

// Cria uma conta confirmada diretamente, sem enviar e-mail.
export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if ("response" in session) return session.response;
  let body: { email?: unknown; fullName?: unknown; role?: unknown; password?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Os dados enviados são inválidos." }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const role = validRole(body.role) ? body.role : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!validEmail(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (!fullName || fullName.length > 120) return NextResponse.json({ error: "Informe um nome de até 120 caracteres." }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Selecione um perfil válido." }, { status: 400 });
  if (password.length < passwordMinimum) return NextResponse.json({ error: `A senha deve ter pelo menos ${passwordMinimum} caracteres.` }, { status: 400 });

  try {
    const { data, error } = await session.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    if (!data.user) throw new Error("O Supabase não retornou o usuário criado.");
    const userId = data.user.id;
    const { error: profileError } = await session.supabase.from("profiles").update({ full_name: fullName, role }).eq("id", userId);
    if (profileError) {
      await session.admin.auth.admin.deleteUser(userId);
      throw new Error(`A conta não foi concluída porque o perfil não pôde ser salvo: ${profileError.message}`);
    }
    const warning=await recordActionWarning(session.supabase,userId,"account_created",{email,full_name:fullName,role});
    return NextResponse.json({ message: `Usuário ${email} criado. Entregue a senha inicial com segurança.`,warning }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ error: messageFrom(cause) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession(request);
  if ("response" in session) return session.response;
  let body: { id?: unknown; action?: unknown; email?: unknown; fullName?: unknown; role?: unknown; password?: unknown; replacementId?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Os dados enviados são inválidos." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  if (id === session.user.id && ["edit","deactivate","delete","password"].includes(action)) return NextResponse.json({ error: "Para proteger seu acesso, gerencie esta conta por outra conta admin." }, { status: 400 });

  try {
    const { data: targetProfile, error: targetProfileError } = await session.admin.from("profiles").select("id,full_name,role").eq("id", id).maybeSingle();
    if (targetProfileError) throw targetProfileError;
    if (!targetProfile) return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 404 });

    if (action === "edit") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
      if (!validEmail(email) || !fullName || fullName.length > 120 || !validRole(body.role)) {
        return NextResponse.json({ error: "Confira o e-mail, o nome e o perfil informados." }, { status: 400 });
      }
      const { data: oldUser, error: oldUserError } = await session.admin.auth.admin.getUserById(id);
      if (oldUserError) throw oldUserError;
      const oldEmail = oldUser.user.email;
      if (!oldEmail) throw new Error("Esta conta não possui um e-mail que possa ser editado.");
      const { error: authUpdateError } = await session.admin.auth.admin.updateUserById(id, { email, email_confirm: true, user_metadata: { ...oldUser.user.user_metadata, full_name: fullName } });
      if (authUpdateError) throw authUpdateError;
      const { error: profileUpdateError } = await session.supabase.from("profiles").update({ full_name: fullName, role: body.role }).eq("id", id);
      if (profileUpdateError) {
        await session.admin.auth.admin.updateUserById(id, { email: oldEmail, email_confirm: true, user_metadata: oldUser.user.user_metadata });
        throw profileUpdateError;
      }
      const warning=await recordActionWarning(session.supabase,id,"account_edited",{email,full_name:fullName,role:body.role});
      return NextResponse.json({ message: "Dados do usuário atualizados.",warning });
    }

    if (action === "deactivate" || action === "restore") {
      if (targetProfile.role === "admin") {
        const { data: allUsers, error: listError } = await session.admin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (listError) throw listError;
        const {data:allProfiles,error:allProfilesError}=await session.admin.from("profiles").select("id,disabled_at");
        if(allProfilesError)throw allProfilesError;
        const disabledProfiles = new Set((allProfiles??[]).filter(profile => profile.disabled_at).map(profile => profile.id));
        const activeIds = new Set(allUsers.users.filter(user => (!user.banned_until || Date.parse(user.banned_until) <= Date.now()) && !disabledProfiles.has(user.id)).map(user => user.id));
        const { data: adminProfiles, error: adminsError } = await session.admin.from("profiles").select("id,disabled_at").eq("role", "admin");
        if (adminsError) throw adminsError;
        if (action === "deactivate" && (adminProfiles ?? []).filter(profile => activeIds.has(profile.id)).length <= 1) {
          return NextResponse.json({ error: "Mantenha ao menos uma conta administradora ativa." }, { status: 400 });
        }
      }
      if(action === "deactivate"){
        const {error:profileError}=await session.supabase.from("profiles").update({disabled_at:new Date().toISOString()}).eq("id",id);
        if(profileError)throw profileError;
        const {error:banError}=await session.admin.auth.admin.updateUserById(id,{ban_duration:"876000h"});
        if(banError)throw banError;
      }else{
        const {error:unbanError}=await session.admin.auth.admin.updateUserById(id,{ban_duration:"none"});
        if(unbanError)throw unbanError;
        const {error:profileError}=await session.supabase.from("profiles").update({disabled_at:null}).eq("id",id);
        if(profileError)throw profileError;
      }
      const warning=await recordActionWarning(session.supabase,id,action === "deactivate" ? "account_deactivated" : "account_restored",{email:body.email??null});
      return NextResponse.json({ message: action === "deactivate" ? "Acesso desativado." : "Acesso restaurado.",warning });
    }

    if (action === "password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < passwordMinimum) return NextResponse.json({ error: `A senha deve ter pelo menos ${passwordMinimum} caracteres.` }, { status: 400 });
      const { error } = await session.admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      const warning=await recordActionWarning(session.supabase,id,"password_reset",{});
      return NextResponse.json({ message: "Senha atualizada. Avise o usuário por um canal seguro.",warning });
    }

    if (action === "delete") {
      const replacementId = typeof body.replacementId === "string" ? body.replacementId : "";
      if (!/^[0-9a-f-]{36}$/i.test(replacementId) || replacementId === id) return NextResponse.json({ error: "Selecione outro usuário para receber os registros." }, { status: 400 });
      const { data: replacement, error: replacementError } = await session.admin.auth.admin.getUserById(replacementId);
      if (replacementError || !replacement.user) return NextResponse.json({ error: "A conta escolhida para receber os registros não foi encontrada." }, { status: 400 });
      if (replacement.user.banned_until && Date.parse(replacement.user.banned_until) > Date.now()) return NextResponse.json({ error: "A conta escolhida está desativada." }, { status: 400 });
      const {data:replacementProfile,error:replacementProfileError}=await session.admin.from("profiles").select("disabled_at").eq("id",replacementId).maybeSingle();
      if(replacementProfileError)throw replacementProfileError;
      if(!replacementProfile||replacementProfile.disabled_at)return NextResponse.json({error:"A conta escolhida está desativada ou sem perfil."},{status:400});
      if (targetProfile.role === "admin") {
        const { data: allUsers, error: listError } = await session.admin.auth.admin.listUsers({ page: 1, perPage: 500 });
        if (listError) throw listError;
        const { data: adminProfiles, error: adminsError } = await session.admin.from("profiles").select("id,disabled_at").eq("role", "admin");
        if (adminsError) throw adminsError;
        const activeIds = new Set(allUsers.users.filter(user => user.id !== id && (!user.banned_until || Date.parse(user.banned_until) <= Date.now())).map(user => user.id));
        if ((adminProfiles ?? []).filter(profile => profile.id !== id && !profile.disabled_at && activeIds.has(profile.id)).length === 0) return NextResponse.json({ error: "Mantenha ao menos uma conta administradora ativa." }, { status: 400 });
      }
      const rpc = session.supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      const { error: prepareError } = await rpc("prepare_user_for_deletion", { target_user_id: id, replacement_user_id: replacementId });
      if (prepareError) throw prepareError;
      const { error: deleteError } = await session.admin.auth.admin.deleteUser(id);
      if (deleteError) throw deleteError;
      const warning=await recordActionWarning(session.supabase,id,"account_deleted",{replacement_user_id:replacementId,former_name:targetProfile.full_name});
      return NextResponse.json({ message: "Usuário excluído. Os registros foram transferidos para a conta escolhida.",warning });
    }

    return NextResponse.json({ error: "Operação desconhecida." }, { status: 400 });
  } catch (cause) {
    return NextResponse.json({ error: messageFrom(cause) }, { status: 400 });
  }
}
