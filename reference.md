# 구현 참조 코드 (Reference Code)

이 코드는 OpenAI Realtime(WebRTC)과 HeyGen Avatar 연동을 위한 검증된 로직입니다. 구현 시 이 구조를 반드시 따르세요.

## 1. Frontend: WebRTC 연결 Hook (`useRealtimeSession.ts` 참고)
```typescript
import { useState, useRef, useEffect } from 'react';

export function useRealtimeSession() {
  const startSession = async () => {
    // 1. 백엔드에서 Ephemeral Token 발급
    const tokenRes = await fetch('/api/session');
    const { client_secret } = await tokenRes.json();

    // 2. PeerConnection 생성 및 DataChannel 설정
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel('oai-events'); // 명령어 송수신용

    // 3. Audio Stream (마이크) 연결
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    ms.getTracks().forEach((track) => pc.addTrack(track, ms));

    // 4. SDP Offer/Answer 교환 (OpenAI 규격 준수)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const baseUrl = '[https://api.openai.com/v1/realtime](https://api.openai.com/v1/realtime)';
    const sdpResponse = await fetch(`${baseUrl}?model=gpt-4o-realtime-preview-2024-12-17`, {
      method: 'POST', body: offer.sdp,
      headers: { Authorization: `Bearer ${client_secret.value}`, 'Content-Type': 'application/sdp' },
    });
    
    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  };
  return { startSession };
}

## 2. Frontend: HeyGen Avatar 컴포넌트 (HeyGenAvatar.tsx 참고
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import StreamingAvatar, { StreamingEvents, TaskType } from '@heygen/streaming-avatar';

const HeyGenAvatar = forwardRef((props, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);

  useImperativeHandle(ref, () => ({
    speak(text: string) {
      avatarRef.current?.speak({ text, task_type: TaskType.REPEAT });
    }
  }));

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/getToken'); // 백엔드 Proxy 사용
      const { data } = await res.json();
      const avatar = new StreamingAvatar({ token: data.token });
      avatarRef.current = avatar;
      
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        // 전달받은 MediaStream을 video 태그에 연결
        if (videoRef.current) videoRef.current.srcObject = event.detail;
      });
      await avatar.createStartAvatar({ quality: 'low', avatarName: 'default' });
    }
    init();
    return () => avatarRef.current?.stopAvatar();
  }, []);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg" />;
});
export default HeyGenAvatar;

