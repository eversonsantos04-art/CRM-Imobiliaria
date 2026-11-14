-- Permite alterar a ordem e a capa das fotos como uma operacao atomica.
alter table public.property_photos
  drop constraint property_photos_property_id_position_key;
alter table public.property_photos
  add constraint property_photos_property_id_position_key
  unique (property_id, position) deferrable initially deferred;

create or replace function public.reorder_property_photos(
  p_property_id uuid,
  p_photo_ids uuid[],
  p_cover_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator uuid;
  photo_count integer;
  requested_count integer;
  unique_requested integer;
begin
  select p.created_by into creator
  from public.properties p where p.id = p_property_id;

  if not found then raise exception 'Imovel nao encontrado'; end if;
  if creator <> (select auth.uid()) and not public.is_admin() then
    raise exception 'Sem permissao para ordenar estas fotos';
  end if;

  select count(*) into photo_count from public.property_photos
  where property_id = p_property_id;
  requested_count := coalesce(cardinality(p_photo_ids), 0);
  select count(distinct requested_id) into unique_requested
  from unnest(coalesce(p_photo_ids, '{}'::uuid[])) as requested(requested_id);

  if requested_count > 8 or requested_count <> photo_count or requested_count <> unique_requested then
    raise exception 'Lista de fotos invalida';
  end if;
  if p_cover_id is not null and not (p_cover_id = any(coalesce(p_photo_ids, '{}'::uuid[]))) then
    raise exception 'A capa precisa ser uma das fotos do imovel';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_photo_ids, '{}'::uuid[])) requested(id)
    left join public.property_photos photo on photo.id = requested.id and photo.property_id = p_property_id
    where photo.id is null
  ) then
    raise exception 'A lista contem foto de outro imovel';
  end if;

  set constraints property_photos_property_id_position_key deferred;
  update public.property_photos photo
  set position = (requested.ordinality - 1)::smallint,
      is_cover = (photo.id = p_cover_id)
  from unnest(coalesce(p_photo_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  where photo.id = requested.id and photo.property_id = p_property_id;
end;
$$;

revoke all on function public.reorder_property_photos(uuid, uuid[], uuid) from public, anon;
grant execute on function public.reorder_property_photos(uuid, uuid[], uuid) to authenticated;

-- Um corretor so pode associar ao imovel um cliente que esteja autorizado a consultar.
drop policy if exists properties_insert on public.properties;
create policy properties_insert on public.properties for insert to authenticated
with check (
  ((select public.is_admin()) or created_by = (select auth.uid()))
  and (owner_client_id is null or (select public.is_admin()) or exists (
    select 1 from public.clients c where c.id = owner_client_id
  ))
);

drop policy if exists properties_update on public.properties;
create policy properties_update on public.properties for update to authenticated
using ((select public.is_admin()) or created_by = (select auth.uid()))
with check (
  ((select public.is_admin()) or created_by = (select auth.uid()))
  and (owner_client_id is null or (select public.is_admin()) or exists (
    select 1 from public.clients c where c.id = owner_client_id
  ))
);

