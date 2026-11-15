"use client";

import { createClient } from "@/lib/supabase/client";
import { digitsOnly, parseBrazilianDecimal, validatePropertyFormData } from "@/lib/form-validation";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function currentAccess() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, userId: user.id, isAdmin: profile?.role === "admin" };
}
function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function numberOrNull(form: FormData, name: string) {
  const raw = text(form, name);
  if (!raw) return null;
  const value = parseBrazilianDecimal(raw);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : NaN;
}

export async function saveProperty(form: FormData): Promise<ActionResult> {
  const access = await currentAccess();
  if (!access) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  const id = text(form, "id"), title = text(form, "title");
  const propertyType = text(form, "property_type"), purpose = text(form, "purpose"), status = text(form, "status");
  const ownerClientId = text(form, "owner_client_id") || null;
  const assignedAgent = access.isAdmin ? text(form, "assigned_agent") || access.userId : access.userId;
  let existingProperty: { created_by: string; postal_code: string | null } | null = null;
  if (id) {
    const { data: existing, error: existingError } = await access.supabase.from("properties").select("created_by,postal_code").eq("id", id).maybeSingle();
    if (existingError || !existing) return { ok: false, error: "Imóvel não encontrado." };
    if (!access.isAdmin && existing.created_by !== access.userId) return { ok: false, error: "Você só pode editar imóveis que cadastrou." };
    existingProperty = existing;
  }
  const fieldErrors = validatePropertyFormData(form, existingProperty?.postal_code);
  if (Object.keys(fieldErrors).length) return { ok: false, error: Object.values(fieldErrors)[0] };
  if (!title) return { ok: false, error: "Preencha o título do imóvel." };
  if (!["casa","apartamento","terreno","comercial","rural"].includes(propertyType)) return { ok: false, error: "Selecione um tipo de imóvel válido." };
  if (!["venda","aluguel","ambos"].includes(purpose)) return { ok: false, error: "Selecione uma finalidade válida." };
  if (!["disponivel","reservado","vendido","alugado","inativo"].includes(status)) return { ok: false, error: "Selecione um status válido." };
  if (ownerClientId) {
    const { data: owner } = await access.supabase.from("clients").select("id").eq("id", ownerClientId).maybeSingle();
    if (!owner) return { ok: false, error: "O proprietário selecionado não está acessível para sua conta." };
  }

  const names = ["sale_price","rent_price","condo_fee","property_tax","total_area","built_area","bedrooms","suites","bathrooms","parking_spaces"];
  const numbers = Object.fromEntries(names.map((name) => [name, numberOrNull(form, name)])) as Record<string,number|null>;
  if (Object.values(numbers).some((value) => typeof value === "number" && !Number.isFinite(value))) {
    return { ok: false, error: "Valores e medidas devem ser números iguais ou maiores que zero." };
  }
  if (["bedrooms","suites","bathrooms","parking_spaces"].some((name) => typeof numbers[name] === "number" && !Number.isInteger(numbers[name]))) {
    return { ok: false, error: "Quartos, suítes, banheiros e vagas devem ser números inteiros." };
  }
  const payload = {
    title, description: text(form,"description") || null,
    property_type: propertyType, purpose, status,
    postal_code: existingProperty && digitsOnly(text(form, "postal_code")) === digitsOnly(existingProperty.postal_code ?? "")
      ? existingProperty.postal_code
      : digitsOnly(text(form, "postal_code")) || null,
    street: text(form,"street") || null,
    street_number: text(form,"street_number") || null, complement: text(form,"complement") || null,
    neighborhood: text(form,"neighborhood") || null, city: text(form,"city") || null,
    state: text(form,"state").toUpperCase() || null,
    sale_price: numbers.sale_price, rent_price: numbers.rent_price, condo_fee: numbers.condo_fee,
    property_tax: numbers.property_tax, total_area: numbers.total_area, built_area: numbers.built_area,
    bedrooms: numbers.bedrooms, suites: numbers.suites, bathrooms: numbers.bathrooms,
    parking_spaces: numbers.parking_spaces, owner_client_id: ownerClientId, assigned_agent: assignedAgent,
  };
  if (id) {
    const { error } = await access.supabase.from("properties").update(payload).eq("id",id);
    if (error) return { ok:false,error:error.code==="23505"?"Já existe um imóvel com esse código interno.":"Não foi possível salvar. Confira os campos e tente novamente." };
    return { ok:true,id };
  }
  const { data,error } = await access.supabase.from("properties").insert(payload).select("id").single();
  if (error || !data) return { ok:false,error:error?.code==="23505"?"Já existe um imóvel com esse código interno.":"Não foi possível cadastrar. Confira os campos e as permissões." };
  return { ok:true,id:data.id };
}

export async function deleteProperty(propertyId:string):Promise<ActionResult> {
  const access=await currentAccess();
  if(!access)return {ok:false,error:"Sua sessão expirou. Entre novamente."};
  const {data:property}=await access.supabase.from("properties").select("created_by").eq("id",propertyId).single();
  if(!property)return {ok:false,error:"Imóvel não encontrado."};
  if(!access.isAdmin&&property.created_by!==access.userId)return {ok:false,error:"Você só pode excluir imóveis que cadastrou."};
  for(const bucket of ["property-photos","property-documents"]) {
    const {data:files,error:listError}=await access.supabase.storage.from(bucket).list(propertyId);
    if(listError)return {ok:false,error:"Não foi possível conferir os arquivos anexados."};
    if(files?.length) {
      const {error}=await access.supabase.storage.from(bucket).remove(files.map(file=>`${propertyId}/${file.name}`));
      if(error)return {ok:false,error:"Não foi possível remover os arquivos. O imóvel foi mantido."};
    }
  }
  const {error}=await access.supabase.from("properties").delete().eq("id",propertyId);
  return error?{ok:false,error:"Não foi possível excluir este imóvel."}:{ok:true};
}

export async function removePropertyPhoto(photoId:string):Promise<ActionResult> {
  const access=await currentAccess();
  if(!access)return {ok:false,error:"Sua sessão expirou. Entre novamente."};
  const {data:photo}=await access.supabase.from("property_photos").select("property_id,storage_path").eq("id",photoId).single();
  if(!photo)return {ok:false,error:"Foto não encontrada."};
  const {data:property}=await access.supabase.from("properties").select("created_by").eq("id",photo.property_id).single();
  if(!property||(!access.isAdmin&&property.created_by!==access.userId))return {ok:false,error:"Você não pode alterar fotos deste imóvel."};
  const {error:storageError}=await access.supabase.storage.from("property-photos").remove([photo.storage_path]);
  if(storageError)return {ok:false,error:"Não foi possível remover o arquivo da foto."};
  const {error}=await access.supabase.from("property_photos").delete().eq("id",photoId);
  if(error)return {ok:false,error:"O arquivo foi removido, mas não foi possível atualizar a lista."};
  const {data:remaining}=await access.supabase.from("property_photos").select("id,is_cover").eq("property_id",photo.property_id).order("position");
  if(remaining?.length) {
    const cover=remaining.find(item=>item.is_cover)?.id??remaining[0].id;
    const {error:orderError}=await access.supabase.rpc("reorder_property_photos",{p_property_id:photo.property_id,p_photo_ids:remaining.map(item=>item.id),p_cover_id:cover});
    if(orderError)return {ok:false,error:"A foto foi removida, mas não foi possível reorganizar as restantes."};
  }
  return {ok:true,id:photo.property_id};
}

export async function removePropertyDocument(documentId:string):Promise<ActionResult> {
  const access=await currentAccess();
  if(!access)return {ok:false,error:"Sua sessão expirou. Entre novamente."};
  const {data:document}=await access.supabase.from("property_documents").select("property_id,storage_path").eq("id",documentId).single();
  if(!document)return {ok:false,error:"Documento não encontrado."};
  const {data:property}=await access.supabase.from("properties").select("created_by").eq("id",document.property_id).single();
  if(!property||(!access.isAdmin&&property.created_by!==access.userId))return {ok:false,error:"Você não pode alterar anexos deste imóvel."};
  const {error:storageError}=await access.supabase.storage.from("property-documents").remove([document.storage_path]);
  if(storageError)return {ok:false,error:"Não foi possível remover o arquivo."};
  const {error}=await access.supabase.from("property_documents").delete().eq("id",documentId);
  return error?{ok:false,error:"O arquivo foi removido, mas não foi possível atualizar a lista."}:{ok:true,id:document.property_id};
}

export async function reorderPropertyPhotos(propertyId:string,photoIds:string[],coverId:string|null):Promise<ActionResult> {
  const access=await currentAccess();
  if(!access)return {ok:false,error:"Sua sessão expirou. Entre novamente."};
  const {error}=await access.supabase.rpc("reorder_property_photos",{p_property_id:propertyId,p_photo_ids:photoIds,p_cover_id:coverId});
  return error?{ok:false,error:`Não foi possível atualizar a ordem das fotos: ${error.message}`}:{ok:true,id:propertyId};
}

export async function setPropertyCover(photoId:string):Promise<ActionResult> {
  const access=await currentAccess();
  if(!access)return {ok:false,error:"Sua sessão expirou. Entre novamente."};

  const {data:photo,error:photoError}=await access.supabase.from("property_photos").select("id,property_id").eq("id",photoId).maybeSingle();
  if(photoError||!photo)return {ok:false,error:"Não foi possível encontrar esta foto."};
  const {data:property,error:propertyError}=await access.supabase.from("properties").select("created_by").eq("id",photo.property_id).maybeSingle();
  if(propertyError||!property)return {ok:false,error:"Não foi possível encontrar o imóvel desta foto."};
  if(!access.isAdmin&&property.created_by!==access.userId)return {ok:false,error:"Você só pode escolher a capa de imóveis que cadastrou."};

  const {data:previous,error:previousError}=await access.supabase.from("property_photos").select("id").eq("property_id",photo.property_id).eq("is_cover",true).maybeSingle();
  if(previousError)return {ok:false,error:"Não foi possível verificar a capa atual."};

  const {error:clearError}=await access.supabase.from("property_photos").update({is_cover:false}).eq("property_id",photo.property_id).eq("is_cover",true);
  if(clearError)return {ok:false,error:`Não foi possível remover a capa anterior: ${clearError.message}`};
  const {error:setError}=await access.supabase.from("property_photos").update({is_cover:true}).eq("id",photo.id).eq("property_id",photo.property_id);
  if(setError) {
    if(previous?.id) await access.supabase.from("property_photos").update({is_cover:true}).eq("id",previous.id);
    return {ok:false,error:`Não foi possível salvar a nova capa: ${setError.message}`};
  }
  return {ok:true,id:photo.property_id};
}

