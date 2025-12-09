import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import StreamingAvatar, { StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

// ============================================
// 스트리밍 전용 아바타 목록 (Interactive Streaming API)
// ============================================
// 주의: 비디오 생성용 아바타와 스트리밍 아바타는 다릅니다!
// 아래 목록은 /v1/streaming/avatar.list API로 확인된 스트리밍 전용 아바타입니다.
//
// [여성 아바타]
// - Rika_ProfessionalLook_public, Rika_CasualLook_public
// - Alessandra_ProfessionalLook_public, Alessandra_CasualLook_public
// - Anastasia_ProfessionalLook_public, Anastasia_CasualLook_public
// - Katya_ProfessionalLook_public, Katya_CasualLook_public
// - Marianne_ProfessionalLook_public, Marianne_CasualLook_public
// - Amina_ProfessionalLook_public, Amina_CasualLook_public
//
// [남성 아바타]
// - Wayne_20240711
// - Anthony_ProfessionalLook_public, Anthony_CasualLook_public
// - Graham_ProfessionalLook_public, Graham_CasualLook_public
// - Pedro_ProfessionalLook_public, Pedro_CasualLook_public
// - Thaddeus_ProfessionalLook_public, Thaddeus_CasualLook_public
// ============================================

// 기본 아바타 ID (여성 - Rika Professional Look)
const DEFAULT_AVATAR_ID = 'Alessandra_ProfessionalLook_public';

// 전역 초기화 잠금 (StrictMode 이중 마운트 방지)
let globalInitLock = false;
let globalInitTimestamp = 0;  // 마지막 초기화 시작 시간
const INIT_COOLDOWN_MS = 2000;  // 초기화 재시도 대기 시간 (2초)

export interface HeyGenAvatarRef {
  speak: (text: string) => void;
  interrupt: () => void;
  stop: () => void;
}

interface HeyGenAvatarProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  fullscreen?: boolean;  // 전체화면 모드
  avatarId?: string;
}

const HeyGenAvatar = forwardRef<HeyGenAvatarRef, HeyGenAvatarProps>((props, ref) => {
  const { onReady, onError, fullscreen = false, avatarId } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('아바타 초기화 중...');
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(false);
  const sessionStartedRef = useRef(false);  // 세션이 실제로 시작되었는지 추적
  const speakQueueRef = useRef<string[]>([]); // 말하기 큐
  const isAvatarSpeakingRef = useRef(false); // 말하기 상태 추적

  useImperativeHandle(ref, () => ({
    async speak(text: string) {
      if (avatarRef.current) {
        if (isAvatarSpeakingRef.current) {
          // 이미 말하고 있으면 큐에 추가
          console.log('[HeyGen] Avatar busy, queuing text:', text);
          speakQueueRef.current.push(text);
        } else {
          // 말하고 있지 않으면 즉시 실행
          console.log('[HeyGen] Speaking immediately:', text);
          isAvatarSpeakingRef.current = true;
          try {
            await avatarRef.current.speak({ text, task_type: TaskType.REPEAT });
          } catch (e) {
            console.error('[HeyGen] Speak failed:', e);
            isAvatarSpeakingRef.current = false;
          }
        }
      } else {
        console.warn('[HeyGen] Avatar not ready, cannot speak');
      }
    },
    async interrupt() {
      if (avatarRef.current && sessionStartedRef.current) {
        console.log('[HeyGen] Interrupting speech & clearing queue...');
        // 큐 비우기
        speakQueueRef.current = [];
        isAvatarSpeakingRef.current = false;
        try {
          await avatarRef.current.interrupt();
        } catch (e) {
          console.warn('[HeyGen] Interrupt failed:', e);
        }
      }
    },
    stop() {
      console.log('[HeyGen] Stop called from ref');
      // 세션이 시작된 경우에만 stopAvatar 호출
      if (avatarRef.current && sessionStartedRef.current) {
        try {
          avatarRef.current.stopAvatar();
        } catch (e) {
          console.log('[HeyGen] Stop ignored:', e);
        }
      }
      avatarRef.current = null;
      sessionStartedRef.current = false;
      globalInitLock = false;
      globalInitTimestamp = 0;  // 수동 정지 시 timestamp 리셋 (즉시 재시작 가능)
      setIsReady(false);
      setIsLoading(false);
      setError(null);
    }
  }));

  useEffect(() => {
    mountedRef.current = true;
    let sessionInitialized = false;

    async function init() {
      const now = Date.now();

      // StrictMode 이중 마운트 방지: 이미 초기화 중이거나 쿨다운 중이면 무시
      if (globalInitLock) {
        console.log('[HeyGen] Init skipped: already initializing');
        return;
      }

      // 최근에 초기화가 시작된 경우 (쿨다운 체크)
      if (now - globalInitTimestamp < INIT_COOLDOWN_MS) {
        console.log('[HeyGen] Init skipped: cooldown period (StrictMode double-mount protection)');
        return;
      }

      globalInitLock = true;
      globalInitTimestamp = now;

      try {
        setIsLoading(true);
        setError(null);
        setStatusMessage('토큰 가져오는 중...');
        console.log('[HeyGen] Initializing avatar...');

        // Get HeyGen token from backend
        const res = await fetch('/api/getToken');
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[HeyGen] Token fetch failed:', errorText);
          throw new Error('Failed to get HeyGen token');
        }

        if (!mountedRef.current) return;

        const responseData = await res.json();
        console.log('[HeyGen] Token response:', responseData);

        // Handle different response structures
        const token = responseData.data?.token || responseData.token;
        if (!token) {
          throw new Error('No token in response');
        }

        if (!mountedRef.current) return;

        setStatusMessage('아바타 인스턴스 생성 중...');
        console.log('[HeyGen] Creating StreamingAvatar instance...');
        const avatar = new StreamingAvatar({ token });

        // Save to ref immediately so cleanup can access it
        avatarRef.current = avatar;

        // STREAM_READY 이벤트
        avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
          console.log('[HeyGen] Stream ready! Event:', event);
          if (videoRef.current && mountedRef.current) {
            const stream = event.detail || event.stream || event;
            console.log('[HeyGen] Setting video srcObject:', stream);
            videoRef.current.srcObject = stream;

            // autoplay with muted (브라우저 정책)
            videoRef.current.muted = false;
            videoRef.current.play()
              .then(() => {
                console.log('[HeyGen] Video playback started');
                if (mountedRef.current) {
                  setIsLoading(false);
                  setIsReady(true);
                  onReady?.();
                }
              })
              .catch((playError) => {
                console.error('[HeyGen] Video play error:', playError);
                // muted로 다시 시도
                if (videoRef.current && mountedRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play()
                    .then(() => {
                      if (mountedRef.current) {
                        setIsLoading(false);
                        setIsReady(true);
                        onReady?.();
                      }
                    })
                    .catch(console.error);
                }
              });
          }
        });

        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          console.log('[HeyGen] Stream disconnected');
          if (mountedRef.current) {
            setError('Stream disconnected');
            onError?.('Stream disconnected');
          }
        });

        avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
          console.log('[HeyGen] Avatar started talking', e);
        });

        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
          console.log('[HeyGen] Avatar stopped talking', e);

          // 큐에 남은 문장이 있으면 계속 말하기
          if (speakQueueRef.current.length > 0) {
            const nextText = speakQueueRef.current.shift();
            if (nextText && avatarRef.current) {
              console.log('[HeyGen] Processing simple queue item:', nextText);
              avatarRef.current.speak({ text: nextText, task_type: TaskType.REPEAT }).catch(console.error);
            } else {
              isAvatarSpeakingRef.current = false;
            }
          } else {
            isAvatarSpeakingRef.current = false;
          }
        });

        if (!mountedRef.current) return;

        setStatusMessage('아바타 세션 시작 중...');
        const targetAvatarId = avatarId || DEFAULT_AVATAR_ID;
        console.log('[HeyGen] Starting avatar with ID:', targetAvatarId);

        const sessionInfo = await avatar.createStartAvatar({
          quality: AvatarQuality.Low,
          avatarName: targetAvatarId,
        });


        console.log('[HeyGen] Avatar session started:', sessionInfo);

        // Critical: Check if we remain mounted after async operation
        if (!mountedRef.current) {
          console.warn('[HeyGen] Component unmounted during session creation. Stopping zombie session...');
          await avatar.stopAvatar();
          return;
        }

        sessionInitialized = true;
        sessionStartedRef.current = true;  // 세션이 실제로 시작됨

      } catch (err) {
        console.error('[HeyGen] Error:', err);
        if (mountedRef.current) {
          let errorMessage = err instanceof Error ? err.message : 'Failed to initialize avatar';

          // Log more details if available
          if ((err as any).response) {
            console.error('[HeyGen] Error Details:', (err as any).response);
          }

          // 400 Bad Request usually means invalid Avatar ID
          if (errorMessage.includes('400')) {
            setError(`아바타 연결 실패 (400): ID가 유효하지 않거나 권한이 없습니다. (${DEFAULT_AVATAR_ID})`);
          } else {
            setError(errorMessage);
          }
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    }

    init();

    return () => {
      console.log('[HeyGen] Cleanup: Unmounting...');
      mountedRef.current = false;

      // 세션이 실제로 시작된 경우에만 stopAvatar 호출
      if (avatarRef.current && sessionStartedRef.current) {
        console.log('[HeyGen] Stopping avatar session (session was active)...');
        try {
          avatarRef.current.stopAvatar();
        } catch (e) {
          console.log('[HeyGen] Stop ignored:', e);
        }
        avatarRef.current = null;
        sessionStartedRef.current = false;
        // 세션이 완전히 정리된 후 lock 해제
        globalInitLock = false;
      } else {
        console.log('[HeyGen] Cleanup: No active session to stop (StrictMode unmount)');
        // StrictMode unmount의 경우 lock을 유지하고 timestamp로 쿨다운만 적용
        // globalInitLock은 해제하되, timestamp 덕분에 재초기화가 방지됨
        globalInitLock = false;
      }
    };
  }, [onReady, onError]);

  // 전체화면 모드일 때
  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
        {/* 로딩 중 */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-red-400 text-center p-4">
              <p className="text-2xl mb-2">아바타 연결 실패</p>
              <p className="text-lg">{error}</p>
            </div>
          </div>
        )}

        {/* 비디오 (전체화면) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-1000 ${isReady && !error ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
    );
  }

  // 일반 모드 (Operator Console 등에서 사용)
  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-red-400 text-center p-4">
            <p className="text-lg mb-2">아바타 연결 실패</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${isLoading || error ? 'hidden' : ''}`}
      />
    </div>
  );
});

HeyGenAvatar.displayName = 'HeyGenAvatar';

export default HeyGenAvatar;
