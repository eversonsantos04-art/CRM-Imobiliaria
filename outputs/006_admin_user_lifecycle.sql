-- Permite excluir uma conta sem apagar os registros de CRM que ela criou.
-- Execute uma vez no SQL Editor do Supabase antes de usar exclusao de usuarios.

alter table public.profiles add column if not exists disabled_at timestamptz;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.disabled_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.disabled_at is null
  );
$$;

-- O ban do Auth impede novos logins; estas politicas tambem cortam sessoes abertas.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using ((select public.is_active_user()) and (id = (select auth.uid()) or (select public.is_admin())));
drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or assigned_agent = (select auth.uid())));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or (assigned_agent = (select auth.uid()) and created_by = (select auth.uid()))));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or (created_by = (select auth.uid()) and anonymized_at is null)))
with check ((select public.is_active_user()) and ((select public.is_admin()) or (created_by = (select auth.uid()) and anonymized_at is null)));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
using ((select public.is_active_user()) and (select public.is_admin()));

drop policy if exists client_roles_read on public.client_roles;
create policy client_roles_read on public.client_roles for select to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id));
drop policy if exists client_roles_insert on public.client_roles;
create policy client_roles_insert on public.client_roles for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists client_roles_update on public.client_roles;
create policy client_roles_update on public.client_roles for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)))
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists client_roles_delete on public.client_roles;
create policy client_roles_delete on public.client_roles for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));

drop policy if exists client_interests_read on public.client_interests;
create policy client_interests_read on public.client_interests for select to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id));
drop policy if exists client_interests_insert on public.client_interests;
create policy client_interests_insert on public.client_interests for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists client_interests_update on public.client_interests;
create policy client_interests_update on public.client_interests for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)))
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists client_interests_delete on public.client_interests;
create policy client_interests_delete on public.client_interests for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));

drop policy if exists interest_neighborhoods_read on public.client_interest_neighborhoods;
create policy interest_neighborhoods_read on public.client_interest_neighborhoods for select to authenticated
using ((select public.is_active_user()) and exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id where i.id = interest_id
));
drop policy if exists interest_neighborhoods_insert on public.client_interest_neighborhoods;
create policy interest_neighborhoods_insert on public.client_interest_neighborhoods for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists interest_neighborhoods_update on public.client_interest_neighborhoods;
create policy interest_neighborhoods_update on public.client_interest_neighborhoods for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)))
with check ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));
drop policy if exists interest_neighborhoods_delete on public.client_interest_neighborhoods;
create policy interest_neighborhoods_delete on public.client_interest_neighborhoods for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid()) and c.anonymized_at is null
)));

drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties for select to authenticated
using ((select public.is_active_user()));
drop policy if exists properties_insert on public.properties;
create policy properties_insert on public.properties for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or created_by = (select auth.uid())));
drop policy if exists properties_update on public.properties;
create policy properties_update on public.properties for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or created_by = (select auth.uid())))
with check ((select public.is_active_user()) and ((select public.is_admin()) or created_by = (select auth.uid())));
drop policy if exists properties_delete on public.properties;
create policy properties_delete on public.properties for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or created_by = (select auth.uid())));

drop policy if exists status_history_read on public.property_status_history;
create policy status_history_read on public.property_status_history for select to authenticated
using ((select public.is_active_user()));
drop policy if exists property_photos_read on public.property_photos;
create policy property_photos_read on public.property_photos for select to authenticated
using ((select public.is_active_user()));
drop policy if exists property_photos_insert on public.property_photos;
create policy property_photos_insert on public.property_photos for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))));
drop policy if exists property_photos_update on public.property_photos;
create policy property_photos_update on public.property_photos for update to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))))
with check ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))));
drop policy if exists property_photos_delete on public.property_photos;
create policy property_photos_delete on public.property_photos for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))));
drop policy if exists property_documents_read on public.property_documents;
create policy property_documents_read on public.property_documents for select to authenticated
using ((select public.is_active_user()));
drop policy if exists property_documents_insert on public.property_documents;
create policy property_documents_insert on public.property_documents for insert to authenticated
with check ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))));
drop policy if exists property_documents_delete on public.property_documents;
create policy property_documents_delete on public.property_documents for delete to authenticated
using ((select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator(property_id))));

drop policy if exists interactions_read on public.client_interactions;
drop policy if exists interactions_insert on public.client_interactions;
drop policy if exists interactions_update on public.client_interactions;
drop policy if exists interactions_delete on public.client_interactions;
create policy interactions_read on public.client_interactions for select to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id));
create policy interactions_insert on public.client_interactions for insert to authenticated
with check ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy interactions_update on public.client_interactions for update to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null))
with check ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy interactions_delete on public.client_interactions for delete to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));

drop policy if exists follow_ups_read on public.follow_ups;
drop policy if exists follow_ups_insert on public.follow_ups;
drop policy if exists follow_ups_update on public.follow_ups;
drop policy if exists follow_ups_delete on public.follow_ups;
create policy follow_ups_read on public.follow_ups for select to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id));
create policy follow_ups_insert on public.follow_ups for insert to authenticated
with check ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy follow_ups_update on public.follow_ups for update to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null))
with check ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));
create policy follow_ups_delete on public.follow_ups for delete to authenticated
using ((select public.is_active_user()) and exists (select 1 from public.clients c where c.id = client_id and c.anonymized_at is null));

drop policy if exists property_photo_storage_read on storage.objects;
create policy property_photo_storage_read on storage.objects for select to authenticated
using (bucket_id = 'property-photos' and (select public.is_active_user()));
drop policy if exists property_photo_storage_insert on storage.objects;
create policy property_photo_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'property-photos' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
drop policy if exists property_photo_storage_update on storage.objects;
create policy property_photo_storage_update on storage.objects for update to authenticated
using (bucket_id = 'property-photos' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))))
with check (bucket_id = 'property-photos' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
drop policy if exists property_photo_storage_delete on storage.objects;
create policy property_photo_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'property-photos' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
drop policy if exists property_document_storage_read on storage.objects;
create policy property_document_storage_read on storage.objects for select to authenticated
using (bucket_id = 'property-documents' and (select public.is_active_user()));
drop policy if exists property_document_storage_insert on storage.objects;
create policy property_document_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'property-documents' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
drop policy if exists property_document_storage_update on storage.objects;
create policy property_document_storage_update on storage.objects for update to authenticated
using (bucket_id = 'property-documents' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))))
with check (bucket_id = 'property-documents' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
drop policy if exists property_document_storage_delete on storage.objects;
create policy property_document_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'property-documents' and (select public.is_active_user()) and ((select public.is_admin()) or (select public.is_property_creator((storage.foldername(name))[1]::uuid))));

alter table public.clients alter column created_by drop not null;
alter table public.clients drop constraint if exists clients_created_by_fkey;
alter table public.clients add constraint clients_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.properties alter column created_by drop not null;
alter table public.properties drop constraint if exists properties_created_by_fkey;
alter table public.properties add constraint properties_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.property_documents alter column created_by drop not null;
alter table public.property_documents drop constraint if exists property_documents_created_by_fkey;
alter table public.property_documents add constraint property_documents_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.client_interactions alter column created_by drop not null;
alter table public.client_interactions drop constraint if exists client_interactions_created_by_fkey;
alter table public.client_interactions add constraint client_interactions_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.follow_ups alter column created_by drop not null;
alter table public.follow_ups drop constraint if exists follow_ups_created_by_fkey;
alter table public.follow_ups add constraint follow_ups_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

create or replace function public.prepare_user_for_deletion(target_user_id uuid, replacement_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o admin pode excluir usuarios.' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Nao e permitido excluir a propria conta.' using errcode = '22023';
  end if;
  if target_user_id = replacement_user_id then
    raise exception 'Escolha outra conta ativa para receber os registros.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'Usuario nao encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles p where p.id = replacement_user_id) then
    raise exception 'A conta substituta nao foi encontrada.' using errcode = 'P0002';
  end if;

  -- Mantem a carteira e transfere os registros; a autoria historica passa a ficar sem usuario ativo.
  update public.clients set
    assigned_agent = case when assigned_agent = target_user_id then replacement_user_id else assigned_agent end,
    created_by = case when created_by = target_user_id then null else created_by end
  where assigned_agent = target_user_id or created_by = target_user_id;

  update public.properties set
    assigned_agent = case when assigned_agent = target_user_id then replacement_user_id else assigned_agent end,
    created_by = case when created_by = target_user_id then null else created_by end
  where assigned_agent = target_user_id or created_by = target_user_id;

  update public.follow_ups set
    assigned_agent = case when assigned_agent = target_user_id then replacement_user_id else assigned_agent end,
    created_by = case when created_by = target_user_id then null else created_by end
  where assigned_agent = target_user_id or created_by = target_user_id;

  update public.property_documents set created_by = null where created_by = target_user_id;
  update public.client_interactions set created_by = null where created_by = target_user_id;
end;
$$;

create or replace function public.record_user_admin_action(target_user_id uuid, action_name text, details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o admin pode gerenciar usuarios.' using errcode = '42501';
  end if;
  if action_name not in ('account_created','account_edited','account_deactivated','account_restored','password_reset','account_deleted') then
    raise exception 'Acao de usuario invalida.' using errcode = '22023';
  end if;
  insert into public.audit_logs(actor_id, entity_type, entity_id, operation, field_name, new_value)
  values (
    auth.uid(), 'profiles', target_user_id::text,
    case when action_name = 'account_created' then 'INSERT' when action_name = 'account_deleted' then 'DELETE' else 'UPDATE' end,
    action_name, coalesce(details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.prepare_user_for_deletion(uuid, uuid) from public, anon;
grant execute on function public.prepare_user_for_deletion(uuid, uuid) to authenticated;
revoke all on function public.record_user_admin_action(uuid, text, jsonb) from public, anon;
grant execute on function public.record_user_admin_action(uuid, text, jsonb) to authenticated;
