-- Anonimiza dados pessoais e remove informacoes associadas que possam identificar o cliente.
-- Execute uma vez no SQL Editor do Supabase.

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using ((select public.is_admin()) or (created_by = (select auth.uid()) and anonymized_at is null))
with check ((select public.is_admin()) or (created_by = (select auth.uid()) and anonymized_at is null));

drop policy if exists client_roles_insert on public.client_roles;
create policy client_roles_insert on public.client_roles for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists client_roles_update on public.client_roles;
create policy client_roles_update on public.client_roles for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
))
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists client_roles_delete on public.client_roles;
create policy client_roles_delete on public.client_roles for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));

drop policy if exists client_interests_insert on public.client_interests;
create policy client_interests_insert on public.client_interests for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists client_interests_update on public.client_interests;
create policy client_interests_update on public.client_interests for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
))
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists client_interests_delete on public.client_interests;
create policy client_interests_delete on public.client_interests for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));

drop policy if exists interest_neighborhoods_insert on public.client_interest_neighborhoods;
create policy interest_neighborhoods_insert on public.client_interest_neighborhoods for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists interest_neighborhoods_update on public.client_interest_neighborhoods;
create policy interest_neighborhoods_update on public.client_interest_neighborhoods for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
))
with check ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));
drop policy if exists interest_neighborhoods_delete on public.client_interest_neighborhoods;
create policy interest_neighborhoods_delete on public.client_interest_neighborhoods for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
));

drop policy if exists interactions_access on public.client_interactions;
drop policy if exists interactions_read on public.client_interactions;
drop policy if exists interactions_insert on public.client_interactions;
drop policy if exists interactions_update on public.client_interactions;
drop policy if exists interactions_delete on public.client_interactions;
create policy interactions_read on public.client_interactions for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy interactions_insert on public.client_interactions for insert to authenticated
with check (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy interactions_update on public.client_interactions for update to authenticated
using (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null))
with check (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy interactions_delete on public.client_interactions for delete to authenticated
using (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));

drop policy if exists follow_ups_access on public.follow_ups;
drop policy if exists follow_ups_read on public.follow_ups;
drop policy if exists follow_ups_insert on public.follow_ups;
drop policy if exists follow_ups_update on public.follow_ups;
drop policy if exists follow_ups_delete on public.follow_ups;
create policy follow_ups_read on public.follow_ups for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy follow_ups_insert on public.follow_ups for insert to authenticated
with check (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy follow_ups_update on public.follow_ups for update to authenticated
using (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null))
with check (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy follow_ups_delete on public.follow_ups for delete to authenticated
using (exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));

create or replace function public.anonymize_client(target_client_id uuid)
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
  anonymized_time timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'Somente o admin pode anonimizar clientes.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.clients c where c.id = target_client_id) then
    raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.clients c where c.id = target_client_id and c.anonymized_at is not null) then
    raise exception 'Este cliente ja foi anonimizado.' using errcode = '22023';
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

  -- Remove observacoes que podem conter dados pessoais e as preferencias do cliente.
  update public.client_interactions set note = null where client_id = target_client_id;
  delete from public.follow_ups where client_id = target_client_id;
  delete from public.client_roles where client_id = target_client_id;
  delete from public.client_interests where client_id = target_client_id;
  update public.properties set owner_client_id = null where owner_client_id = target_client_id;

  update public.clients set
    name = 'Cliente anonimizado', document_number = null, phone = null, whatsapp = null,
    email = null, address = null, income = null, contact_source = null, notes = null,
    consent_at = null, consent_method = null, anonymized_at = anonymized_time
  where id = target_client_id;

  -- O trigger de auditoria registrou valores antigos durante as operacoes acima.
  -- Apagamos esses detalhes pessoais e mantemos um unico evento generico.
  delete from public.audit_logs a where
    (a.entity_type = 'clients' and a.entity_id = target_client_id::text)
    or (a.entity_type = 'client_roles' and a.entity_id = any(related_role_ids))
    or (a.entity_type = 'client_interests' and a.entity_id = any(related_interest_ids))
    or (a.entity_type = 'client_interest_neighborhoods' and a.entity_id = any(related_neighborhood_ids))
    or (a.entity_type = 'client_interactions' and a.entity_id = any(related_interaction_ids))
    or (a.entity_type = 'follow_ups' and a.entity_id = any(related_follow_up_ids))
    or (a.entity_type = 'properties' and a.entity_id = any(related_property_ids) and a.field_name = 'owner_client_id');

  insert into public.audit_logs(actor_id, entity_type, entity_id, operation, field_name, old_value, new_value, occurred_at)
  values (auth.uid(), 'clients', target_client_id::text, 'UPDATE', 'anonymized_at', null, to_jsonb(anonymized_time), anonymized_time);
end;
$$;

revoke all on function public.anonymize_client(uuid) from public, anon;
grant execute on function public.anonymize_client(uuid) to authenticated;
