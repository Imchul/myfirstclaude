import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import StreamingAvatar, { StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

// 사용 가능한 아바타 목록 (여성)
// - Anna_public, Rika_ProfessionalLook_public, Katya_ProfessionalLook_public
// - Marianne_ProfessionalLook_public, Alessandra_ProfessionalLook_public
// 사용 가능한 아바타 목록 (남성)
// - Wayne_20240711, Anthony_ProfessionalLook_public, Graham_ProfessionalLook_public
// - Pedro_ProfessionalLook_public, Thaddeus_ProfessionalLook_public

// 기본 아바타 ID (여성 - Angela in T-shirt)
const DEFAULT_AVATAR_ID = 'Angela-inTshirt-20220820';

// 전역 초기화 잠금 (StrictMode 이중 마운트 방지)
let globalInitLock = false;

export interface HeyGenAvatarRef {
  speak: (text: string) => void;
  stop: () => void;
}

interface HeyGenAvatarProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  fullscreen?: boolean;  // 전체화면 모드
}

const HeyGenAvatar = forwardRef<HeyGenAvatarRef, HeyGenAvatarProps>((props, ref) => {
  const { onReady, onError, fullscreen = false } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('아바타 초기화 중...');
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(false);
  const sessionStartedRef = useRef(false);  // 세션이 실제로 시작되었는지 추적

  useImperativeHandle(ref, () => ({
    speak(text: string) {
      if (avatarRef.current) {
        console.log('[HeyGen] Speaking:', text);
        avatarRef.current.speak({ text, taskType: TaskType.REPEAT });
      } else {
        console.warn('[HeyGen] Avatar not ready, cannot speak');
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
      globalInitLock = false;  // 잠금 해제
      setIsReady(false);
      setIsLoading(false);
      setError(null);
    }
  }));

  useEffect(() => {
    mountedRef.current = true;
    let sessionInitialized = false;

    async function init() {
      // StrictMode 이중 마운트 방지: 이미 초기화 중이면 무시
      if (globalInitLock) {
        console.log('[HeyGen] Init skipped: already initializing (StrictMode double-mount)');
        return;
      }
      globalInitLock = true;

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

        avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
          console.log('[HeyGen] Avatar started talking');
        });

        avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
          console.log('[HeyGen] Avatar stopped talking');
        });

        if (!mountedRef.current) return;

        setStatusMessage('아바타 세션 시작 중...');
        console.log('[HeyGen] Starting avatar with ID:', DEFAULT_AVATAR_ID);

        const sessionInfo = await avatar.createStartAvatar({
          quality: AvatarQuality.Low,
          avatarName: DEFAULT_AVATAR_ID,
        });

        console.log('[HeyGen] Avatar session started:', sessionInfo);
        sessionInitialized = true;
        sessionStartedRef.current = true;  // 세션이 실제로 시작됨

      } catch (err) {
        console.error('[HeyGen] Error:', err);
        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize avatar';
          // 400 Bad Request usually means invalid Avatar ID
          if (errorMessage.includes('400')) {
            setError(`아바타 ID 오류: "${DEFAULT_AVATAR_ID}"가 유효하지 않을 수 있습니다.`);
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
      } else {
        console.log('[HeyGen] Cleanup: No active session to stop');
      }
      avatarRef.current = null;
      sessionStartedRef.current = false;
      globalInitLock = false;  // 잠금 해제 (재시도 가능하도록)
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
