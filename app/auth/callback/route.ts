import { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse,type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const {searchParams,origin}=request.nextUrl; const code=searchParams.get("code");
  const tokenHash=searchParams.get("token_hash"); const type=searchParams.get("type"); const next=searchParams.get("next");
  const safeNext=next?.startsWith("/")&&!next.startsWith("//")?next:"/dashboard"; const supabase=await createClient();
  if(code) { const {error}=await supabase.auth.exchangeCodeForSession(code); if(!error) return NextResponse.redirect(new URL(safeNext,origin)); }
  if(tokenHash&&type) { const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as EmailOtpType}); if(!error) return NextResponse.redirect(new URL(safeNext,origin)); }
  return NextResponse.redirect(new URL("/login?error=link-invalido",origin));
}

