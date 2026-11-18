# 올해의 나 수집하기 📝

친구들끼리 50일 동안 하루 한 주제씩 쓰는 링 바인더 다이어리 웹사이트예요.
Vite(바닐라 JS) + Supabase(DB·로그인·사진) + Vercel(배포) 구성이고, 7~10명 규모면 전부 무료 플랜으로 충분해요.

50가지 주제는 kyul님의 ‘올해의 나 수집하기’(© 2026 kyul)에서 빌려 왔어요.

## 기능

- 이메일 로그인 (비밀번호 없이 메일 속 링크 또는 숫자 코드로)
- 초대한 이메일만 로그인 가능 (가입 막음)
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

### 2. 이메일 발송 설정 (꼭 해야 해요!)

Supabase 기본 메일 서버는 **프로젝트 팀원 이메일로만, 시간당 2통까지만** 보내요. 친구들한테 로그인 메일이 가려면 직접 SMTP를 연결해야 해요. 도메인이 없으면 Gmail이 제일 쉬워요.

1. Google 계정 → 보안 → **2단계 인증** 켜기
2. Google 계정 → 보안 → **앱 비밀번호** 만들기 (16자리 복사)
3. Supabase → **Authentication → Emails → SMTP Settings** → Enable custom SMTP
   - Sender email: 내 Gmail 주소
   - Sender name: 올해의 나 수집하기
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: 내 Gmail 주소
   - Password: 방금 만든 앱 비밀번호
4. 저장

### 3. 로그인 메일에 숫자 코드 넣기

휴대폰에서는 메일 링크가 다른 브라우저로 열려서 로그인이 안 이어질 때가 있어요. 코드도 같이 보내면 사이트에 직접 입력할 수 있어요.

**Authentication → Emails → Templates → Magic Link** 본문을 아래처럼 바꾸기:

```html
<h2>올해의 나 수집하기 📝</h2>
<p>로그인 코드: <b style="font-size:20px">{{ .Token }}</b></p>
<p><a href="{{ .ConfirmationURL }}">또는 여기를 눌러 바로 들어가기</a></p>
```

### 4. 아무나 가입 못 하게 막기

**Authentication → Sign In / Providers**
- Email: 켜짐 확인
- **Allow new users to sign up: 끄기**

### 5. GitHub에 올리고 Vercel로 배포

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

### 6. 사이트 주소를 Supabase에 알려 주기

**Authentication → URL Configuration**
- Site URL: Vercel 주소 (예: `https://collect-me-2026.vercel.app`)
- Redirect URLs: 같은 주소 추가 (로컬 테스트용으로 `http://localhost:5173`도 추가)

### 7. 친구 등록하기

**Authentication → Users → Add user → Create new user**
- 친구 이메일 입력, 비밀번호는 아무거나 (안 씀)
- **Auto Confirm User 체크**
- 나 포함 8명 반복

이제 단톡방에 Vercel 주소를 공유하면 끝! 친구들은 이메일 입력 → 메일 속 코드 입력 → 닉네임/프로필 설정 순서로 들어와요.

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
| "초대받지 않은 이메일이에요" | 7번에서 그 이메일을 등록했는지 확인 |
| 메일이 안 옴 / "Email address not authorized" | 2번 SMTP 설정 확인, 스팸함 확인 |
| "메일을 너무 자주 요청했어요" | 같은 사람은 60초에 한 번만 요청 가능. 전체 한도는 Authentication → Rate Limits에서 조절 |
| 링크 누르면 localhost로 감 | 6번 Site URL을 Vercel 주소로 |
| 사진이 안 올라감 | 사진은 6MB 이하, JPG/PNG/WEBP/GIF만 가능 (자동으로 줄여서 올리긴 해요) |
| HEIC(아이폰) 사진이 안 됨 | 일부 브라우저는 HEIC를 못 읽어요. 아이폰 설정 → 카메라 → 포맷 → 높은 호환성 |

## 날짜 바꾸고 싶을 때

시작일은 두 군데에 있어요.
- `src/main.js` 맨 위 `START`, `END`
- `supabase/schema.sql`의 `diary_today()` 안 `date '2026-11-12'` (바꾼 뒤 그 함수 부분만 다시 Run)
