-- Interior-room metadata. Run once before deploying v0.90.0.
alter table public.config_world_object
  add column if not exists door text;

alter table public.config_floor
  add column if not exists interior boolean not null default false;

comment on column public.config_world_object.door is
  'Optional zero-based asset tile coordinate encoded as x;y.';
comment on column public.config_floor.interior is
  'True when this tileset is reserved for generated interior rooms.';
