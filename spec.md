# 프로젝트 사양서: 편집 가능한 Playbook 기반 AI 사회자 (v3)

## 1. 개요
이 시스템은 'Playbook(행사 식순)' 데이터에 따라 진행되는 AI 사회자 웹 앱이다.
**핵심 요구사항**: 행사의 대본은 자주 변경되므로, 코드가 아닌 **JSON 파일**로 관리하며, 운영자가 **콘솔 웹페이지(UI)에서 직접 대본을 수정하고 저장**할 수 있어야 한다.

## 2. 참고 자료 (Reference)
- `reference.md`: OpenAI WebRTC 연결 및 HeyGen 연동 핵심 로직이 포함되어 있다. 이 코드를 기반으로 작성하라.

## 3. 데이터 구조: Playbook (File Persistence)
- 백엔드는 `backend/data/playbook.json` 파일을 생성하여 데이터를 영구 저장한다.
- 서버 시작 시 이 파일을 읽어 메모리에 로드한다. (파일이 없으면 기본 샘플 데이터 생성)

**데이터 구조 (TypeScript):**
```typescript
interface Chapter {
  id: string;             // 고유 ID (예: "chap_1")
  title: string;          // 화면 표시용 (예: "1. 오프닝")
  mode: "INTERACTIVE" | "LISTENING" | "PASSIVE"; 
  baseScript: string;     // 기본 멘트 (수정 가능)
  systemInstruction: string; // AI 행동 지침 (수정 가능)
}

## 4. 상세 기능 요구사항

### A. Backend (`/backend`)

1. **Playbook API**:
    
    - `GET /api/playbook`: 저장된 파일 내용 반환.
        
    - `POST /api/playbook`: 클라이언트에서 보낸 JSON 데이터를 받아 `playbook.json` 파일에 덮어쓰기(저장).
        
2. **State Management**:
    
    - 현재 진행 중인 챕터(`currentChapterId`) 추적.
        
    - 챕터 변경 시, `AiMcService`는 최신 Playbook 데이터를 참조하여 Realtime Session 설정을 업데이트.
        
3. **Proxy API**: `.env`의 키를 사용하여 `/api/session`, `/api/getToken` 구현.
    

### B. Frontend - Operator Console (`/operator`)

화면을 두 개의 탭(Tab)으로 구성하여 구현한다.

**Tab 1: Live Control (진행)**

- 현재 챕터 하이라이트 및 상태 표시.
    
- `[Start]`, `[Next Chapter]`, `[Stop]` 버튼으로 진행 제어.
    
- AI 로그 모니터링.
    

**Tab 2: Playbook Editor (편집)**

- 좌측에 챕터 리스트, 우측에 편집 폼(Textarea) 배치.
    
- 운영자가 `baseScript`와 `systemInstruction`을 수정 가능.
    
- **[Save Changes]** 버튼 클릭 시 `/api/playbook` API를 호출하여 파일 저장.
    
- 저장 후에는 서버 재시작 없이도 즉시 라이브 진행에 반영되어야 함.
    

### C. Frontend - Main Stage (`/`)

- `reference.md`의 로직을 사용하여 HeyGen 아바타와 Realtime 세션 연결.
    
- 1초마다 백엔드 상태를 폴링하여 챕터 변경 감지.
    

## 5. 구현 가이드

- **파일 시스템**: Node.js `fs` 모듈 사용.
    
- **스타일**: TailwindCSS를 사용하여 직관적인 UI 구현.
    
- **실행**: `npm run dev` 명령어로 백엔드/프론트엔드 동시 실행.
