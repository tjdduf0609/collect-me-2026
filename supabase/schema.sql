-- 올해의 나 수집하기 (자리 + 비밀번호 버전)
-- Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요. 여러 번 실행해도 데이터는 안 지워져요.

-- 0) 예전 이메일 버전을 실행했었다면 정리 ------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'answers' and column_name = 'user_id') then
    drop table public.answers cascade;
  end if;
end $$;
drop table if exists public.members cascade;

create extension if not exists pgcrypto with schema extensions;

-- 1) 테이블 ---------------------------------------------------------------
-- 자리: 닉네임/캐릭터/프로필 사진. user_id는 지금 이 자리에 앉아 있는 기기(익명 로그인)
create table if not exists public.seats (
  seat        int primary key,
  user_id     uuid unique references auth.users on delete set null,
  nick        text check (nick is null or char_length(nick) between 1 and 12),
  emoji       text not null default '🙂',
  photo_path  text,
  joined_at   timestamptz
);

-- 자리 비밀번호 (아무도 직접 못 읽음, 아래 함수만 사용)
create table if not exists public.seat_secrets (
  seat          int primary key references public.seats on delete cascade,
  pin_hash      text not null,
  failed        int not null default 0,
  locked_until  timestamptz
);

create table if not exists public.answers (
  seat        int  not null references public.seats on delete cascade,
  day         int  not null check (day between 1 and 50),
  body        text check (char_length(body) <= 1500),
  photo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (seat, day)
);

-- 자리 개수: 친구 수만큼 (지금은 8자리). 늘리려면 숫자만 바꿔서 다시 Run
insert into public.seats (seat) select g from generate_series(1, 8) g on conflict do nothing;

alter table public.seats        enable row level security;
alter table public.seat_secrets enable row level security;
alter table public.answers      enable row level security;

-- 2) 함수 -----------------------------------------------------------------
create or replace function public.diary_today() returns int
language sql stable as $$
  select ((now() at time zone 'Asia/Seoul')::date - date '2026-11-12') + 1
$$;

create or replace function public.my_seat() returns int
language sql stable security definer set search_path = public as $$
  select seat from public.seats where user_id = auth.uid() limit 1
$$;

create or replace function public.has_answered(d int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.answers where seat = public.my_seat() and day = d)
$$;

-- 누가 어느 날 썼는지만 (내용은 안 보임)
drop function if exists public.day_status();
create function public.day_status() returns table (seat int, day int)
language sql stable security definer set search_path = public as $$
  select a.seat, a.day from public.answers a where public.my_seat() is not null
$$;

-- 자리 앉기 / 내 자리로 들어가기
-- p_mode: 'new' = 빈자리에 처음 앉기, 'enter' = 내 자리 비밀번호로 들어가기
create or replace function public.claim_seat(p_seat int, p_pin text, p_mode text,
                                             p_nick text default null, p_emoji text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.seat_secrets;
  me uuid := auth.uid();
  tries int;
begin
  if me is null then return 'no_auth'; end if;
  perform 1 from public.seats where seat = p_seat for update;
  if not found then return 'no_seat'; end if;
  select * into s from public.seat_secrets where seat = p_seat;

  if p_mode = 'new' then
    if found then return 'taken'; end if;
    if p_pin is null or char_length(p_pin) < 4 then return 'short'; end if;
    if p_nick is null or char_length(btrim(p_nick)) not between 1 and 12 then return 'need_nick'; end if;
    update public.seats set user_id = null where user_id = me;
    insert into public.seat_secrets (seat, pin_hash) values (p_seat, crypt(p_pin, gen_salt('bf')));
    update public.seats
       set user_id = me, nick = btrim(p_nick), emoji = coalesce(nullif(p_emoji, ''), '🙂'), joined_at = now()
     where seat = p_seat;
    return 'ok';
  end if;

  if not found then return 'empty'; end if;
  if s.locked_until is not null and s.locked_until > now() then return 'locked'; end if;
  if s.pin_hash <> crypt(coalesce(p_pin, ''), s.pin_hash) then
    tries := case when s.locked_until is not null then 1 else s.failed + 1 end;
    update public.seat_secrets
       set failed = tries,
           locked_until = case when tries >= 5 then now() + interval '10 minutes' else null end
     where seat = p_seat;
    return case when tries >= 5 then 'locked' else 'wrong' end;
  end if;
  update public.seat_secrets set failed = 0, locked_until = null where seat = p_seat;
  update public.seats set user_id = null where user_id = me and seat <> p_seat;
  update public.seats set user_id = me where seat = p_seat;
  return 'ok';
end $$;

create or replace function public.change_pin(p_new text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_new is null or char_length(p_new) < 4 then return 'short'; end if;
  update public.seat_secrets set pin_hash = crypt(p_new, gen_salt('bf')), failed = 0, locked_until = null
   where seat = public.my_seat();
  if not found then return 'no_seat'; end if;
  return 'ok';
end $$;

revoke all on function public.my_seat()                               from public, anon;
revoke all on function public.has_answered(int)                       from public, anon;
revoke all on function public.day_status()                            from public, anon;
revoke all on function public.claim_seat(int, text, text, text, text) from public, anon;
revoke all on function public.change_pin(text)                        from public, anon;
grant execute on function public.my_seat()                               to authenticated;
grant execute on function public.has_answered(int)                       to authenticated;
grant execute on function public.day_status()                            to authenticated;
grant execute on function public.claim_seat(int, text, text, text, text) to authenticated;
grant execute on function public.change_pin(text)                        to authenticated;

-- 3) 권한 규칙 ------------------------------------------------------------
revoke all on public.seat_secrets from anon, authenticated;
revoke insert, update, delete on public.seats from anon, authenticated;
grant update (nick, emoji, photo_path) on public.seats to authenticated;

drop policy if exists "seats read"   on public.seats;
drop policy if exists "seats update" on public.seats;
create policy "seats read"   on public.seats for select to authenticated using (true);
create policy "seats update" on public.seats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 친구 답은 "그날 내가 먼저 써야" 보임
drop policy if exists "answers read"   on public.answers;
drop policy if exists "answers insert" on public.answers;
drop policy if exists "answers update" on public.answers;
drop policy if exists "answers delete" on public.answers;
create policy "answers read" on public.answers for select to authenticated
  using (seat = public.my_seat() or public.has_answered(day));
create policy "answers insert" on public.answers for insert to authenticated
  with check (seat = public.my_seat() and day <= public.diary_today());
create policy "answers update" on public.answers for update to authenticated
  using (seat = public.my_seat()) with check (seat = public.my_seat() and day <= public.diary_today());
create policy "answers delete" on public.answers for delete to authenticated
  using (seat = public.my_seat());

-- 4) 사진 저장소 (폴더 이름 = 자리 번호) -----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 6291456, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "photos read"       on storage.objects;
drop policy if exists "photos insert own" on storage.objects;
drop policy if exists "photos delete own" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.my_seat() is not null);
create policy "photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_seat()::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_seat()::text);

-- 5) 실시간 반영 ----------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.answers;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.seats;
exception when duplicate_object then null; end $$;
