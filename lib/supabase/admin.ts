import { createClient } from "@supabase/supabase-js";

// Esta chave só deve ser usada em rotas do servidor.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_SERVICE_ROLE_KEY somente no servidor.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
