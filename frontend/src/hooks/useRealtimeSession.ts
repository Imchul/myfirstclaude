import { useState, useRef, useCallback } from 'react';

interface UseRealtimeSessionReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  startSession: () => Promise<void>;
  stopSession: () => void;
  sendMessage: (message: string) => void;
  updateSessionConfig: (instructions: string) => void;
}

export function useRealtimeSession(
  onAudioOutput?: (audioData: ArrayBuffer) => void,
  onTextResponse?: (text: string) => void
): UseRealtimeSessionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const startSession = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Get ephemeral token from backend
      const tokenRes = await fetch('/api/session');
      if (!tokenRes.ok) {
        throw new Error('Failed to get session token');
      }
      const { client_secret } = await tokenRes.json();

      // 2. Create PeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. OpenAI 오디오 출력은 재생하지 않음 (HeyGen 아바타가 대신 말함)
      // 오디오 트랙은 받지만 재생하지 않음
      pc.ontrack = (event) => {
        console.log('[Realtime] Audio track received but not playing (HeyGen will speak instead)');
        // 오디오 재생하지 않음 - HeyGen 아바타가 텍스트를 받아서 말함
      };

      // 4. Create DataChannel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[Realtime] DataChannel opened');
        setIsConnected(true);
        setIsConnecting(false);
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Realtime] Event:', data.type);

          // 세션이 생성되면 text-only 모드로 설정
          if (data.type === 'session.created') {
            console.log('[Realtime] Session created, configuring text-only output...');
            const configEvent = {
              type: 'session.update',
              session: {
                modalities: ['text'], // 텍스트만 출력 (음성 생성 안 함)
                input_audio_transcription: { model: 'whisper-1' },
              },
            };
            dc.send(JSON.stringify(configEvent));
          }

          // 텍스트 응답을 받아서 HeyGen에 전달 (text-only 모드)
          if (data.type === 'response.text.done' && onTextResponse) {
            console.log('[Realtime] Text response:', data.text);
            onTextResponse(data.text);
          }

          // 기존 audio transcript도 fallback으로 처리
          if (data.type === 'response.audio_transcript.done' && onTextResponse) {
            console.log('[Realtime] Audio transcript (fallback):', data.transcript);
            onTextResponse(data.transcript);
          }
        } catch (e) {
          console.error('[Realtime] Failed to parse message:', e);
        }
      };

      dc.onerror = (err) => {
        console.error('[Realtime] DataChannel error:', err);
        setError('DataChannel error');
      };

      dc.onclose = () => {
        console.log('[Realtime] DataChannel closed');
        setIsConnected(false);
      };

      // 5. Get microphone access
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // 6. Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Send offer to OpenAI and get answer
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const sdpResponse = await fetch(
        `${baseUrl}?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret.value}`,
            'Content-Type': 'application/sdp',
          },
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI Realtime');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (err) {
      console.error('[Realtime] Session start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [onTextResponse]);

  const stopSession = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.error('[Realtime] DataChannel not ready');
      return;
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }],
      },
    };

    dcRef.current.send(JSON.stringify(event));
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  const updateSessionConfig = useCallback((instructions: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.error('[Realtime] DataChannel not ready');
      return;
    }

    const event = {
      type: 'session.update',
      session: {
        instructions,
        modalities: ['text'], // 텍스트만 출력 (음성 생성 안 함)
        input_audio_transcription: { model: 'whisper-1' },
      },
    };

    dcRef.current.send(JSON.stringify(event));
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    startSession,
    stopSession,
    sendMessage,
    updateSessionConfig,
  };
}
