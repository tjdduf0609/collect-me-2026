-- 올해의 나 수집하기: Supabase SQL Editor에 통째로 붙여 넣고 Run 하세요.

-- 1) 테이블 ---------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key references auth.users on delete cascade,
  nick        text not null check (char_length(nick) between 1 and 12),
  emoji       text not null default '🙂',
  photo_path  text,
  joined_at   timestamptz not null default now()
);

create table if not exists public.answers (
  user_id     uuid not null references auth.users on delete cascade,
  day         int  not null check (day between 1 and 50),
  body        text check (char_length(body) <= 1500),
  photo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.members enable row level security;
alter table public.answers enable row level security;

-- 2) 도우미 함수 ----------------------------------------------------------
-- 오늘이 몇 일차인지 (한국 시간 기준, 2026-11-12 = 1일차)
create or replace function public.diary_today() returns int
language sql stable as $$
  select ((now() at time zone 'Asia/Seoul')::date - date '2026-11-12') + 1
$$;

-- 내가 그날 답을 썼는지
create or replace function public.has_answered(d int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.answers where user_id = auth.uid() and day = d)
$$;

-- 누가 어느 날 썼는지만 알려 줌 (내용은 안 보임) → 도장/카운트용
create or replace function public.day_status()
returns table (user_id uuid, day int)
language sql stable security definer set search_path = public as $$
  select a.user_id, a.day from public.answers a where auth.uid() is not null
$$;

revoke execute on function public.has_answered(int) from public, anon;
revoke execute on function public.day_status() from public, anon;
grant execute on function public.has_answered(int) to authenticated;
grant execute on function public.day_status() to authenticated;

-- 3) 권한 규칙 ------------------------------------------------------------
drop policy if exists "members read"   on public.members;
drop policy if exists "members insert" on public.members;
drop policy if exists "members update" on public.members;
create policy "members read"   on public.members for select to authenticated using (true);
create policy "members insert" on public.members for insert to authenticated with check (id = auth.uid());
create policy "members update" on public.members for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 친구 답은 "그날 내가 먼저 써야" 보임 (서버에서 막기 때문에 개발자도구로도 못 훔쳐봄)
drop policy if exists "answers read"   on public.answers;
drop policy if exists "answers insert" on public.answers;
drop policy if exists "answers update" on public.answers;
drop policy if exists "answers delete" on public.answers;
create policy "answers read" on public.answers for select to authenticated
  using (user_id = auth.uid() or public.has_answered(day));
create policy "answers insert" on public.answers for insert to authenticated
  with check (user_id = auth.uid() and day <= public.diary_today());
create policy "answers update" on public.answers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and day <= public.diary_today());
create policy "answers delete" on public.answers for delete to authenticated
  using (user_id = auth.uid());

-- 4) 사진 저장소 ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 6291456, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "photos read"       on storage.objects;
drop policy if exists "photos insert own" on storage.objects;
drop policy if exists "photos delete own" on storage.objects;
create policy "photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos');
create policy "photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) 실시간 반영 ----------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.answers;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;
