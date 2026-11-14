-- Corretor so altera clientes que criou. Admin pode alterar todos.
-- O corretor continua vendo clientes conforme a politica clients_read.

create or replace function public.protect_client_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'Somente o admin pode alterar o criador do cliente.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_client_creator on public.clients;
create trigger protect_client_creator
before update on public.clients
for each row execute function public.protect_client_creator();

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using ((select public.is_admin()) or created_by = (select auth.uid()))
with check ((select public.is_admin()) or created_by = (select auth.uid()));

drop policy if exists client_roles_access on public.client_roles;
drop policy if exists client_roles_read on public.client_roles;
drop policy if exists client_roles_insert on public.client_roles;
drop policy if exists client_roles_update on public.client_roles;
drop policy if exists client_roles_delete on public.client_roles;
create policy client_roles_read on public.client_roles for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy client_roles_insert on public.client_roles for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));
create policy client_roles_update on public.client_roles for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
))
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));
create policy client_roles_delete on public.client_roles for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));

drop policy if exists client_interests_access on public.client_interests;
drop policy if exists client_interests_read on public.client_interests;
drop policy if exists client_interests_insert on public.client_interests;
drop policy if exists client_interests_update on public.client_interests;
drop policy if exists client_interests_delete on public.client_interests;
create policy client_interests_read on public.client_interests for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy client_interests_insert on public.client_interests for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));
create policy client_interests_update on public.client_interests for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
))
with check ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));
create policy client_interests_delete on public.client_interests for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())
));

drop policy if exists interest_neighborhoods_access on public.client_interest_neighborhoods;
drop policy if exists interest_neighborhoods_read on public.client_interest_neighborhoods;
drop policy if exists interest_neighborhoods_insert on public.client_interest_neighborhoods;
drop policy if exists interest_neighborhoods_update on public.client_interest_neighborhoods;
drop policy if exists interest_neighborhoods_delete on public.client_interest_neighborhoods;
create policy interest_neighborhoods_read on public.client_interest_neighborhoods for select to authenticated
using (exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id
));
create policy interest_neighborhoods_insert on public.client_interest_neighborhoods for insert to authenticated
with check ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid())
));
create policy interest_neighborhoods_update on public.client_interest_neighborhoods for update to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid())
))
with check ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid())
));
create policy interest_neighborhoods_delete on public.client_interest_neighborhoods for delete to authenticated
using ((select public.is_admin()) or exists (
  select 1 from public.client_interests i join public.clients c on c.id = i.client_id
  where i.id = interest_id and c.created_by = (select auth.uid())
));
