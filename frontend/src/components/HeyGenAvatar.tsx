import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import StreamingAvatar, { StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

// 사용 가능한 아바타 목록 (여성)
// - Anna_public, Rika_ProfessionalLook_public, Katya_ProfessionalLook_public
// - Marianne_ProfessionalLook_public, Alessandra_ProfessionalLook_public
// 사용 가능한 아바타 목록 (남성)
// - Wayne_20240711, Anthony_ProfessionalLook_public, Graham_ProfessionalLook_public
// - Pedro_ProfessionalLook_public, Thaddeus_ProfessionalLook_public

// 기본 아바타 ID (여성 전문적인 모습)
const DEFAULT_AVATAR_ID = 'Anna_public';

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
      if (avatarRef.current) {
        try {
          avatarRef.current.stopAvatar();
          avatarRef.current = null;
        } catch (e) {
          console.error('[HeyGen] Error stopping avatar:', e);
        }
      }
      setIsReady(false);
      setIsLoading(false);
      setError(null);
    }
  }));

  useEffect(() => {
    let mounted = true;

    async function init() {
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
        const responseData = await res.json();
        console.log('[HeyGen] Token response:', responseData);

        // Handle different response structures
        const token = responseData.data?.token || responseData.token;
        if (!token) {
          throw new Error('No token in response');
        }

        if (!mounted) return;

        setStatusMessage('아바타 인스턴스 생성 중...');
        console.log('[HeyGen] Creating StreamingAvatar instance...');
        const avatar = new StreamingAvatar({ token });
        avatarRef.current = avatar;

        // STREAM_READY 이벤트
        avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
          console.log('[HeyGen] Stream ready! Event:', event);
          if (videoRef.current && mounted) {
            const stream = event.detail || event.stream || event;
            console.log('[HeyGen] Setting video srcObject:', stream);
            videoRef.current.srcObject = stream;

            // autoplay with muted (브라우저 정책)
            videoRef.current.muted = false; // Main Stage에서 Enter 버튼 클릭 후이므로 소리 허용
            videoRef.current.play()
              .then(() => {
                console.log('[HeyGen] Video playback started');
                setIsLoading(false);
                setIsReady(true);
                onReady?.();
              })
              .catch((playError) => {
                console.error('[HeyGen] Video play error:', playError);
                // muted로 다시 시도
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play()
                    .then(() => {
                      setIsLoading(false);
                      setIsReady(true);
                      onReady?.();
                    })
                    .catch(console.error);
                }
              });
          }
        });

        avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
          console.log('[HeyGen] Stream disconnected');
          if (mounted) {
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

        setStatusMessage('아바타 세션 시작 중...');
        console.log('[HeyGen] Starting avatar with ID:', AVATAR_ID);

        const sessionInfo = await avatar.createStartAvatar({
          quality: AvatarQuality.Low,
          avatarName: AVATAR_ID,
        });

        console.log('[HeyGen] Avatar session started:', sessionInfo);

      } catch (err) {
        console.error('[HeyGen] Error:', err);
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize avatar';
          setError(errorMessage);
          setIsLoading(false);
          onError?.(errorMessage);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (avatarRef.current) {
        console.log('[HeyGen] Stopping avatar...');
        avatarRef.current.stopAvatar();
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
