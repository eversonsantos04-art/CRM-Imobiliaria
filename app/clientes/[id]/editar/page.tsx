"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FieldError, FormattedInput } from "@/components/form-inputs";
import { createClient } from "@/lib/supabase/client";
import { digitsOnly, normalizeBrazilianDocument, normalizeBrazilianPhone, parseBrazilianDecimal, validateBrazilianDocument, validateBrazilianPhone, type FormFieldErrors } from "@/lib/form-validation";

type Agent = { id: string; full_name: string | null };
type ClientData = {
  id: string; name: string; document_number: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; address: string | null; income: number | null; contact_source: string | null;
  notes: string | null; consent_at: string | null; consent_method: string | null; assigned_agent: string;
  created_by: string;
};
type InterestData = { id: string; property_type: string | null; purpose: string | null; min_price: number | null; max_price: number | null; min_bedrooms: number | null };
const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--green)]";
const label = "block text-sm font-medium text-[var(--ink)]";
const roles = [["comprador","Comprador"],["locatario","Locatário"],["proprietario","Proprietário"],["investidor","Investidor"]];
const propertyTypes = [["casa","Casa"],["apartamento","Apartamento"],["terreno","Terreno"],["comercial","Comercial"],["rural","Rural"]];

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [clientRoles, setClientRoles] = useState<string[]>([]);
  const [interest, setInterest] = useState<InterestData | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});

  useEffect(() => {
    let active = true;
    async function loadClient() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        const [profileResult, clientResult] = await Promise.all([
          supabase.from("profiles").select("role").eq("id",user.id).single(),
          supabase.from("clients").select("*").eq("id",id).maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (clientResult.error) throw clientResult.error;
        if (!clientResult.data) { if (active) setError("Cliente não encontrado ou sem permissão de visualização."); return; }
        const admin = profileResult.data.role === "admin";
        const editable = admin || clientResult.data.created_by === user.id;
        const [rolesResult, interestsResult, agentResult] = await Promise.all([
          supabase.from("client_roles").select("role").eq("client_id",id),
          supabase.from("client_interests").select("id,property_type,purpose,min_price,max_price,min_bedrooms").eq("client_id",id).order("created_at").limit(1),
          admin ? supabase.from("profiles").select("id,full_name").order("full_name") : Promise.resolve({ data: [] as Agent[], error: null }),
        ]);
        if (rolesResult.error) throw rolesResult.error;
        if (interestsResult.error) throw interestsResult.error;
        if (agentResult.error) throw agentResult.error;
        const selectedInterest = (interestsResult.data?.[0] ?? null) as InterestData | null;
        let interestNeighborhoods: string[] = [];
        if (selectedInterest) {
          const { data, error: neighborhoodError } = await supabase.from("client_interest_neighborhoods").select("neighborhood").eq("interest_id",selectedInterest.id);
          if (neighborhoodError) throw neighborhoodError;
          interestNeighborhoods = (data ?? []).map(item => item.neighborhood);
        }
        if (active) {
          setUserId(user.id); setIsAdmin(admin); setCanEdit(editable);
          setClient(clientResult.data as ClientData);
          setClientRoles((rolesResult.data ?? []).map(item => item.role));
          setInterest(selectedInterest); setNeighborhoods(interestNeighborhoods); setAgents(agentResult.data ?? []);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o cliente.");
      } finally { if (active) setLoading(false); }
    }
    void loadClient();
    return () => { active = false; };
  }, [id,router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setSaving(true); setError(""); setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const selectedRoles = form.getAll("roles").map(String).filter(value => roles.some(([role]) => role === value));
    const incomeText = String(form.get("income") ?? "").trim();
    const income = parseBrazilianDecimal(incomeText);
    const documentRaw = String(form.get("document_number") ?? "").trim();
    const documentNumber = normalizeBrazilianDocument(documentRaw);
    const originalDocument = normalizeBrazilianDocument(client.document_number ?? "");
    const phoneRaw = String(form.get("phone") ?? "").trim();
    const whatsappRaw = String(form.get("whatsapp") ?? "").trim();
    const phoneDigits = digitsOnly(phoneRaw);
    const whatsappDigits = digitsOnly(whatsappRaw);
    const minPriceText = String(form.get("interest_min_price") ?? "").trim();
    const maxPriceText = String(form.get("interest_max_price") ?? "").trim();
    const bedroomText = String(form.get("interest_min_bedrooms") ?? "").trim();
    const minPrice = parseBrazilianDecimal(minPriceText);
    const maxPrice = parseBrazilianDecimal(maxPriceText);
    const minBedrooms = bedroomText ? Number(bedroomText) : null;
    const selectedNeighborhoods = [...new Set(String(form.get("interest_neighborhoods") ?? "").split(",").map(value => value.trim().slice(0,80)).filter(Boolean))];
    const interestType = String(form.get("interest_type") ?? "");
    const interestPurpose = String(form.get("interest_purpose") ?? "");
    const hasInterest = Boolean(interestType || interestPurpose || minPriceText || maxPriceText || bedroomText || selectedNeighborhoods.length);

    const errors: FormFieldErrors = {};
    if (documentNumber !== originalDocument) {
      const documentError = validateBrazilianDocument(documentRaw);
      if (documentError) errors.document_number = documentError;
    }
    if (phoneDigits !== digitsOnly(client.phone ?? "")) {
      const phoneError = validateBrazilianPhone(phoneRaw);
      if (phoneError) errors.phone = phoneError;
    }
    if (whatsappDigits !== digitsOnly(client.whatsapp ?? "")) {
      const whatsappError = validateBrazilianPhone(whatsappRaw);
      if (whatsappError) errors.whatsapp = whatsappError;
    }
    if (Number.isNaN(income)) errors.income = "Informe uma renda válida, com até duas casas decimais.";
    else if (typeof income === "number" && income < 0) errors.income = "A renda deve ser igual ou maior que zero.";
    if (Number.isNaN(minPrice)) errors.interest_min_price = "Informe um valor mínimo válido, com até duas casas decimais.";
    else if (typeof minPrice === "number" && minPrice < 0) errors.interest_min_price = "O preço mínimo deve ser igual ou maior que zero.";
    if (Number.isNaN(maxPrice)) errors.interest_max_price = "Informe um valor máximo válido, com até duas casas decimais.";
    else if (typeof maxPrice === "number" && maxPrice < 0) errors.interest_max_price = "O preço máximo deve ser igual ou maior que zero.";
    if (minBedrooms !== null && (!Number.isInteger(minBedrooms) || minBedrooms < 0)) errors.interest_min_bedrooms = "Informe um número inteiro de quartos igual ou maior que zero.";
    if (typeof minPrice === "number" && typeof maxPrice === "number" && minPrice > maxPrice) errors.interest_min_price = "O preço mínimo não pode superar o máximo.";
    setFieldErrors(errors);
    if (Object.keys(errors).length || !selectedRoles.length) {
      setError(!selectedRoles.length ? "Selecione pelo menos um papel para o cliente." : "Corrija os campos destacados antes de salvar.");
      const firstInvalid = Object.keys(errors)[0];
      if (firstInvalid) (event.currentTarget.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      setSaving(false); return;
    }

    const supabase = createClient();
    const consent = form.get("consent") === "on";
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      document_number: documentNumber === originalDocument ? client.document_number : documentNumber || null,
      phone: phoneDigits === digitsOnly(client.phone ?? "") ? client.phone : phoneDigits ? normalizeBrazilianPhone(phoneRaw) : null,
      whatsapp: whatsappDigits === digitsOnly(client.whatsapp ?? "") ? client.whatsapp : whatsappDigits ? normalizeBrazilianPhone(whatsappRaw) : null,
      email: String(form.get("email") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      income, contact_source: String(form.get("contact_source") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
      consent_at: consent ? client.consent_at ?? new Date().toISOString() : null,
      consent_method: consent ? String(form.get("consent_method") ?? "").trim() || null : null,
      ...(isAdmin ? { assigned_agent: String(form.get("assigned_agent") ?? client.assigned_agent) } : {}),
    };
    let updateError: Error | null = null;
    for (let attempt=0; attempt<2; attempt+=1) {
      try {
        const { error: resultError } = await supabase.from("clients").update(payload).eq("id",client.id);
        if (!resultError) { updateError = null; break; }
        updateError = new Error(resultError.message);
      } catch (cause) {
        updateError = cause instanceof Error ? cause : new Error("Falha de conexão.");
      }
      if (attempt===0 && /failed to fetch|network|fetch/i.test(updateError.message)) {
        await new Promise(resolve=>setTimeout(resolve,700));
        continue;
      }
      break;
    }
    if (updateError) {
      const connectionIssue=/failed to fetch|network|fetch/i.test(updateError.message);
      setError(connectionIssue
        ? "Não foi possível conectar ao Supabase para salvar os dados do cliente. Confira a conexão e tente salvar novamente."
        : `Não foi possível atualizar o cliente: ${updateError.message}`);
      setSaving(false); return;
    }

    const { error: deleteRolesError } = await supabase.from("client_roles").delete().eq("client_id",client.id);
    if (deleteRolesError) { setError(`Os dados do cliente foram salvos, mas não foi possível atualizar os papéis: ${deleteRolesError.message}`); setSaving(false); return; }
    const { error: insertRolesError } = await supabase.from("client_roles").insert(selectedRoles.map(role => ({ client_id:client.id, role })));
    if (insertRolesError) { setError(`Os dados do cliente foram salvos, mas não foi possível salvar os papéis: ${insertRolesError.message}`); setSaving(false); return; }

    if (hasInterest) {
      const interestPayload = {
        client_id:client.id,
        property_type:propertyTypes.some(([type]) => type === interestType) ? interestType : null,
        purpose:["venda","aluguel","ambos"].includes(interestPurpose) ? interestPurpose : null,
        min_price:minPrice, max_price:maxPrice, min_bedrooms:minBedrooms,
      };
      const interestResult = interest
        ? await supabase.from("client_interests").update(interestPayload).eq("id",interest.id).select("id").single()
        : await supabase.from("client_interests").insert(interestPayload).select("id").single();
      if (interestResult.error || !interestResult.data) { setError(`Cliente e papéis foram salvos, mas o interesse não foi atualizado: ${interestResult.error?.message ?? "erro desconhecido"}`); setSaving(false); return; }
      const { error: clearNeighborhoodsError } = await supabase.from("client_interest_neighborhoods").delete().eq("interest_id",interestResult.data.id);
      if (clearNeighborhoodsError) { setError(`Cliente e interesse foram salvos, mas os bairros não foram atualizados: ${clearNeighborhoodsError.message}`); setSaving(false); return; }
      if (selectedNeighborhoods.length) {
        const { error: neighborhoodError } = await supabase.from("client_interest_neighborhoods").insert(selectedNeighborhoods.map(neighborhood => ({ interest_id:interestResult.data.id, neighborhood })));
        if (neighborhoodError) { setError(`Cliente e interesse foram salvos, mas os bairros não foram atualizados: ${neighborhoodError.message}`); setSaving(false); return; }
      }
    } else if (interest) {
      const { error: deleteInterestError } = await supabase.from("client_interests").delete().eq("id",interest.id);
      if (deleteInterestError) { setError(`Cliente e papéis foram salvos, mas o interesse não foi removido: ${deleteInterestError.message}`); setSaving(false); return; }
    }
    window.location.assign("/clientes?atualizado=1");
  }

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-4xl px-5 py-7 sm:py-10">
    <p className="text-sm text-[var(--muted)]"><Link href="/clientes" className="text-[var(--green)] hover:underline">Clientes</Link> / Editar</p><h1 className="mt-2 text-3xl font-semibold">Editar cliente</h1>
    {loading ? <p role="status" className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Carregando cliente...</p>
      : error && !client ? <section role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-900">{error}</p><Link href="/clientes" className="mt-4 inline-block font-medium text-[var(--green)]">Voltar aos clientes</Link></section>
      : client&&!canEdit ? <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-lg font-semibold">Acesso somente para consulta</h2><p className="mt-2 text-sm text-amber-900">Você pode visualizar este cliente, mas só quem o cadastrou ou o administrador pode editá-lo.</p></section>
      : client&&<form onSubmit={submit} className="mt-6 space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Dados do cliente</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>Nome completo<input required name="name" defaultValue={client.name} className={field}/></label>
          <label className={label}>CPF/CNPJ<FormattedInput name="document_number" format="cpf-cnpj" defaultValue={client.document_number} inputMode="text" autoCapitalize="characters" className={field} placeholder="000.000.000-00 ou 00.ABC.123/01DE-35" aria-invalid={Boolean(fieldErrors.document_number)} aria-describedby={fieldErrors.document_number ? "document_number-error" : undefined}/><FieldError id="document_number-error" message={fieldErrors.document_number}/></label>
          <label className={label}>Telefone<FormattedInput name="phone" format="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={client.phone} className={field} placeholder="(11) 3333-4444" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined}/><FieldError id="phone-error" message={fieldErrors.phone}/></label>
          <label className={label}>WhatsApp<FormattedInput name="whatsapp" format="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={client.whatsapp} className={field} placeholder="(11) 99999-9999" aria-invalid={Boolean(fieldErrors.whatsapp)} aria-describedby={fieldErrors.whatsapp ? "whatsapp-error" : undefined}/><FieldError id="whatsapp-error" message={fieldErrors.whatsapp}/></label>
          <label className={label}>E-mail<input name="email" type="email" defaultValue={client.email??""} className={field}/></label>
          <label className={label}>Renda mensal<FormattedInput name="income" format="decimal" inputMode="decimal" defaultValue={client.income} className={field} placeholder="Ex.: 5.500,00" aria-invalid={Boolean(fieldErrors.income)} aria-describedby={fieldErrors.income ? "income-error" : undefined}/><FieldError id="income-error" message={fieldErrors.income}/></label>
          <label className={label + " sm:col-span-2"}>Endereço<input name="address" defaultValue={client.address??""} className={field}/></label>
          <label className={label}>Origem do contato<input name="contact_source" defaultValue={client.contact_source??""} className={field}/></label>
          {isAdmin&&<label className={label}>Corretor responsável<select name="assigned_agent" defaultValue={client.assigned_agent} className={field}>{agents.map(item=><option key={item.id} value={item.id}>{item.full_name||"Corretor"}</option>)}</select></label>}
        </div>
        <fieldset className="mt-5"><legend className="text-sm font-medium">Papéis do cliente</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{roles.map(([value,title])=><label key={value} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"><input type="checkbox" name="roles" value={value} defaultChecked={clientRoles.includes(value)} className="accent-emerald-700"/>{title}</label>)}</div></fieldset>
        <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" name="consent" defaultChecked={Boolean(client.consent_at)} className="mt-1 accent-emerald-700"/><span>Consentimento registrado para armazenar e tratar os dados do cliente.</span></label>
        <label className={label + " mt-3 max-w-sm"}>Forma do consentimento<select name="consent_method" defaultValue={client.consent_method??""} className={field}><option value="">Não informado</option><option value="presencial">Presencial</option><option value="telefone">Telefone</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="outro">Outro</option></select></label>
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Perfil de interesse</h2><p className="mt-1 text-sm text-[var(--muted)]">Opcional. Ajuda a encontrar imóveis compatíveis.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>Tipo de imóvel<select name="interest_type" defaultValue={interest?.property_type??""} className={field}><option value="">Não informado</option>{propertyTypes.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
          <label className={label}>Finalidade<select name="interest_purpose" defaultValue={interest?.purpose??""} className={field}><option value="">Não informada</option><option value="venda">Compra</option><option value="aluguel">Aluguel</option><option value="ambos">Venda e aluguel</option></select></label>
          <label className={label}>Preço mínimo<FormattedInput name="interest_min_price" format="decimal" inputMode="decimal" defaultValue={interest?.min_price} className={field} placeholder="Ex.: 250.000,00" aria-invalid={Boolean(fieldErrors.interest_min_price)} aria-describedby={fieldErrors.interest_min_price ? "interest_min_price-error" : undefined}/><FieldError id="interest_min_price-error" message={fieldErrors.interest_min_price}/></label>
          <label className={label}>Preço máximo<FormattedInput name="interest_max_price" format="decimal" inputMode="decimal" defaultValue={interest?.max_price} className={field} placeholder="Ex.: 500.000,00" aria-invalid={Boolean(fieldErrors.interest_max_price)} aria-describedby={fieldErrors.interest_max_price ? "interest_max_price-error" : undefined}/><FieldError id="interest_max_price-error" message={fieldErrors.interest_max_price}/></label>
          <label className={label}>Quartos mínimos<input name="interest_min_bedrooms" type="number" min="0" step="1" defaultValue={interest?.min_bedrooms??""} className={field} aria-invalid={Boolean(fieldErrors.interest_min_bedrooms)} aria-describedby={fieldErrors.interest_min_bedrooms ? "interest_min_bedrooms-error" : undefined}/><FieldError id="interest_min_bedrooms-error" message={fieldErrors.interest_min_bedrooms}/></label>
          <label className={label}>Bairros de interesse<input name="interest_neighborhoods" defaultValue={neighborhoods.join(", ")} className={field}/></label>
        </div></section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><label className={label}>Observações<textarea name="notes" defaultValue={client.notes??""} className={field + " min-h-28"}/></label></section>
        {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/clientes" className="rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-center text-sm font-medium">Cancelar</Link><button disabled={saving} className="rounded-xl bg-[var(--green)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--green-dark)] disabled:opacity-60">{saving?"Salvando...":"Salvar alterações"}</button></div>
      </form>}
  </div></main>;
}
