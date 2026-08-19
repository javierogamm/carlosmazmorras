-- Soulseek Mode (Fase 3): account-level unlock pools + ephemeral shop stash.
-- Run once in the Supabase SQL editor.

-- Each is a JSON array of unlocked ids, permanent per account (never reset).
alter table public.user add column if not exists soulseek_races json not null default '[]';
alter table public.user add column if not exists soulseek_classes json not null default '[]';
alter table public.user add column if not exists soulseek_skills json not null default '[]';
update public.user set soulseek_races = '[]' where soulseek_races is null;
update public.user set soulseek_classes = '[]' where soulseek_classes is null;
update public.user set soulseek_skills = '[]' where soulseek_skills is null;

-- Ephemeral items bought in the Soul Unlocks shop: a JSON array of fully
-- rolled item objects, injected into the inventory of the next Soulseeker
-- character created, then cleared (back to '[]') the moment that character
-- dies (see soulseeker-dungeons.js's death flow).
alter table public.user add column if not exists soulseek_session_items json not null default '[]';
update public.user set soulseek_session_items = '[]' where soulseek_session_items is null;
