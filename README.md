# CodeSense — Vercel 배포 가이드

## 📁 파일 구조
```
codesense/
├── index.html        ← 프론트엔드 (API 키 없음)
├── api/
│   └── analyze.js    ← 서버 함수 (API 키 여기에만 보관)
└── vercel.json       ← Vercel 설정
```

## 🚀 배포 방법 (5분이면 끝!)

### 1단계 — GitHub에 올리기
1. github.com 에서 새 저장소 만들기 (이름: `codesense`)
2. 이 폴더 안의 파일 3개를 전부 업로드

### 2단계 — Vercel 연결
1. vercel.com 접속 → 구글 계정으로 로그인
2. **"Add New Project"** 클릭
3. GitHub 저장소 `codesense` 선택 → **Deploy** 클릭

### 3단계 — API 키 환경변수 설정 ⭐ 핵심!
1. 배포 완료 후 Vercel 대시보드 → 프로젝트 클릭
2. **Settings → Environment Variables**
3. 아래처럼 추가:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `AIzaSy...` (본인 Gemini API 키)
4. **Save** 클릭
5. **Deployments → Redeploy** 로 재배포

### 4단계 — 완료!
Vercel이 제공하는 주소 (`https://codesense-xxx.vercel.app`) 로 접속하면
누구나 API 키 없이 바로 사용할 수 있어요.

---

## 🔑 Gemini API 키 발급
- aistudio.google.com 접속
- 구글 계정 로그인
- 상단 "Get API key" → "Create API key"
- 생성된 키 복사 (AIzaSy... 형태)

## ✅ 보안 구조
```
사용자 브라우저 ──→ Vercel 서버 ──→ Gemini API
                    (키 여기에만)
```
- 사용자는 API 키를 절대 볼 수 없어요
- Vercel 환경변수는 암호화되어 저장돼요
