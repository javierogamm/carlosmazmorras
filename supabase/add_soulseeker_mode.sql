-- Soulseek Mode (Fase 1): account-level soul currency + per-character mode flag.
-- Run once in the Supabase SQL editor.

-- Account-level Soul Spikes bank: souls banked permanently when a Soulseeker
-- character is let die instead of revived (see user_pj.soulseeker below).
-- Distinct from user_pj.souls, which is the per-character spendable stash
-- used for in-run revives/the Soul Merchant.
alter table public.user add column if not exists souls numeric not null default 0;
update public.user set souls = 0 where souls is null;

-- Marks a character as created in Soulseek Mode: starts classless, uses
-- advanced classes + Action Points by default, and feeds the account-level
-- soul bank above on permanent death instead of always reviving.
alter table public.user_pj add column if not exists soulseeker boolean not null default false;
update public.user_pj set soulseeker = false where soulseeker is null;
