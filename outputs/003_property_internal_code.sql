-- Generates immutable, sequential property codes.
-- Existing codes stay unchanged; new codes start after the largest numeric code
-- still present or captured in the audit log.
-- Sequence values are never reclaimed when an insert fails or a property is deleted.

do $$
declare
  current_max bigint;
begin
  if to_regclass('public.property_internal_code_seq') is null then
    create sequence public.property_internal_code_seq as bigint minvalue 1 start with 1;

    select max(code::bigint)
      into current_max
      from (
        select internal_code as code from public.properties
        union all
        select old_value #>> '{}' from public.audit_logs
          where entity_type = 'properties' and field_name = 'internal_code'
        union all
        select new_value #>> '{}' from public.audit_logs
          where entity_type = 'properties' and field_name = 'internal_code'
      ) used_codes
      where code ~ '^[0-9]{1,18}$';

    if current_max is null or current_max = 0 then
      perform setval('public.property_internal_code_seq', 1, false);
    else
      perform setval('public.property_internal_code_seq', current_max, true);
    end if;
  end if;
end;
$$;

create or replace function public.generate_property_internal_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.internal_code := nextval('public.property_internal_code_seq')::text;
    return new;
  end if;

  if new.internal_code is distinct from old.internal_code then
    raise exception 'O código do imóvel é gerado pelo sistema e não pode ser alterado.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_internal_code_system on public.properties;
create trigger properties_internal_code_system
before insert or update of internal_code on public.properties
for each row execute function public.generate_property_internal_code();
