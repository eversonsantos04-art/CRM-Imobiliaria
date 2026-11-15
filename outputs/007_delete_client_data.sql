-- Exclusao definitiva de cliente, permitida somente para administradores.
-- Execute uma vez no SQL Editor do Supabase.

create or replace function public.delete_client_data(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  related_interest_ids text[];
  related_role_ids text[];
  related_neighborhood_ids text[];
  related_interaction_ids text[];
  related_follow_up_ids text[];
  related_property_ids text[];
  deleted_time timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'Somente o admin pode excluir clientes.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.clients c where c.id = target_client_id) then
    raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(i.id::text), array[]::text[])
    into related_interest_ids from public.client_interests i where i.client_id = target_client_id;
  select coalesce(array_agg(concat(r.client_id, ':', r.role)), array[]::text[])
    into related_role_ids from public.client_roles r where r.client_id = target_client_id;
  select coalesce(array_agg(concat(n.interest_id, ':', n.neighborhood)), array[]::text[])
    into related_neighborhood_ids from public.client_interest_neighborhoods n
    where n.interest_id = any(array(select i.id from public.client_interests i where i.client_id = target_client_id));
  select coalesce(array_agg(i.id::text), array[]::text[])
    into related_interaction_ids from public.client_interactions i where i.client_id = target_client_id;
  select coalesce(array_agg(f.id::text), array[]::text[])
    into related_follow_up_ids from public.follow_ups f where f.client_id = target_client_id;
  select coalesce(array_agg(p.id::text), array[]::text[])
    into related_property_ids from public.properties p where p.owner_client_id = target_client_id;

  -- A exclusao remove os dados relacionados; imoveis ficam e perdem o vinculo do proprietario.
  delete from public.clients where id = target_client_id;

  -- Mantem somente um evento generico, sem copiar dados pessoais para a auditoria.
  delete from public.audit_logs a where
    (a.entity_type = 'clients' and a.entity_id = target_client_id::text)
    or (a.entity_type = 'client_roles' and a.entity_id = any(related_role_ids))
    or (a.entity_type = 'client_interests' and a.entity_id = any(related_interest_ids))
    or (a.entity_type = 'client_interest_neighborhoods' and a.entity_id = any(related_neighborhood_ids))
    or (a.entity_type = 'client_interactions' and a.entity_id = any(related_interaction_ids))
    or (a.entity_type = 'follow_ups' and a.entity_id = any(related_follow_up_ids))
    or (a.entity_type = 'properties' and a.entity_id = any(related_property_ids) and a.field_name = 'owner_client_id');

  insert into public.audit_logs(actor_id, entity_type, entity_id, operation, field_name, old_value, new_value, occurred_at)
  values (auth.uid(), 'clients', target_client_id::text, 'DELETE', 'client_deleted', null,
          jsonb_build_object('deleted', true), deleted_time);
end;
$$;

revoke all on function public.delete_client_data(uuid) from public, anon;
grant execute on function public.delete_client_data(uuid) to authenticated;
