# AI MC Project - 개선 계획

## 핵심 개념: 사회자 타임 vs 세션

```
┌─────────────────────────────────────────────────────────────┐
│  행사 구조                                                   │
├─────────────────────────────────────────────────────────────┤
│  사회자 타임 1 → 세션 1 → 사회자 타임 2 → 세션 2 → ...     │
│  (두에나 등장)   (두에나 X)  (두에나 등장)   (두에나 X)      │
└─────────────────────────────────────────────────────────────┘
```

### 사회자 타임 (MC_TIME)
- AI 사회자 "두에나"가 등장
- 공동사회자가 "두에나"라고 부르면 응답
- OpenAI Realtime + HeyGen API 활성화
- 대본에 따라 응답

### 세션 (SESSION)
- 연사 발표, 동영상, 시상식 등
- AI 사회자 등장하지 않음
- API 호출 없음 (비용 절감)

---

## 구현 계획

### Phase 1: Main Stage Clean Feed
- [ ] 1.1 전체화면 레이아웃 (100vw x 100vh, 검정 배경)
- [ ] 1.2 "Enter Stage" 버튼 오버레이 (브라우저 오디오 정책)
- [ ] 1.3 모든 UI 제거 (헤더, 버튼, 정보 패널)
- [ ] 1.4 백엔드 상태 폴링 (1초 간격)
- [ ] 1.5 Operator Console 명령에 따라만 동작

### Phase 2: Operator Console 확장
- [ ] 2.1 탭 구조: Live Control / Settings / Editor
- [ ] 2.2 Live Control 탭
  - [ ] 현재 항목 표시 (사회자 타임/세션)
  - [ ] Start Event / Next / Stop 버튼
  - [ ] 음성 세션 시작/종료 (사회자 타임에서만)
  - [ ] 소리 켜기/끄기
  - [ ] 비상 정지
  - [ ] 실시간 로그
- [ ] 2.3 Settings 탭
  - [ ] Avatar ID 설정
  - [ ] MC 이름 설정 (기본값: 두에나)
- [ ] 2.4 Editor 탭
  - [ ] 항목 추가/삭제 (사회자 타임 또는 세션)
  - [ ] JSON 가져오기/내보내기
  - [ ] 샘플 JSON 다운로드

### Phase 3: Backend API 확장
- [ ] 3.1 상태 관리 개선 (currentItem, voiceSessionActive)
- [ ] 3.2 설정 API (/api/settings)
- [ ] 3.3 음성 세션 제어 API

### Phase 4: Playbook 구조 변경
- [ ] 4.1 type 필드 추가: 'MC_TIME' | 'SESSION'
- [ ] 4.2 MC_TIME: script (대본), systemInstruction
- [ ] 4.3 SESSION: description (설명만)

### Phase 5: MC 설정
- [ ] 5.1 "두에나"라고 부를 때만 응답
- [ ] 5.2 System Instruction 자동 생성

---

## 샘플 Playbook (JSON)

```json
[
  {
    "id": "mc_1",
    "type": "MC_TIME",
    "title": "사회자 타임 1 - 오프닝",
    "script": "2025년 기술혁신연구원 성과 공유회는 Tech session과 Cheer-up session으로 진행될 예정입니다.",
    "systemInstruction": "행사 진행 구성에 대해 설명합니다. 밝고 친근하게 답변하세요."
  },
  {
    "id": "session_1",
    "type": "SESSION",
    "title": "세션 1 - 연구원장 Opening",
    "description": "연구원장님의 개회사"
  },
  {
    "id": "mc_2",
    "type": "MC_TIME",
    "title": "사회자 타임 2 - Opening 코멘트",
    "script": "좋은 말씀 감사드립니다. 조금만 짧게 해주셔도 더 좋았을 것 같습니다.",
    "systemInstruction": "연구원장님의 Opening에 대해 가볍게 코멘트합니다."
  }
]
```

---

## 파일 변경 목록

1. `frontend/src/pages/MainStage.tsx` - Clean Feed 전면 재작성
2. `frontend/src/pages/OperatorConsole.tsx` - 기능 대폭 확장
3. `frontend/src/components/HeyGenAvatar.tsx` - 전체화면 스타일
4. `frontend/src/types/index.ts` - 타입 정의 수정
5. `backend/index.js` - API 확장
6. `backend/data/playbook.json` - 샘플 데이터
7. `README.md` - 문서 업데이트
