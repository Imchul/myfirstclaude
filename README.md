# AI MC Project

Playbook 기반 AI 사회자 웹 애플리케이션입니다.

## 시스템 요구사항

- **Node.js**: 버전 18 이상 필요
- **npm**: Node.js와 함께 설치됨

## 설치 방법

### 1. Node.js 설치 (처음 설치하는 경우)

1. [Node.js 공식 사이트](https://nodejs.org/ko/)에 접속
2. **LTS 버전** 다운로드 및 설치
3. 설치 완료 후 터미널(또는 명령 프롬프트)에서 확인:
   ```bash
   node --version
   npm --version
   ```

### 2. 프로젝트 설치

터미널을 열고 프로젝트 폴더로 이동한 뒤 아래 명령어를 순서대로 실행하세요:

```bash
# 1. 루트 폴더에서 의존성 설치
npm install

# 2. 백엔드 의존성 설치
cd backend
npm install

# 3. 프론트엔드 의존성 설치
cd ../frontend
npm install

# 4. 다시 루트 폴더로 이동
cd ..
```

**또는 한 번에 설치:**
```bash
npm run install:all
```

### 3. 환경 변수 설정

`backend/.env` 파일을 열고 API 키를 입력하세요:

```env
OPENAI_API_KEY=your_openai_api_key_here
HEYGEN_API_KEY=your_heygen_api_key_here
PORT=3001
```

> **참고**: `backend/.env.example` 파일을 참고하여 `.env` 파일을 생성할 수 있습니다.

## 실행 방법

### 방법 1: npm 명령어 (권장)

```bash
npm run dev
```

이 명령어를 실행하면 백엔드(포트 3001)와 프론트엔드(포트 5173)가 동시에 실행됩니다.

### 방법 2: 수동 실행

터미널 두 개를 열어서 각각 실행:

**터미널 1 (백엔드):**
```bash
cd backend
npm start
```

**터미널 2 (프론트엔드):**
```bash
cd frontend
npm run dev
```

### 방법 3: 윈도우 원클릭 실행

윈도우 사용자는 `start_windows.bat` 파일을 더블클릭하면 자동으로 설치 및 실행됩니다.

## 접속 방법

실행 후 웹 브라우저에서:

- **메인 스테이지**: http://localhost:5173
- **운영자 콘솔**: http://localhost:5173/operator

## 프로젝트 구조

```
AI_MC_Project/
├── backend/                 # 백엔드 서버
│   ├── data/
│   │   └── playbook.json   # 행사 대본 데이터
│   ├── index.js            # Express 서버
│   ├── .env                # 환경 변수 (API 키)
│   └── .env.example        # 환경 변수 예시
├── frontend/               # 프론트엔드 (React)
│   └── src/
│       ├── components/     # 재사용 컴포넌트
│       ├── hooks/          # 커스텀 훅
│       ├── pages/          # 페이지 컴포넌트
│       └── types/          # TypeScript 타입
├── package.json            # 루트 패키지 설정
├── start_windows.bat       # 윈도우 원클릭 실행
└── README.md               # 이 문서
```

## 주요 기능

### 메인 스테이지 (/)
- HeyGen 아바타 표시
- OpenAI Realtime API를 통한 음성 대화
- 현재 진행 중인 챕터 표시

### 운영자 콘솔 (/operator)

**Live Control 탭:**
- 세션 시작/중지/다음 챕터 제어
- 현재 진행 상황 모니터링
- 실시간 로그 확인

**Playbook Editor 탭:**
- 행사 대본(Playbook) 편집
- 챕터별 스크립트 및 AI 지침 수정
- 실시간 저장 (서버 재시작 불필요)

## 문제 해결

### "node: command not found" 오류
→ Node.js가 설치되지 않았습니다. Node.js를 먼저 설치하세요.

### "EADDRINUSE" 오류 (포트 사용 중)
→ 이미 같은 포트를 사용하는 프로그램이 있습니다. 해당 프로그램을 종료하거나 `.env`에서 PORT를 변경하세요.

### API 오류
→ `backend/.env` 파일의 API 키가 올바른지 확인하세요.

### 아바타가 표시되지 않음
→ HeyGen API 키가 유효한지 확인하세요.

## 라이선스

MIT License
