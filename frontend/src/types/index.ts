// Playbook Item - 사회자 타임 또는 세션
export interface PlaybookItem {
  id: string;
  type: 'MC_TIME' | 'SESSION';
  title: string;
  // MC_TIME용 필드
  script?: string;           // 대본 (예시 답변)
  systemInstruction?: string; // AI 행동 지침
  // SESSION용 필드
  description?: string;      // 세션 설명
}

// 설정
export interface Settings {
  avatarId: string;
  mcName: string;
}

// 앱 상태
export interface AppState {
  currentItemId: string | null;
  currentItem?: PlaybookItem;
  isRunning: boolean;
  voiceSessionActive: boolean;  // 음성 세션 활성화 여부
  audioEnabled: boolean;        // 소리 켜기/끄기
  playbook: PlaybookItem[];
  settings: Settings;
  logs: LogEntry[];
}

export interface LogEntry {
  time: string;
  message: string;
}

// 기존 호환성을 위한 별칭
export type Chapter = PlaybookItem;
