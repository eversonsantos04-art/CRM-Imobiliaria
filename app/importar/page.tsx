"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { normalizeHeader, parseCsv, type CsvLine } from "@/lib/csv-import";

type Agent={id:string;full_name:string|null};
type ImportKind="properties"|"clients";
type PreviewLine={line:number;name:string;payload:Record<string,unknown>;errors:string[]};
type ImportResult={line:number;name:string;ok:boolean;error:string};
const inputClass="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const labels:Record<string,string>={
  name:"Nome",document_number:"CPF/CNPJ",phone:"Telefone",whatsapp:"WhatsApp",email:"E-mail",address:"Endereço",income:"Renda",contact_source:"Origem",roles:"Papéis",notes:"Observações",consent:"Consentimento",consent_method:"Forma do consentimento",interest_type:"Tipo de interesse",interest_purpose:"Finalidade de interesse",interest_min_price:"Preço mínimo",interest_max_price:"Preço máximo",interest_min_bedrooms:"Quartos mínimos",interest_neighborhoods:"Bairros de interesse",
  title:"Título",description:"Descrição",property_type:"Tipo do imóvel",purpose:"Finalidade",status:"Status",owner_document:"CPF/CNPJ do proprietário",postal_code:"CEP",street:"Logradouro",street_number:"Número",complement:"Complemento",neighborhood:"Bairro",city:"Cidade",state:"UF",sale_price:"Valor de venda",rent_price:"Valor de aluguel",condo_fee:"Condomínio",property_tax:"IPTU",total_area:"Área total",built_area:"Área construída",bedrooms:"Quartos",suites:"Suítes",bathrooms:"Banheiros",parking_spaces:"Vagas",
};
const aliases:Record<string,string[]>={
  name:["nome","nome_completo","name"],document_number:["cpf_cnpj","cpf","cnpj","documento","document_number"],phone:["telefone","celular","phone"],whatsapp:["whatsapp"],email:["email","e_mail"],address:["endereco","address"],income:["renda","renda_mensal","income"],contact_source:["origem","origem_do_contato","contact_source"],roles:["papeis","papel","roles"],notes:["observacoes","anotacoes","notes"],consent:["consentimento","consent"],consent_method:["forma_do_consentimento","consent_method"],interest_type:["tipo_de_interesse","tipo_de_imovel_de_interesse","interest_type"],interest_purpose:["finalidade_de_interesse","interest_purpose"],interest_min_price:["preco_minimo","valor_minimo","interest_min_price"],interest_max_price:["preco_maximo","valor_maximo","interest_max_price"],interest_min_bedrooms:["quartos_minimos","interest_min_bedrooms"],interest_neighborhoods:["bairros_de_interesse","interest_neighborhoods"],
  title:["titulo","nome_do_imovel","title"],description:["descricao","description"],property_type:["tipo","tipo_do_imovel","property_type"],purpose:["finalidade","purpose"],status:["status"],owner_document:["cpf_cnpj_do_proprietario","documento_do_proprietario","owner_document"],postal_code:["cep","codigo_postal","postal_code"],street:["logradouro","rua","street"],street_number:["numero","street_number"],complement:["complemento","complement"],neighborhood:["bairro","neighborhood"],city:["cidade","city"],state:["uf","estado","state"],sale_price:["valor_de_venda","preco_de_venda","sale_price"],rent_price:["valor_de_aluguel","valor_do_aluguel","rent_price"],condo_fee:["condominio","condo_fee"],property_tax:["iptu","property_tax"],total_area:["area_total","total_area"],built_area:["area_construida","built_area"],bedrooms:["quartos","bedrooms"],suites:["suites"],bathrooms:["banheiros","bathrooms"],parking_spaces:["vagas","parking_spaces"],
};
const propertyTemplate=["Título","Tipo do imóvel","Finalidade","Status","CPF/CNPJ do proprietário","Descrição","CEP","Logradouro","Número","Complemento","Bairro","Cidade","UF","Valor de venda","Valor de aluguel","Condomínio","IPTU","Área total","Área construída","Quartos","Suítes","Banheiros","Vagas"];
const clientTemplate=["Nome","CPF/CNPJ","Telefone","WhatsApp","E-mail","Endereço","Renda","Origem","Papéis","Observações","Consentimento","Forma do consentimento","Tipo de interesse","Finalidade de interesse","Preço mínimo","Preço máximo","Quartos mínimos","Bairros de interesse"];
const propertyTypes:Record<string,string>={casa:"casa",apartamento:"apartamento",apto:"apartamento",apart:"apartamento",terreno:"terreno",comercial:"comercial",rural:"rural"};
const purposes:Record<string,string>={venda:"venda",compra:"venda",aluguel:"aluguel",locacao:"aluguel",ambos:"ambos",venda_e_aluguel:"ambos"};
const statuses:Record<string,string>={disponivel:"disponivel",reservado:"reservado",vendido:"vendido",alugado:"alugado",locado:"alugado",inativo:"inativo"};
const roleValues:Record<string,string>={comprador:"comprador",compradora:"comprador",locatario:"locatario",locataria:"locatario",proprietario:"proprietario",proprietaria:"proprietario",investidor:"investidor",investidora:"investidor"};
const consentMethods:Record<string,string>={presencial:"presencial",telefone:"telefone",whatsapp:"whatsapp",email:"email",e_mail:"email",outro:"outro"};

function valueFrom(line:CsvLine,field:string){
  const normalized=Object.entries(line.values).map(([header,value])=>[normalizeHeader(header),value] as const);
  const candidates=[field,...(aliases[field]??[])].map(normalizeHeader);
  return normalized.find(([header])=>candidates.includes(header))?.[1]?.trim()??"";
}
function numberFrom(raw:string){
  if(!raw.trim())return null;
  let value=raw.trim().replace(/[R$\s]/g,"");
  if(value.includes(","))value=value.replace(/\./g,"").replace(",",".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(value))value=value.replace(/\./g,"");
  const number=Number(value);
  return Number.isFinite(number)?number:NaN;
}
function enumKey(value:string){return normalizeHeader(value).replace(/_/g," ").trim().replace(/\s+/g,"_");}
function parseBoolean(value:string){return ["sim","s","true","1","yes"].includes(enumKey(value));}
function makePreview(lines:CsvLine[],kind:ImportKind):PreviewLine[]{
  return lines.map(line=>{
    const errors:string[]=[];
    const get=(field:string)=>valueFrom(line,field);
    if(kind==="properties"){
      const type=propertyTypes[enumKey(get("property_type"))];
      const purpose=purposes[enumKey(get("purpose"))];
      const rawStatus=get("status");
      const status=rawStatus?statuses[enumKey(rawStatus)]:"disponivel";
      const title=get("title");
      if(!title)errors.push("Título não informado.");
      if(!type)errors.push("Tipo inválido. Use casa, apartamento, terreno, comercial ou rural.");
      if(!purpose)errors.push("Finalidade inválida. Use venda, aluguel ou ambos.");
      if(!status)errors.push("Status inválido. Use disponível, reservado, vendido, alugado ou inativo.");
      const numericFields=["sale_price","rent_price","condo_fee","property_tax","total_area","built_area","bedrooms","suites","bathrooms","parking_spaces"];
      const numbers=Object.fromEntries(numericFields.map(field=>[field,numberFrom(get(field))])) as Record<string,number|null>;
      for(const field of numericFields){const number=numbers[field];if(typeof number==="number"&&(!Number.isFinite(number)||number<0))errors.push(`${labels[field]} deve ser um número igual ou maior que zero.`);}
      for(const field of ["bedrooms","suites","bathrooms","parking_spaces"]){const number=numbers[field];if(typeof number==="number"&&Number.isFinite(number)&&!Number.isInteger(number))errors.push(`${labels[field]} deve ser um número inteiro.`);}
      const payload:Record<string,unknown>={title,property_type:type,purpose,status,owner_document:get("owner_document").replace(/[^0-9]/g,"")||null};
      for(const field of ["description","postal_code","street","street_number","complement","neighborhood","city"]){payload[field]=get(field)||null;}
      payload.state=get("state").toUpperCase()||null;
      Object.assign(payload,numbers);
      return{line:line.line,name:title||"(sem título)",payload,errors};
    }

    const name=get("name").trim();
    const rawRoles=get("roles").split(/[|,]/).map(value=>value.trim()).filter(Boolean);
    const parsedRoles=[...new Set(rawRoles.map(value=>roleValues[enumKey(value)]).filter(Boolean))];
    const income=numberFrom(get("income"));
    if(!name)errors.push("Nome não informado.");
    if(!parsedRoles.length)errors.push("Informe ao menos um papel: comprador, locatário, proprietário ou investidor.");
    if(rawRoles.some(value=>!roleValues[enumKey(value)]))errors.push("Há um papel inválido. Use comprador, locatário, proprietário ou investidor.");
    if(typeof income==="number"&&(!Number.isFinite(income)||income<0))errors.push("Renda deve ser um número igual ou maior que zero.");
    const email=get("email").trim();
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.push("E-mail inválido.");
    const interestType=propertyTypes[enumKey(get("interest_type"))]??"";
    const interestPurpose=purposes[enumKey(get("interest_purpose"))]??"";
    const minPrice=numberFrom(get("interest_min_price")),maxPrice=numberFrom(get("interest_max_price")),minBedrooms=numberFrom(get("interest_min_bedrooms"));
    for(const [field,value] of [["interest_min_price",minPrice],["interest_max_price",maxPrice],["interest_min_bedrooms",minBedrooms]] as const){if(typeof value==="number"&&(!Number.isFinite(value)||value<0))errors.push(`${labels[field]} deve ser um número igual ou maior que zero.`);}
    if(typeof minBedrooms==="number"&&Number.isFinite(minBedrooms)&&!Number.isInteger(minBedrooms))errors.push("Quartos mínimos deve ser um número inteiro.");
    if(typeof minPrice==="number"&&typeof maxPrice==="number"&&Number.isFinite(minPrice)&&Number.isFinite(maxPrice)&&minPrice>maxPrice)errors.push("Preço mínimo supera o preço máximo.");
    if(get("interest_type")&&!interestType)errors.push("Tipo de interesse inválido.");
    if(get("interest_purpose")&&!interestPurpose)errors.push("Finalidade de interesse inválida.");
    const consent=parseBoolean(get("consent"));
    const consentMethod=consentMethods[enumKey(get("consent_method"))]??"";
    if(consent&&get("consent_method")&&!consentMethod)errors.push("Forma de consentimento inválida.");
    const neighborhoods=get("interest_neighborhoods").split(/[|,]/).map(value=>value.trim().slice(0,80)).filter(Boolean);
    const payload:Record<string,unknown>={
      name,document_number:get("document_number").replace(/[^0-9]/g,"")||null,phone:get("phone")||null,whatsapp:get("whatsapp")||null,email:email||null,address:get("address")||null,
      income,contact_source:get("contact_source")||null,notes:get("notes")||null,roles:parsedRoles,
      consent_at:consent?new Date().toISOString():null,consent_method:consent?consentMethod||null:null,
      interest_type:interestType||null,interest_purpose:interestPurpose||null,interest_min_price:minPrice,interest_max_price:maxPrice,interest_min_bedrooms:minBedrooms,interest_neighborhoods:neighborhoods,
    };
    return{line:line.line,name:name||"(sem nome)",payload,errors};
  });
}

export default function ImportPage(){
  const [loading,setLoading]=useState(true);
  const [admin,setAdmin]=useState(false);
  const [userId,setUserId]=useState("");
  const [agents,setAgents]=useState<Agent[]>([]);
  const [assignedAgent,setAssignedAgent]=useState("");
  const [kind,setKind]=useState<ImportKind>("properties");
  const [preview,setPreview]=useState<PreviewLine[]>([]);
  const [fileName,setFileName]=useState("");
  const [error,setError]=useState("");
  const [importing,setImporting]=useState(false);
  const [progress,setProgress]=useState(0);
  const [results,setResults]=useState<ImportResult[]>([]);

  useEffect(()=>{
    let active=true;
    async function loadAccess(){
      try{
        const supabase=createClient();
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError)throw authError;
        if(!user){window.location.assign("/login");return;}
        const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).single();
        if(profileError)throw profileError;
        if(profile.role!=="admin"){if(active)setLoading(false);return;}
        const {data:profileRows,error:agentsError}=await supabase.from("profiles").select("id,full_name").order("full_name");
        if(agentsError)throw agentsError;
        if(active){setAdmin(true);setUserId(user.id);setAgents(profileRows??[]);setAssignedAgent(user.id);setLoading(false);}
      }catch(cause){if(active){setError(cause instanceof Error?cause.message:"Não foi possível conferir o acesso.");setLoading(false);}}
    }
    void loadAccess();return()=>{active=false;};
  },[]);

  const validCount=useMemo(()=>preview.filter(row=>row.errors.length===0).length,[preview]);
  const invalidCount=preview.length-validCount;
  const template=kind==="properties"?propertyTemplate:clientTemplate;

  async function loadFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];setPreview([]);setResults([]);setError("");setFileName(file?.name??"");
    event.target.value="";
    if(!file)return;
    try{
      const parsed=parseCsv(await file.text());
      const normalizedHeaders=parsed.headers.map(normalizeHeader);
      const required=kind==="properties"?["title","property_type","purpose"]:["name","roles"];
      const missing=required.filter(field=>!(aliases[field]??[]).map(normalizeHeader).concat([normalizeHeader(field)]).some(header=>normalizedHeaders.includes(header)));
      if(missing.length)throw new Error(`Colunas obrigatórias ausentes: ${missing.map(field=>labels[field]).join(", ")}. Baixe o modelo desta tela para conferir os cabeçalhos.`);
      setPreview(makePreview(parsed.rows,kind));
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível ler o CSV.");}
  }

  async function importOne(row:PreviewLine){
    const supabase=createClient();
    if(kind==="properties"){
      const payload={...row.payload};
      const ownerDocument=payload.owner_document as string|null;
      delete payload.owner_document;
      if(ownerDocument){
        const {data:owner,error:ownerError}=await supabase.from("clients").select("id").eq("document_number",ownerDocument).maybeSingle();
        if(ownerError)throw ownerError;
        if(!owner)throw new Error("Proprietário não encontrado. Importe o cliente antes ou deixe o CPF/CNPJ em branco.");
        payload.owner_client_id=owner.id;
      }
      const {error:insertError}=await supabase.from("properties").insert({...payload,assigned_agent:assignedAgent,created_by:userId});
      if(insertError)throw insertError;
      return;
    }
    const payload={...row.payload};
    const selectedRoles=payload.roles as string[];
    const interestNeighborhoods=payload.interest_neighborhoods as string[];
    delete payload.roles;delete payload.interest_type;delete payload.interest_purpose;delete payload.interest_min_price;delete payload.interest_max_price;delete payload.interest_min_bedrooms;delete payload.interest_neighborhoods;
    const {data:client,error:clientError}=await supabase.from("clients").insert({...payload,assigned_agent:assignedAgent,created_by:userId}).select("id").single();
    if(clientError||!client)throw clientError??new Error("O cliente não foi criado.");
    try{
      const {error:rolesError}=await supabase.from("client_roles").insert(selectedRoles.map(role=>({client_id:client.id,role})));
      if(rolesError)throw rolesError;
      const interestType=row.payload.interest_type as string|null;
      const interestPurpose=row.payload.interest_purpose as string|null;
      const minPrice=row.payload.interest_min_price as number|null;
      const maxPrice=row.payload.interest_max_price as number|null;
      const minBedrooms=row.payload.interest_min_bedrooms as number|null;
      const hasInterest=Boolean(interestType||interestPurpose||minPrice!==null||maxPrice!==null||minBedrooms!==null||interestNeighborhoods.length);
      if(hasInterest){
        const {data:interest,error:interestError}=await supabase.from("client_interests").insert({client_id:client.id,property_type:interestType,purpose:interestPurpose,min_price:minPrice,max_price:maxPrice,min_bedrooms:minBedrooms}).select("id").single();
        if(interestError||!interest)throw interestError??new Error("O perfil de interesse não foi criado.");
        if(interestNeighborhoods.length){
          const {error:neighborhoodError}=await supabase.from("client_interest_neighborhoods").insert(interestNeighborhoods.map(neighborhood=>({interest_id:interest.id,neighborhood})));
          if(neighborhoodError)throw neighborhoodError;
        }
      }
    }catch(cause){
      const {error:rollbackError}=await supabase.from("clients").delete().eq("id",client.id);
      if(rollbackError)throw new Error(`Falha nos dados associados e também na limpeza do cliente: ${rollbackError.message}`);
      throw cause;
    }
  }

  async function runImport(){
    const validRows=preview.filter(row=>row.errors.length===0);
    if(!validRows.length){setError("Não há linhas válidas para importar.");return;}
    if(!assignedAgent){setError("Selecione o corretor responsável pelos registros.");return;}
    setImporting(true);setProgress(0);setError("");
    const imported:ImportResult[]=preview.filter(row=>row.errors.length>0).map(row=>({line:row.line,name:row.name,ok:false,error:row.errors.join(" ")}));
    let cursor=0;
    const workers=Array.from({length:Math.min(5,validRows.length)},async()=>{
      while(true){
        const index=cursor;cursor+=1;if(index>=validRows.length)return;
        const row=validRows[index];
        try{await importOne(row);imported.push({line:row.line,name:row.name,ok:true,error:""});}
        catch(cause){const message=cause instanceof Error?cause.message:typeof cause==="object"&&cause!==null&&"message" in cause?String(cause.message):"Falha ao gravar no banco.";imported.push({line:row.line,name:row.name,ok:false,error:message});}
        setProgress(value=>value+1);
      }
    });
    await Promise.all(workers);
    imported.sort((a,b)=>a.line-b.line);
    setResults(imported);setImporting(false);
  }

  if(loading)return <main className="flex min-h-screen items-center justify-center">Verificando acesso...</main>;
  if(!admin)return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-3xl px-5 py-10"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-amber-900">A importação de planilhas pode ser feita somente pelo administrador.</p></section></div></main>;

  return <main className="min-h-screen"><AppHeader/><div className="mx-auto max-w-6xl px-5 py-7 sm:py-10">
    <p className="text-sm font-medium text-[var(--green)]">Administração</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Importar CSV</h1><p className="mt-1 text-sm text-[var(--muted)]">Cada linha é validada antes da importação. O sistema mostra erros com o número da linha.</p>
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">O que deseja importar?<select value={kind} onChange={event=>{setKind(event.target.value as ImportKind);setPreview([]);setResults([]);setError("");setFileName("");}} className={inputClass}><option value="properties">Imóveis</option><option value="clients">Clientes</option></select></label>
      <label className="text-sm font-medium">Corretor responsável<select value={assignedAgent} onChange={event=>setAssignedAgent(event.target.value)} className={inputClass}>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.full_name||"Corretor"}</option>)}</select></label>
    </div><div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={()=>downloadCsv(kind==="properties"?"modelo-imoveis.csv":"modelo-clientes.csv",template,[])} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold">Baixar modelo CSV</button><label className="rounded-xl bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-white">Selecionar arquivo CSV<input type="file" accept=".csv,text/csv" onChange={event=>void loadFile(event)} className="sr-only"/></label>{fileName&&<span className="text-sm text-[var(--muted)]">{fileName}</span>}</div>
    <p className="mt-4 text-xs text-[var(--muted)]">Use a linha de cabeçalho do modelo. Para papéis de clientes, separe vários valores com |. Números podem usar vírgula decimal, por exemplo 350000,00. O código dos imóveis é gerado automaticamente.</p></section>
    {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {preview.length>0&&<section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Conferência da planilha</h2><p className="mt-1 text-sm text-[var(--muted)]">{preview.length} linhas · {validCount} válidas · {invalidCount} com erro</p></div><button type="button" disabled={importing||validCount===0||results.length>0} onClick={()=>void runImport()} className="rounded-xl bg-[var(--green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{importing?`Importando ${progress} de ${validCount}...`:results.length?"Importação concluída":"Importar válidas"}</button></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead><tr className="border-b border-[var(--line)]"><th className="p-2">Linha</th><th className="p-2">Registro</th><th className="p-2">Situação</th><th className="p-2">Detalhe</th></tr></thead><tbody>{preview.map(row=><tr key={row.line} className="border-b border-[var(--line)] align-top"><td className="p-2">{row.line}</td><td className="p-2">{row.name}</td><td className="p-2">{row.errors.length?"Erro de validação":"Pronto para importar"}</td><td className="p-2 text-red-700">{row.errors.join(" ")||"—"}</td></tr>)}</tbody></table></div>
    </section>}
    {results.length>0&&<section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Resultado da importação</h2><p className="mt-1 text-sm text-[var(--muted)]">{results.filter(item=>item.ok).length} importados · {results.filter(item=>!item.ok).length} com erro</p></div><button type="button" onClick={()=>downloadCsv("resultado-importacao.csv",["Linha","Registro","Resultado","Detalhe"],results.map(item=>[item.line,item.name,item.ok?"Importado":"Erro",item.error]))} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold">Baixar relatório CSV</button></div><div className="mt-4 max-h-[32rem] overflow-auto"><table className="w-full min-w-[600px] border-collapse text-left text-sm"><thead className="sticky top-0 bg-white"><tr className="border-b border-[var(--line)]"><th className="p-2">Linha</th><th className="p-2">Registro</th><th className="p-2">Resultado</th><th className="p-2">Detalhe</th></tr></thead><tbody>{results.map(item=><tr key={item.line} className="border-b border-[var(--line)] align-top"><td className="p-2">{item.line}</td><td className="p-2">{item.name}</td><td className={`p-2 font-medium ${item.ok?"text-emerald-700":"text-red-700"}`}>{item.ok?"Importado":"Erro"}</td><td className="p-2 text-red-700">{item.error||"—"}</td></tr>)}</tbody></table></div></section>}
  </div></main>;
}
