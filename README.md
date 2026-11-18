# 올해의 나 수집하기 📝

친구들끼리 50일 동안 하루 한 주제씩 쓰는 링 바인더 다이어리 웹사이트예요.
Vite(바닐라 JS) + Supabase(DB·사진) + Vercel(배포) 구성이고, 7~10명 규모면 전부 무료 플랜으로 충분해요.

50가지 주제는 kyul님의 ‘올해의 나 수집하기’(© 2026 kyul)에서 빌려 왔어요.

## 기능

- 이메일·아이디 없이 **빈자리를 골라 앉는 방식** (닉네임 + 캐릭터 + 비밀번호)
- 다른 기기에서는 내 자리를 눌러 비밀번호만 입력하면 이어서 쓰기
- 비밀번호 5번 틀리면 그 자리 10분 잠금, 프로필 창에서 비밀번호 바꾸기 가능
- 오늘 날짜 주제 자동 표시, 미래 날짜는 잠금 (서버에서도 막음)
- 그날 내 답을 써야 친구들 답이 열림 (서버 권한 규칙으로 막아서 개발자도구로도 못 봄)
- 글 + 사진, 프로필 사진/캐릭터, 연속 기록, 친구별 모아보기
- 실시간 반영 (+ 1분마다 가볍게 새로고침)

## 폴더 구조

```
index.html            다이어리 뼈대
src/main.js           앱 로직
src/style.css         디자인
supabase/schema.sql   DB 테이블 + 권한 규칙 + 사진 저장소
.env.example          환경 변수 예시
```

---

## 배포 순서

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 New project 생성 (Region은 Northeast Asia (Seoul) 추천)
2. 왼쪽 **SQL Editor** → New query → `supabase/schema.sql` 내용 전체 붙여 넣고 **Run**
3. **Project Settings → API**(또는 API Keys)에서 아래 두 값을 복사해 두기
   - Project URL
   - anon (또는 publishable) key

### 2. 익명 로그인 켜기

자리 방식은 기기마다 자동으로 익명 로그인을 한 뒤, 자리 비밀번호로 본인 확인을 해요.

**Authentication → Sign In / Providers → Allow anonymous sign-ins: 켜기**

### 3. GitHub에 올리고 Vercel로 배포

```bash
git init && git add . && git commit -m "올해의 나 수집하기"
git branch -M main
git remote add origin https://github.com/<아이디>/collect-me-2026.git
git push -u origin main
```

1. https://vercel.com → Add New → Project → 방금 만든 저장소 Import
2. Framework Preset: **Vite** (자동 인식됨)
3. **Environment Variables**에 추가
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon/publishable key
4. Deploy → `https://collect-me-2026.vercel.app` 같은 주소가 생겨요

### 4. 단톡방에 공유

Vercel 주소만 공유하면 끝! 친구들은 들어와서 빈자리를 골라 닉네임, 캐릭터, 비밀번호를 정하고 앉아요. 프로필 사진은 들어간 뒤 왼쪽 페이지의 EDIT에서 올려요.

## 자리 관리 (SQL Editor에서)

```sql
-- 자리 개수 늘리기: 10자리까지
insert into public.seats (seat) select g from generate_series(1, 10) g on conflict do nothing;

-- 아무도 안 앉은 빈자리 없애기 (모르는 사람이 앉는 걸 막고 싶을 때, 친구들이 다 앉은 뒤에)
delete from public.seats s where s.nick is null;

-- 3번 자리 친구가 비밀번호를 잊었을 때: 임시 비밀번호 1234로 초기화 (글은 그대로)
update public.seat_secrets
   set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')), failed = 0, locked_until = null
 where seat = 3;

-- 3번 자리를 완전히 비우기 (닉네임/글/비밀번호 모두 삭제)
delete from public.answers where seat = 3;
delete from public.seat_secrets where seat = 3;
update public.seats set user_id = null, nick = null, emoji = '🙂', photo_path = null, joined_at = null where seat = 3;
```

> 링크를 아는 사람은 누구나 빈자리에 앉을 수 있어요. 링크는 단톡방에만 공유하고, 친구들이 다 앉으면 위의 "빈자리 없애기"를 실행해 두면 안전해요. 자리에 앉지 않은 사람은 글과 사진을 볼 수 없어요.

---

## 로컬에서 실행

```bash
cp .env.example .env    # 값 채우기
npm install
npm run dev             # http://localhost:5173
```

## 자주 생기는 문제

| 증상 | 해결 |
|---|---|
| "다이어리에 연결하지 못했어요" | 2번 익명 로그인이 켜져 있는지 확인 |
| 비밀번호를 잊음 | 위 "자리 관리"의 임시 비밀번호 초기화 |
| 한 기기에서 쓰다가 갑자기 저장이 안 됨 | 다른 기기에서 같은 자리로 들어오면 이전 기기는 자리에서 내려와요. 새로고침 후 다시 들어가기 |
| 사진이 안 올라감 | 사진은 6MB 이하, JPG/PNG/WEBP/GIF만 가능 (자동으로 줄여서 올리긴 해요) |
| HEIC(아이폰) 사진이 안 됨 | 일부 브라우저는 HEIC를 못 읽어요. 아이폰 설정 → 카메라 → 포맷 → 높은 호환성 |

## 날짜 바꾸고 싶을 때

시작일은 두 군데에 있어요.
- `src/main.js` 맨 위 `START`, `END`
- `supabase/schema.sql`의 `diary_today()` 안 `date '2026-11-12'` (바꾼 뒤 그 함수 부분만 다시 Run)
