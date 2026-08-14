-- v0.65.2: persistent Soul Spikes balance.
alter table public.user_pj add column if not exists souls numeric not null default 0;
update public.user_pj set souls = 0 where souls is null;
