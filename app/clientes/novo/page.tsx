"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FieldError, FormattedInput } from "@/components/form-inputs";
import { createClient } from "@/lib/supabase/client";
import { normalizeBrazilianDocument, normalizeBrazilianPhone, parseBrazilianDecimal, validateBrazilianDocument, validateBrazilianPhone, type FormFieldErrors } from "@/lib/form-validation";

type Agent = { id: string; full_name: string | null };
const field = "mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--green)]";
const label = "block text-sm font-medium text-[var(--ink)]";
const roles = [["comprador","Comprador"],["locatario","Locatário"],["proprietario","Proprietário"],["investidor","Investidor"]];
const propertyTypes = [["casa","Casa"],["apartamento","Apartamento"],["terreno","Terreno"],["comercial","Comercial"],["rural","Rural"]];

export default function NewClientPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});

  useEffect(() => {
    let active = true;
    async function loadForm() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace("/login"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id",user.id).single();
        if (profileError) throw profileError;
        const admin = profile.role === "admin";
        const { data: agentRows, error: agentError } = admin
          ? await supabase.from("profiles").select("id,full_name").order("full_name")
          : { data: [] as Agent[], error: null };
        if (agentError) throw agentError;
        if (active) { setUserId(user.id); setIsAdmin(admin); setAgents(agentRows ?? []); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível preparar o cadastro.");
      } finally { if (active) setLoading(false); }
    }
    void loadForm();
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const documentRaw = String(form.get("document_number") ?? "").trim();
    const documentNumber = normalizeBrazilianDocument(documentRaw) || null;
    const phoneRaw = String(form.get("phone") ?? "").trim();
    const whatsappRaw = String(form.get("whatsapp") ?? "").trim();
    const incomeText = String(form.get("income") ?? "").trim();
    const income = parseBrazilianDecimal(incomeText);
    const selectedRoles = form.getAll("roles").map(String).filter(value => roles.some(([role]) => role === value));
    const assignedAgent = isAdmin ? String(form.get("assigned_agent") || userId) : userId;
    const errors: FormFieldErrors = {};
    const documentError = validateBrazilianDocument(documentRaw);
    const phoneError = validateBrazilianPhone(phoneRaw);
    const whatsappError = validateBrazilianPhone(whatsappRaw);
    if (!name) errors.name = "Informe o nome do cliente.";
    if (documentError) errors.document_number = documentError;
    if (phoneError) errors.phone = phoneError;
    if (whatsappError) errors.whatsapp = whatsappError;
    if (Number.isNaN(income)) errors.income = "Informe uma renda válida, com até duas casas decimais.";
    else if (typeof income === "number" && income < 0) errors.income = "A renda deve ser igual ou maior que zero.";

    const interestType = String(form.get("interest_type") ?? "");
    const interestPurpose = String(form.get("interest_purpose") ?? "");
    const minPriceText = String(form.get("interest_min_price") ?? "").trim();
    const maxPriceText = String(form.get("interest_max_price") ?? "").trim();
    const bedroomText = String(form.get("interest_min_bedrooms") ?? "").trim();
    const minPrice = parseBrazilianDecimal(minPriceText);
    const maxPrice = parseBrazilianDecimal(maxPriceText);
    const minBedrooms = bedroomText ? Number(bedroomText) : null;
    const neighborhoods = String(form.get("interest_neighborhoods") ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const hasInterest = Boolean(interestType || interestPurpose || minPriceText || maxPriceText || bedroomText || neighborhoods.length);
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
    const clientPayload = {
      name, document_number: documentNumber,
      phone: phoneRaw ? normalizeBrazilianPhone(phoneRaw) : null,
      whatsapp: whatsappRaw ? normalizeBrazilianPhone(whatsappRaw) : null,
      email: String(form.get("email") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      income, contact_source: String(form.get("contact_source") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
      assigned_agent: assignedAgent, created_by: userId,
      consent_at: consent ? new Date().toISOString() : null,
      consent_method: consent ? String(form.get("consent_method") ?? "").trim() || null : null,
    };
    const { data: client, error: insertError } = await supabase.from("clients").insert(clientPayload).select("id").single();
    if (insertError || !client) {
      setError(insertError?.code === "23505" ? "Já existe um cliente com esse CPF/CNPJ." : insertError?.message ?? "Não foi possível cadastrar o cliente.");
      setSaving(false); return;
    }

    const { error: roleError } = await supabase.from("client_roles").insert(selectedRoles.map(role => ({ client_id: client.id, role })));
    if (roleError) {
      setError(`O cliente foi salvo, mas não foi possível salvar os papéis: ${roleError.message}`);
      setSaving(false); return;
    }

    if (hasInterest) {
      const { data: interest, error: interestError } = await supabase.from("client_interests").insert({
        client_id: client.id,
        property_type: propertyTypes.some(([type]) => type === interestType) ? interestType : null,
        purpose: ["venda","aluguel","ambos"].includes(interestPurpose) ? interestPurpose : null,
        min_price: minPrice, max_price: maxPrice, min_bedrooms: minBedrooms,
      }).select("id").single();
      if (interestError || !interest) {
        setError(`Cliente e papéis foram salvos, mas não foi possível salvar o interesse: ${interestError?.message ?? "erro desconhecido"}`); setSaving(false); return;
      }
      if (neighborhoods.length) {
        const uniqueNeighborhoods = [...new Set(neighborhoods.map(value => value.slice(0,80)))];
        const { error: neighborhoodError } = await supabase.from("client_interest_neighborhoods").insert(uniqueNeighborhoods.map(neighborhood => ({ interest_id: interest.id, neighborhood })));
        if (neighborhoodError) {
          setError(`Cliente e interesse foram salvos, mas não foi possível salvar os bairros: ${neighborhoodError.message}`); setSaving(false); return;
        }
      }
    }
    window.location.assign("/clientes?salvo=1");
  }

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-4xl px-5 py-7 sm:py-10">
    <p className="text-sm text-[var(--muted)]"><Link href="/clientes" className="text-[var(--green)] hover:underline">Clientes</Link> / Novo</p>
    <h1 className="mt-2 text-3xl font-semibold">Cadastrar cliente</h1><p className="mt-2 text-sm text-[var(--muted)]">Preencha os dados e selecione um ou mais papéis.</p>
    {loading ? <p role="status" className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">Preparando o formulário...</p>
      : error && !userId ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      : <form onSubmit={submit} className="mt-6 space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Dados do cliente</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>Nome completo<input required name="name" className={field} autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined}/><FieldError id="name-error" message={fieldErrors.name}/></label>
          <label className={label}>CPF/CNPJ<FormattedInput name="document_number" format="cpf-cnpj" inputMode="text" autoCapitalize="characters" className={field} placeholder="000.000.000-00 ou 00.ABC.123/01DE-35" aria-invalid={Boolean(fieldErrors.document_number)} aria-describedby={fieldErrors.document_number ? "document_number-error" : undefined}/><FieldError id="document_number-error" message={fieldErrors.document_number}/></label>
          <label className={label}>Telefone<FormattedInput name="phone" format="phone" type="tel" inputMode="tel" autoComplete="tel" className={field} placeholder="(11) 3333-4444" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined}/><FieldError id="phone-error" message={fieldErrors.phone}/></label>
          <label className={label}>WhatsApp<FormattedInput name="whatsapp" format="phone" type="tel" inputMode="tel" autoComplete="tel" className={field} placeholder="(11) 99999-9999" aria-invalid={Boolean(fieldErrors.whatsapp)} aria-describedby={fieldErrors.whatsapp ? "whatsapp-error" : undefined}/><FieldError id="whatsapp-error" message={fieldErrors.whatsapp}/></label>
          <label className={label}>E-mail<input name="email" type="email" className={field} autoComplete="email"/></label>
          <label className={label}>Renda mensal (opcional)<FormattedInput name="income" format="decimal" inputMode="decimal" className={field} placeholder="Ex.: 5.500,00" aria-invalid={Boolean(fieldErrors.income)} aria-describedby={fieldErrors.income ? "income-error" : undefined}/><FieldError id="income-error" message={fieldErrors.income}/></label>
          <label className={label + " sm:col-span-2"}>Endereço<input name="address" className={field} autoComplete="street-address"/></label>
          <label className={label}>Origem do contato<input name="contact_source" className={field} placeholder="Ex.: indicação, site, anúncio"/></label>
          {isAdmin&&<label className={label}>Corretor responsável<select name="assigned_agent" className={field} defaultValue={userId}>{agents.map(item=><option key={item.id} value={item.id}>{item.full_name||"Corretor"}</option>)}</select></label>}
        </div>
        <fieldset className="mt-5"><legend className="text-sm font-medium">Papéis do cliente</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{roles.map(([value,title])=><label key={value} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"><input type="checkbox" name="roles" value={value} className="accent-emerald-700"/>{title}</label>)}</div></fieldset>
        <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" name="consent" className="mt-1 accent-emerald-700"/><span>Consentimento registrado para armazenar e tratar os dados do cliente.</span></label>
        <label className={label + " mt-3 max-w-sm"}>Forma do consentimento<select name="consent_method" className={field}><option value="">Selecione se marcou o consentimento</option><option value="presencial">Presencial</option><option value="telefone">Telefone</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="outro">Outro</option></select></label>
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Perfil de interesse</h2><p className="mt-1 text-sm text-[var(--muted)]">Opcional. Ajuda a encontrar imóveis compatíveis.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>Tipo de imóvel<select name="interest_type" className={field}><option value="">Não informado</option>{propertyTypes.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
          <label className={label}>Finalidade<select name="interest_purpose" className={field}><option value="">Não informada</option><option value="venda">Compra</option><option value="aluguel">Aluguel</option><option value="ambos">Venda e aluguel</option></select></label>
          <label className={label}>Preço mínimo<FormattedInput name="interest_min_price" format="decimal" inputMode="decimal" className={field} placeholder="Ex.: 250.000,00" aria-invalid={Boolean(fieldErrors.interest_min_price)} aria-describedby={fieldErrors.interest_min_price ? "interest_min_price-error" : undefined}/><FieldError id="interest_min_price-error" message={fieldErrors.interest_min_price}/></label>
          <label className={label}>Preço máximo<FormattedInput name="interest_max_price" format="decimal" inputMode="decimal" className={field} placeholder="Ex.: 500.000,00" aria-invalid={Boolean(fieldErrors.interest_max_price)} aria-describedby={fieldErrors.interest_max_price ? "interest_max_price-error" : undefined}/><FieldError id="interest_max_price-error" message={fieldErrors.interest_max_price}/></label>
          <label className={label}>Quartos mínimos<input name="interest_min_bedrooms" type="number" min="0" step="1" className={field} aria-invalid={Boolean(fieldErrors.interest_min_bedrooms)} aria-describedby={fieldErrors.interest_min_bedrooms ? "interest_min_bedrooms-error" : undefined}/><FieldError id="interest_min_bedrooms-error" message={fieldErrors.interest_min_bedrooms}/></label>
          <label className={label}>Bairros de interesse<input name="interest_neighborhoods" className={field} placeholder="Separe vários bairros por vírgula"/></label>
        </div></section>
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><label className={label}>Observações<textarea name="notes" className={field + " min-h-28"}/></label></section>
        {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/clientes" className="rounded-xl border border-[var(--line)] bg-white px-5 py-3 text-center text-sm font-medium">Cancelar</Link><button disabled={saving} className="rounded-xl bg-[var(--green)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--green-dark)] disabled:opacity-60">{saving?"Salvando...":"Cadastrar cliente"}</button></div>
      </form>}
  </div></main>;
}
