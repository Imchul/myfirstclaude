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
  const lastItemIdRef = useRef<string | null>(null);
  const voiceSessionActiveRef = useRef(false);
  const wasRunningRef = useRef(false);
  const [avatarMounted, setAvatarMounted] = useState(false);

  const handleTextResponse = useCallback((text: string) => {
    console.log('[MainStage] AI Response:', text);
    if (avatarRef.current && state?.audioEnabled) {
      avatarRef.current.speak(text);
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

          // 현재 아이템 변경 감지
          if (data.currentItem && data.currentItem.id !== lastItemIdRef.current) {
            lastItemIdRef.current = data.currentItem.id;
            setCurrentItem(data.currentItem);
            console.log('[MainStage] Item changed:', data.currentItem.title);

            // MC_TIME이고 음성 세션이 활성화되면 config 업데이트
            if (data.currentItem.type === 'MC_TIME' && data.voiceSessionActive && isConnected) {
              const instruction = data.currentItem.systemInstruction || '';
              const script = data.currentItem.script || '';
              const mcName = data.settings?.mcName || '두에나';

              const fullInstruction = `${instruction}\n\n참고 대본: ${script}\n\n당신의 이름은 "${mcName}"입니다. 공동사회자가 "${mcName}"라고 부를 때만 응답하세요.`;
              updateSessionConfig(fullInstruction);
            }
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
            lastItemIdRef.current = null;
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
      fetchState();
      const interval = setInterval(fetchState, 1000);
      return () => clearInterval(interval);
    }
  }, [isStageEntered, isConnected, startSession, stopSession, updateSessionConfig, isAvatarReady]);

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

  // 아바타 준비 완료 핸들러
  const handleAvatarReady = () => {
    console.log('[MainStage] Avatar ready');
    setIsAvatarReady(true);
  };

  // 아바타 에러 핸들러
  const handleAvatarError = (error: string) => {
    console.error('[MainStage] Avatar error:', error);
  };

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
