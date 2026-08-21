-- Soulseek Mode v1.1: starter pack unlocks. Run once in the Supabase SQL
-- editor. Same pattern as add_soulseeker_unlocks.sql: a permanent
-- account-level JSON array of unlocked pack ids ("<rarity>_<tier>", e.g.
-- "common_1", "uncommon_2", "epic_3" - tier 1=Starter/2=Advanced/3=Expert).

alter table public.user add column if not exists soulseek_starter_packs json not null default '[]';
update public.user set soulseek_starter_packs = '[]' where soulseek_starter_packs is null;
