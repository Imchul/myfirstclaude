# 구현 참조 코드 (Reference Code)

## 1. Frontend: WebRTC 연결 Hook (`useRealtimeSession.ts`)
import { useState, useRef, useEffect } from 'react';

export function useRealtimeSession() {
  const startSession = async () => {
    const tokenRes = await fetch('/api/session');
    const { client_secret } = await tokenRes.json();

    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel('oai-events');

    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    ms.getTracks().forEach((track) => pc.addTrack(track, ms));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const baseUrl = 'https://api.openai.com/v1/realtime';
    const sdpResponse = await fetch(`${baseUrl}?model=gpt-4o-realtime-preview-2024-12-17`, {
      method: 'POST', body: offer.sdp,
      headers: { Authorization: `Bearer ${client_secret.value}`, 'Content-Type': 'application/sdp' },
    });
    
    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  };
  return { startSession };
}

## 2. Frontend: HeyGen Avatar 컴포넌트 (`HeyGenAvatar.tsx`)
// **중요**: 방송용 Full Screen 스타일 및 Overlay 초기화 로직
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import StreamingAvatar, { StreamingEvents, TaskType } from '@heygen/streaming-avatar';

const HeyGenAvatar = forwardRef((props, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState("");

  useImperativeHandle(ref, () => ({
    speak(text: string) {
      avatarRef.current?.speak({ text, task_type: TaskType.REPEAT });
    },
    // 클릭 시 호출될 초기화 함수
    async init(avatarId: string) {
      if (avatarRef.current) return;
      setStatus("Initializing...");
      try {
        const tokenRes = await fetch('/api/getToken');
        const { data } = await tokenRes.json();
        
        const avatar = new StreamingAvatar({ token: data.token });
        avatarRef.current = avatar;
        
        avatar.on(StreamingEvents.STREAM_READY, (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.detail;
            videoRef.current.play().catch(console.error);
          }
          setIsInitialized(true); // 준비 완료 -> 오버레이 숨김
        });

        await avatar.createStartAvatar({ 
          quality: 'high',  // 방송용 고화질
          avatarName: avatarId 
        });
      } catch (e) {
        console.error(e);
        setStatus("Error");
      }
    }
  }));

  return (
    // 전체 화면을 꽉 채우는 컨테이너 (Clean Feed)
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-0">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover transition-opacity duration-1000 ${isInitialized ? 'opacity-100' : 'opacity-0'}`} 
      />
      {/* 상태 메시지 (준비 중일 때만 표시) */}
      {!isInitialized && status && (
         <div className="absolute z-10 text-white text-xl animate-pulse">{status}</div>
      )}
    </div>
  );
});
export default HeyGenAvatar;