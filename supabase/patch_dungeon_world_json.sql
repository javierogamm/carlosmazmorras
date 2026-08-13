-- Apply only the changed JSON leaves of an existing dungeon_world row.
-- Run once in Supabase SQL editor before using Configuración → Dungeons edits.
create or replace function public.patch_dungeon_world_json(
  p_id bigint,
  p_world_name text default null,
  p_changes jsonb default '[]'::jsonb
)
returns table (id bigint, created_at timestamptz, world_name text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_json jsonb;
  change jsonb;
begin
  select dungeon.world_json into next_json
  from public.dungeon_world as dungeon
  where dungeon.id = p_id
  for update;

  if not found then
    raise exception 'Dungeon % no encontrada', p_id using errcode = 'P0002';
  end if;

  for change in select value from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb))
  loop
    if jsonb_typeof(change->'path') <> 'array' then
      raise exception 'Cada cambio necesita path como array';
    end if;
    next_json := jsonb_set(
      next_json,
      array(select jsonb_array_elements_text(change->'path')),
      coalesce(change->'value', 'null'::jsonb),
      true
    );
  end loop;

  return query
  update public.dungeon_world as dungeon
  set world_name = coalesce(p_world_name, dungeon.world_name),
      world_json = next_json
  where dungeon.id = p_id
  returning dungeon.id, dungeon.created_at, dungeon.world_name;
end;
$$;
