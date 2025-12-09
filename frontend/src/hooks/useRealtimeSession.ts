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
  const textBufferRef = useRef('');

  // Callbacks via Refs to avoid stale closures in event listeners
  const onTextResponseRef = useRef(onTextResponse);
  onTextResponseRef.current = onTextResponse;

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

          // Log important events for debugging
          if (['input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped', 'response.created', 'response.done', 'error'].includes(data.type)) {
            console.log('[Realtime] debug:', data.type, data);
          }

          // 세션이 생성되면 text-only 모드로 설정
          if (data.type === 'session.created') {
            console.log('[Realtime] Session created, configuring text-only output...');
            const configEvent = {
              type: 'session.update',
              session: {
                modalities: ['text'], // 텍스트만 출력 (음성 생성 안 함)
                input_audio_transcription: { model: 'whisper-1' },
                turn_detection: { type: 'server_vad' },
              },
            };
            dc.send(JSON.stringify(configEvent));
          }

          // 텍스트 델타 스트리밍 (지연 시간 단축을 위한 문장 단위 처리)
          if (data.type === 'response.text.delta') {
            const delta = data.delta;
            if (delta && onTextResponseRef.current) {
              // 버퍼에 추가
              textBufferRef.current += delta;

              // 문장 종결 부호 확인 (. ! ? \n)
              // 정규식: 문장 끝 부호 뒤에 공백이나 문자열 끝이 올 때
              const sentenceMatch = textBufferRef.current.match(/([.!?\n]+)\s+/);
              if (sentenceMatch && sentenceMatch.index !== undefined) {
                const splitIndex = sentenceMatch.index + sentenceMatch[0].length;
                const sentence = textBufferRef.current.substring(0, splitIndex).trim();
                const remaining = textBufferRef.current.substring(splitIndex);

                if (sentence.length > 0) {
                  console.log('[Realtime] Streaming sentence:', sentence);
                  onTextResponseRef.current(sentence);
                }

                textBufferRef.current = remaining;
              }
            }
          }

          // 텍스트 응답 완료 (남은 버퍼 처리)
          if (data.type === 'response.text.done' && onTextResponseRef.current) {
            console.log('[Realtime] Response done, flushing buffer:', textBufferRef.current);
            if (textBufferRef.current.trim().length > 0) {
              onTextResponseRef.current(textBufferRef.current.trim());
            }
            textBufferRef.current = ''; // 버퍼 초기화
          }

          // 사용자 발화 시작 시 버퍼 초기화 (Interrupt)
          if (data.type === 'input_audio_buffer.speech_started') {
            console.log('[Realtime] User speech started, clearing buffer');
            textBufferRef.current = '';
          }

          // 기존 audio transcript fallback은 제거하거나 무시 (중복 방지)
          /*
          if (data.type === 'response.audio_transcript.done' && onTextResponseRef.current) {
             // 스트리밍 모드에서는 사용 안 함
          }
          */
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

      // 5. Get microphone access with strict constraints for noisy environment
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
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

      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      // 8. Session Update (VAD tuning for noisy events)
      const event = {
        type: 'session.update',
        session: {
          // instructions, // 초기 연결 시 기본 지시문 제거 (MainStage에서 별도 설정함)
          modalities: ['text', 'audio'], // IMPORTANT: 'audio' must be in modalities for voice
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.7, // 노이즈 환경 대비 민감도 낮춤 (0.5 -> 0.7)
            prefix_padding_ms: 300,
            silence_duration_ms: 1200 // 사용자가 말을 멈추고 1.2초 대기 후 응답 (2초 → 1.2초 단축)
          },
        },
      };

      if (dc.readyState === 'open') {
        dc.send(JSON.stringify(event));
      } else {
        dc.addEventListener('open', () => {
          console.log('[Realtime] DataChannel opened, sending session config');
          dc.send(JSON.stringify(event));
        });
      }

    } catch (err) {
      console.error('[Realtime] Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [onAudioOutput]);

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
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7, // 초기 설정과 동일하게
          prefix_padding_ms: 300,
          silence_duration_ms: 1200 // 사용자가 말을 멈추고 1.2초 대기 후 응답 (2초 → 1.2초 단축)
        },
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
