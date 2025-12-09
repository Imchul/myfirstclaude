import { useEffect, useState, useRef, useCallback } from 'react';
import HeyGenAvatar from '../components/HeyGenAvatar';
import type { HeyGenAvatarRef } from '../components/HeyGenAvatar';
import { useRealtimeSession } from '../hooks/useRealtimeSession';
import type { AppState, PlaybookItem } from '../types';

export default function MainStage() {
  const [state, setState] = useState<AppState | null>(null);
  const [isStageEntered, setIsStageEntered] = useState(false);
  const [currentItem, setCurrentItem] = useState<PlaybookItem | null>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const avatarRef = useRef<HeyGenAvatarRef>(null);
  const lastItemRef = useRef<PlaybookItem | null>(null);
  const voiceSessionActiveRef = useRef(false);
  const wasRunningRef = useRef(false);
  const [avatarMounted, setAvatarMounted] = useState(false);

  const handleTextResponse = useCallback((text: string) => {
    console.log('[MainStage] AI Response received:', text);

    // Wake Word 필터링: <SILENCE> 토큰이 오면 말하지 않음
    if (text.trim() === '<SILENCE>') {
      console.log('[MainStage] Ignored response (Silence token)');
      return;
    }

    console.log('[MainStage] Speaking check:', {
      avatarExists: !!avatarRef.current,
      audioEnabled: state?.audioEnabled
    });

    if (avatarRef.current && state?.audioEnabled) {
      // 새로운 대사가 오면 기존 말을 끊고 시작
      avatarRef.current.interrupt();

      // Interrupt 처리 시간을 확보하기 위해 약간의 지연 후 말하기 시작
      setTimeout(() => {
        if (avatarRef.current) {
          avatarRef.current.speak(text);
        }
      }, 500); // 100ms -> 500ms로 증가 (안전성 확보)
    }
  }, [state?.audioEnabled]);

  const {
    isConnected,
    startSession,
    stopSession,
    updateSessionConfig,
  } = useRealtimeSession(undefined, handleTextResponse);

  // Poll backend state every second
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data: AppState = await res.json();
          setState(data);

          // 현재 아이템 변경 감지 (ID, 스크립트, 시스템 지시문 변경 시 업데이트)
          const currentItem = data.currentItem;
          const prevItem = lastItemRef.current;

          const isItemChanged = !prevItem ||
            currentItem?.id !== prevItem.id ||
            currentItem?.script !== prevItem.script ||
            currentItem?.systemInstruction !== prevItem.systemInstruction;

          if (currentItem && isItemChanged) {
            lastItemRef.current = currentItem;
            setCurrentItem(currentItem);
            console.log('[MainStage] Item or content changed:', currentItem.title);
          }

          // 음성 세션 상태 변경 감지
          if (data.voiceSessionActive !== voiceSessionActiveRef.current) {
            voiceSessionActiveRef.current = data.voiceSessionActive;

            if (data.voiceSessionActive && !isConnected && isAvatarReady) {
              console.log('[MainStage] Starting voice session...');
              startSession();
            } else if (!data.voiceSessionActive && isConnected) {
              console.log('[MainStage] Stopping voice session...');
              stopSession();
            }
          }

          // 이벤트 정지 감지 (비상 정지 포함)
          if (wasRunningRef.current && !data.isRunning) {
            console.log('[MainStage] Event stopped - stopping avatar and voice session');
            // 음성 세션 정지
            if (isConnected) {
              stopSession();
            }
            // 아바타 정지 및 언마운트
            if (avatarRef.current) {
              avatarRef.current.stop();
            }
            setAvatarMounted(false);
            setIsAvatarReady(false);
            lastItemRef.current = null;
            voiceSessionActiveRef.current = false;
          }

          // 이벤트 시작 감지
          if (!wasRunningRef.current && data.isRunning) {
            console.log('[MainStage] Event started - mounting avatar');
            setAvatarMounted(true);
          }

          wasRunningRef.current = data.isRunning;
        }
      } catch (err) {
        console.error('[MainStage] Failed to fetch state:', err);
      }
    };

    if (isStageEntered) {
      console.log('[MainStage] Polling started');
      fetchState();
      const interval = setInterval(fetchState, 1000);
      return () => {
        console.log('[MainStage] Polling stopped');
        clearInterval(interval);
      }
    }
  }, [isStageEntered, isConnected, startSession, stopSession, isAvatarReady]); // updateSessionConfig dependency removed

  // System Instruction Syncing
  // 연결이 되거나, 아이템이 바뀌거나, 음성 세션이 활성화될 때마다 최신 프롬프트 전송
  const lastSentInstructionRef = useRef<string | null>(null);

  useEffect(() => {
    // 연결이 끊기면 sent ref 초기화 (재연결 시 다시 보내야 하므로)
    if (!isConnected) {
      lastSentInstructionRef.current = null;
      return;
    }

    if (!state?.voiceSessionActive || !currentItem || currentItem.type !== 'MC_TIME') {
      return;
    }

    const instruction = currentItem.systemInstruction || '';
    const script = currentItem.script || '';
    const mcName = state.settings?.mcName || '두에나';

    const fullInstruction = `
${instruction}

[현재 진행 중인 순서의 대본 및 정보]
${script}

[중요 규칙]
1. 당신의 이름은 "${mcName}"입니다.
2. 사용자가 "${mcName}"라고 이름을 부르거나, 명확히 당신에게 말을 걸 때만 대답하세요.
3. 이름이 불리지 않았거나 대답할 필요가 없으면 정확히 "<SILENCE>" 라고만 출력하고 침묵하세요.
4. **즉시 중단 명령**: "그만해", "멈춰", "됐어" 등의 명령에는 부연 설명 없이 즉시 **"네."** 라고만 답하고 침묵하세요.
5. **대본 우선 원칙**: 사용자의 질문이 위 [현재 진행 중인 순서의 대본 및 정보]와 관련이 있다면, **반드시 대본의 내용만을 사용하여** 답변하세요. (창작 금지)
6. **일반 지식 허용**: 단, 사용자가 **대본과 전혀 무관한 질문**(예: "두산에너빌리티가 뭐야?", "오늘 며칠이야?", "점심 메뉴 추천해줘")을 하면, 당신의 풍부한 지식을 활용하여 친절하고 구체적으로 답변해 주세요.
7. **판단 기준**: 질문이 행사/이벤트 내용과 조금이라도 겹치면 대본을 따르고, 완전히 동떨어진 내용일 때만 일반 지식을 사용하세요.
8. 말은 구어체로 자연스럽고 위트있게 하세요.
`;

    // 중복 전송 방지 (내용이 같으면 안 보냄)
    if (lastSentInstructionRef.current !== fullInstruction) {
      console.log('[MainStage] Sending updated system instruction to OpenAI');
      updateSessionConfig(fullInstruction);
      lastSentInstructionRef.current = fullInstruction;
    }

  }, [isConnected, state?.voiceSessionActive, currentItem, updateSessionConfig, state?.settings?.mcName]);

  // Debug logging for avatar mounting
  useEffect(() => {
    console.log('[MainStage] Avatar mount state changed:', { isStageEntered, avatarMounted });
  }, [isStageEntered, avatarMounted]);

  // Enter Stage 버튼 클릭 핸들러
  const handleEnterStage = () => {
    setIsStageEntered(true);
    // 전체 화면 모드 진입 시도
    try {
      document.documentElement.requestFullscreen?.();
    } catch (e) {
      console.log('[MainStage] Fullscreen not available');
    }
  };


  // 아바타 준비 완료 핸들러 (Memoized to prevent re-init)
  const handleAvatarReady = useCallback(() => {
    console.log('[MainStage] Avatar ready');
    setIsAvatarReady(true);
  }, []);

  // 아바타 에러 핸들러 (Memoized to prevent re-init)
  const handleAvatarError = useCallback((error: string) => {
    console.error('[MainStage] Avatar error:', error);
  }, []);

  // 세션 타입에 따른 화면
  const isMcTime = currentItem?.type === 'MC_TIME';
  const showAvatar = isStageEntered && state?.isRunning && isMcTime;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Enter Stage 오버레이 */}
      {!isStageEntered && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <button
            onClick={handleEnterStage}
            className="px-12 py-6 bg-white text-black text-2xl font-bold rounded-lg hover:bg-gray-200 transition-all transform hover:scale-105 shadow-2xl"
          >
            Enter Stage
          </button>
        </div>
      )}

      {/* 아바타 (이벤트 실행 중 + MC_TIME일 때만 표시) */}
      {isStageEntered && avatarMounted && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
          <HeyGenAvatar
            ref={avatarRef}
            avatarId={state?.settings?.avatarId}
            onReady={handleAvatarReady}
            onError={handleAvatarError}
            fullscreen={true}
          />
        </div>
      )}

      {/* SESSION일 때 검은 화면 (아바타 숨김) */}
      {isStageEntered && state?.isRunning && !isMcTime && (
        <div className="absolute inset-0 bg-black z-10" />
      )}

      {/* 대기 중 메시지 (이벤트 시작 전) */}
      {isStageEntered && !state?.isRunning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-4xl mb-4 animate-pulse">대기 중</div>
            <div className="text-gray-500 text-sm">운영자 콘솔에서 이벤트를 시작하세요</div>
          </div>
        </div>
      )}
    </div>
  );
}
