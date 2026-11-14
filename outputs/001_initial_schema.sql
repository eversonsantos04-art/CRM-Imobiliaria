-- CRM imobiliario: esquema inicial, permissoes e auditoria.
-- Execute no SQL Editor do Supabase em um projeto novo.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'corretor' check (role in ('admin', 'corretor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contas novas recebem o papel corretor. Admins sao promovidos manualmente.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '') from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document_number text unique,
  phone text,
  whatsapp text,
  email text,
  address text,
  income numeric(14,2) check (income is null or income >= 0),
  contact_source text,
  assigned_agent uuid not null references public.profiles(id),
  notes text,
  consent_at timestamptz,
  consent_method text,
  anonymized_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Somente o admin pode mudar o criador original do cliente.
create or replace function public.protect_client_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'Somente o admin pode alterar o criador do cliente';
  end if;
  return new;
end;
$$;
create trigger protect_client_creator before update on public.clients
for each row execute function public.protect_client_creator();

create table public.client_roles (
  client_id uuid not null references public.clients(id) on delete cascade,
  role text not null check (role in ('comprador','locatario','proprietario','investidor')),
  primary key (client_id, role)
);

create table public.client_interests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  property_type text check (property_type is null or property_type in ('casa','apartamento','terreno','comercial','rural')),
  purpose text check (purpose is null or purpose in ('venda','aluguel','ambos')),
  min_price numeric(14,2) check (min_price is null or min_price >= 0),
  max_price numeric(14,2) check (max_price is null or max_price >= 0),
  min_bedrooms smallint check (min_bedrooms is null or min_bedrooms >= 0),
  created_at timestamptz not null default now(),
  check (min_price is null or max_price is null or min_price <= max_price)
);
create table public.client_interest_neighborhoods (
  interest_id uuid not null references public.client_interests(id) on delete cascade,
  neighborhood text not null,
  primary key (interest_id, neighborhood)
);

create sequence public.property_internal_code_seq as bigint minvalue 1 start with 1;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null unique,
  title text not null,
  description text,
  property_type text not null check (property_type in ('casa','apartamento','terreno','comercial','rural')),
  purpose text not null check (purpose in ('venda','aluguel','ambos')),
  status text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','alugado','inativo')),
  postal_code text,
  street text,
  street_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  sale_price numeric(14,2) check (sale_price is null or sale_price >= 0),
  rent_price numeric(14,2) check (rent_price is null or rent_price >= 0),
  condo_fee numeric(14,2) check (condo_fee is null or condo_fee >= 0),
  property_tax numeric(14,2) check (property_tax is null or property_tax >= 0),
  total_area numeric(12,2) check (total_area is null or total_area >= 0),
  built_area numeric(12,2) check (built_area is null or built_area >= 0),
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  suites smallint check (suites is null or suites >= 0),
  bathrooms smallint check (bathrooms is null or bathrooms >= 0),
  parking_spaces smallint check (parking_spaces is null or parking_spaces >= 0),
  owner_client_id uuid references public.clients(id) on delete set null,
  assigned_agent uuid not null references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O codigo nunca e informado pelo usuario e nao pode ser alterado depois da criacao.
create or replace function public.generate_property_internal_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.internal_code := nextval('public.property_internal_code_seq')::text;
    return new;
  end if;
  if new.internal_code is distinct from old.internal_code then
    raise exception 'O codigo do imovel e gerado pelo sistema e nao pode ser alterado.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger properties_internal_code_system
before insert or update of internal_code on public.properties
for each row execute function public.generate_property_internal_code();

-- Esta funcao vem depois da tabela properties, que ela consulta.
create or replace function public.is_property_creator(property_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.properties p
    where p.id = property_id and p.created_by = (select auth.uid()));
$$;

-- O corretor nao pode transferir para si um imovel de outro criador.
create or replace function public.protect_property_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'Somente o admin pode alterar o criador do imovel';
  end if;
  return new;
end;
$$;
create trigger protect_property_creator before update on public.properties
for each row execute function public.protect_property_creator();

create table public.property_status_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  old_status text check (old_status is null or old_status in ('disponivel','reservado','vendido','alugado','inativo')),
  new_status text not null check (new_status in ('disponivel','reservado','vendido','alugado','inativo')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create or replace function public.record_property_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.property_status_history(property_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.property_status_history(property_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger property_status_changed after insert or update of status on public.properties
for each row execute function public.record_property_status();

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  caption text,
  position smallint not null default 0 check (position between 0 and 7),
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (property_id, position)
);
create unique index property_photos_one_cover on public.property_photos(property_id) where is_cover;

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('contato','visita','negociacao')),
  occurred_at timestamptz not null default now(),
  note text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_agent uuid not null references public.profiles(id),
  due_at timestamptz not null,
  note text,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  occurred_at timestamptz not null default now()
);

-- Um registro de auditoria por campo criado, removido ou alterado.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_data jsonb; new_data jsonb; row_id text; field text; actor uuid;
begin
  if tg_op <> 'INSERT' then old_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_data := to_jsonb(new); end if;
  row_id := coalesce(new_data ->> 'id', old_data ->> 'id');
  if row_id is null and tg_table_name = 'client_roles' then
    row_id := concat_ws(':', coalesce(new_data ->> 'client_id', old_data ->> 'client_id'),
      coalesce(new_data ->> 'role', old_data ->> 'role'));
  elsif row_id is null and tg_table_name = 'client_interest_neighborhoods' then
    row_id := concat_ws(':', coalesce(new_data ->> 'interest_id', old_data ->> 'interest_id'),
      coalesce(new_data ->> 'neighborhood', old_data ->> 'neighborhood'));
  elsif row_id is null then
    row_id := coalesce(new_data ->> 'client_id', old_data ->> 'client_id',
      new_data ->> 'property_id', old_data ->> 'property_id',
      new_data ->> 'interest_id', old_data ->> 'interest_id',
      new_data::text, old_data::text);
  end if;
  actor := (select auth.uid());
  if tg_table_name = 'profiles' and tg_op = 'DELETE' then actor := null; end if;
  if tg_op = 'INSERT' then
    for field in select jsonb_object_keys(new_data) loop
      insert into public.audit_logs(actor_id,entity_type,entity_id,operation,field_name,new_value)
      values (actor,tg_table_name,row_id,tg_op,field,new_data -> field);
    end loop;
  elsif tg_op = 'DELETE' then
    for field in select jsonb_object_keys(old_data) loop
      insert into public.audit_logs(actor_id,entity_type,entity_id,operation,field_name,old_value)
      values (actor,tg_table_name,row_id,tg_op,field,old_data -> field);
    end loop;
  else
    for field in select jsonb_object_keys(new_data) loop
      if old_data -> field is distinct from new_data -> field then
        insert into public.audit_logs(actor_id,entity_type,entity_id,operation,field_name,old_value,new_value)
        values (actor,tg_table_name,row_id,tg_op,field,old_data -> field,new_data -> field);
      end if;
    end loop;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['profiles','clients','client_roles','client_interests','client_interest_neighborhoods',
    'properties','property_photos','property_documents','client_interactions','follow_ups'] loop
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit_log()',t,t);
  end loop;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger clients_touch_updated_at before update on public.clients for each row execute function public.touch_updated_at();
create trigger properties_touch_updated_at before update on public.properties for each row execute function public.touch_updated_at();

create index clients_assigned_agent_idx on public.clients(assigned_agent);
create index clients_name_idx on public.clients using gin(to_tsvector('simple',name));
create index client_roles_role_idx on public.client_roles(role);
create index properties_status_idx on public.properties(status);
create index properties_type_purpose_idx on public.properties(property_type,purpose);
create index properties_city_neighborhood_idx on public.properties(city,neighborhood);
create index properties_agent_creator_idx on public.properties(assigned_agent,created_by);
create index properties_price_idx on public.properties(sale_price,rent_price);
create index property_status_history_property_idx on public.property_status_history(property_id,changed_at desc);
create index client_interactions_client_idx on public.client_interactions(client_id,occurred_at desc);
create index follow_ups_due_idx on public.follow_ups(assigned_agent,due_at) where completed_at is null;
create index audit_logs_filter_idx on public.audit_logs(actor_id,occurred_at desc,entity_type);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_roles enable row level security;
alter table public.client_interests enable row level security;
alter table public.client_interest_neighborhoods enable row level security;
alter table public.properties enable row level security;
alter table public.property_status_history enable row level security;
alter table public.property_photos enable row level security;
alter table public.property_documents enable row level security;
alter table public.client_interactions enable row level security;
alter table public.follow_ups enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_manage on public.profiles for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy clients_read on public.clients for select to authenticated
using ((select public.is_admin()) or assigned_agent = (select auth.uid()));
create policy clients_insert on public.clients for insert to authenticated
with check ((select public.is_admin()) or (assigned_agent = (select auth.uid()) and created_by = (select auth.uid())));
create policy clients_update on public.clients for update to authenticated
using ((select public.is_admin()) or created_by = (select auth.uid()))
with check ((select public.is_admin()) or created_by = (select auth.uid()));
create policy clients_delete on public.clients for delete to authenticated
using ((select public.is_admin()));

-- Corretores leem os dados relacionados a clientes acessiveis, mas so editam os proprios.
create policy client_roles_read on public.client_roles for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy client_roles_insert on public.client_roles for insert to authenticated
with check ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));
create policy client_roles_update on public.client_roles for update to authenticated
using ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())))
with check ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));
create policy client_roles_delete on public.client_roles for delete to authenticated
using ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));

create policy client_interests_read on public.client_interests for select to authenticated
using (exists (select 1 from public.clients c where c.id = client_id));
create policy client_interests_insert on public.client_interests for insert to authenticated
with check ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));
create policy client_interests_update on public.client_interests for update to authenticated
using ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())))
with check ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));
create policy client_interests_delete on public.client_interests for delete to authenticated
using ((select public.is_admin()) or exists (select 1 from public.clients c where c.id = client_id and c.created_by = (select auth.uid())));

create policy interest_neighborhoods_read on public.client_interest_neighborhoods for select to authenticated
using (exists (select 1 from public.client_interests i join public.clients c on c.id=i.client_id where i.id=interest_id));
create policy interest_neighborhoods_insert on public.client_interest_neighborhoods for insert to authenticated
with check ((select public.is_admin()) or exists (select 1 from public.client_interests i join public.clients c on c.id=i.client_id where i.id=interest_id and c.created_by=(select auth.uid())));
create policy interest_neighborhoods_update on public.client_interest_neighborhoods for update to authenticated
using ((select public.is_admin()) or exists (select 1 from public.client_interests i join public.clients c on c.id=i.client_id where i.id=interest_id and c.created_by=(select auth.uid())))
with check ((select public.is_admin()) or exists (select 1 from public.client_interests i join public.clients c on c.id=i.client_id where i.id=interest_id and c.created_by=(select auth.uid())));
create policy interest_neighborhoods_delete on public.client_interest_neighborhoods for delete to authenticated
using ((select public.is_admin()) or exists (select 1 from public.client_interests i join public.clients c on c.id=i.client_id where i.id=interest_id and c.created_by=(select auth.uid())));

create policy properties_read on public.properties for select to authenticated using (true);
create policy properties_insert on public.properties for insert to authenticated
with check ((select public.is_admin()) or created_by = (select auth.uid()));
create policy properties_update on public.properties for update to authenticated
using ((select public.is_admin()) or created_by = (select auth.uid()))
with check ((select public.is_admin()) or created_by = (select auth.uid()));
create policy properties_delete on public.properties for delete to authenticated
using ((select public.is_admin()) or created_by = (select auth.uid()));

create policy status_history_read on public.property_status_history for select to authenticated using (true);
create policy property_photos_read on public.property_photos for select to authenticated using (true);
create policy property_photos_insert on public.property_photos for insert to authenticated
with check ((select public.is_admin()) or (select public.is_property_creator(property_id)));
create policy property_photos_update on public.property_photos for update to authenticated
using ((select public.is_admin()) or (select public.is_property_creator(property_id)))
with check ((select public.is_admin()) or (select public.is_property_creator(property_id)));
create policy property_photos_delete on public.property_photos for delete to authenticated
using ((select public.is_admin()) or (select public.is_property_creator(property_id)));

create policy property_documents_read on public.property_documents for select to authenticated using (true);
create policy property_documents_insert on public.property_documents for insert to authenticated
with check ((select public.is_admin()) or (select public.is_property_creator(property_id)));
create policy property_documents_delete on public.property_documents for delete to authenticated
using ((select public.is_admin()) or (select public.is_property_creator(property_id)));

create policy interactions_access on public.client_interactions for all to authenticated
using (exists (select 1 from public.clients c where c.id=client_id))
with check (exists (select 1 from public.clients c where c.id=client_id));
create policy follow_ups_access on public.follow_ups for all to authenticated
using (exists (select 1 from public.clients c where c.id=client_id))
with check (exists (select 1 from public.clients c where c.id=client_id));

create policy audit_admin_read on public.audit_logs for select to authenticated
using ((select public.is_admin()));
-- Historico de status e auditoria sao preenchidos somente pelos triggers.

create view public.public_available_properties with (security_barrier=true) as
select id,internal_code,title,description,property_type,purpose,neighborhood,city,state,
       sale_price,rent_price,condo_fee,property_tax,
       total_area,built_area,bedrooms,suites,bathrooms,parking_spaces,created_at,updated_at
from public.properties where status='disponivel';
revoke all on public.public_available_properties from public,anon,authenticated;
grant select on public.public_available_properties to anon,authenticated;

-- Arquivos privados. Caminho esperado: {property_id}/{nome-do-arquivo}.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('property-photos','property-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit)
values ('property-documents','property-documents',false,52428800)
on conflict (id) do nothing;
create policy property_photo_storage_read on storage.objects for select to authenticated
using (bucket_id='property-photos');
create policy property_photo_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='property-photos' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
create policy property_photo_storage_update on storage.objects for update to authenticated
using (bucket_id='property-photos' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))))
with check (bucket_id='property-photos' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
create policy property_photo_storage_delete on storage.objects for delete to authenticated
using (bucket_id='property-photos' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
create policy property_document_storage_read on storage.objects for select to authenticated
using (bucket_id='property-documents');
create policy property_document_storage_insert on storage.objects for insert to authenticated
with check (bucket_id='property-documents' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
create policy property_document_storage_update on storage.objects for update to authenticated
using (bucket_id='property-documents' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))))
with check (bucket_id='property-documents' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));
create policy property_document_storage_delete on storage.objects for delete to authenticated
using (bucket_id='property-documents' and ((select public.is_admin()) or
 (select public.is_property_creator((storage.foldername(name))[1]::uuid))));

-- Depois de criar o primeiro usuario no Auth, promova-o em SQL:
-- update public.profiles set role='admin' where id='UUID-DO-USUARIO';

