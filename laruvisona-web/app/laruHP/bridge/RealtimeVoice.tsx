'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, AlertCircle } from 'lucide-react';

interface Props {
  projectName: string;
  onDirective: (text: string) => void;
  onClose: () => void;
}

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

export default function RealtimeVoice({ projectName, onDirective, onClose }: Props) {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [muted, setMuted] = useState(false);
  const [detectedDirective, setDetectedDirective] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up WebRTC resources without touching state
  const cleanup = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current = null; dcRef.current = null; streamRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setConnState('idle');
    setTranscript(''); setAiText('');
  }, [cleanup]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const connect = async () => {
    setConnState('connecting');
    setErrorMsg('');
    try {
      // 1. ephemeral token from server
      const sessionResp = await fetch('/api/bridge/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'realtime_session', projectName }),
      });
      const sessionData = await sessionResp.json();
      if (!sessionResp.ok || sessionData.error) {
        throw new Error(sessionData.error || `セッション取得失敗 (${sessionResp.status})`);
      }
      const ephemeralKey = sessionData.client_secret?.value;
      if (!ephemeralKey) throw new Error('ephemeral key が取得できませんでした');

      // 2. WebRTC setup
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio → <audio> element
      if (!audioElRef.current) audioElRef.current = new Audio();
      audioElRef.current.autoplay = true;
      pc.ontrack = e => { if (audioElRef.current) audioElRef.current.srcObject = e.streams[0]; };

      // Local mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));

      // Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setConnState('connected');
        // Enable server VAD + transcription
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            voice: 'shimmer',
            turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 700 },
          },
        }));
      };

      dc.onmessage = e => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'conversation.item.input_audio_transcription.completed') {
            setTranscript(ev.transcript || '');
          }
          if (ev.type === 'response.text.delta') {
            setAiText(prev => prev + (ev.delta || ''));
          }
          if (ev.type === 'response.text.done') {
            const full = ev.text || '';
            setAiText(full);
            const match = full.match(/AI Team に送信できます[：:]\s*(.+?)(?:\n|$)/);
            if (match) setDetectedDirective(match[1].trim());
          }
          if (ev.type === 'response.audio_transcript.done') {
            setAiText(ev.transcript || '');
          }
          if (ev.type === 'error') {
            setErrorMsg(ev.error?.message || 'Realtime API エラー');
          }
        } catch {}
      };

      // Don't reset to idle on data channel close if we're in error state
      dc.onclose = () => {
        setConnState(prev => prev === 'error' ? 'error' : 'idle');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setErrorMsg('WebRTC 接続失敗');
          setConnState('error');
          cleanup();
        }
      };

      // 3. SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });
      if (!sdpResp.ok) {
        const errText = await sdpResp.text();
        throw new Error(`SDP 交換失敗 (${sdpResp.status}): ${errText.slice(0, 120)}`);
      }
      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: 'answer' as RTCSdpType, sdp: answerSdp });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setConnState('error');
      cleanup(); // clean up refs but don't change state
    }
  };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(v => !v);
  };

  const sendDirective = () => {
    if (detectedDirective) { onDirective(detectedDirective); onClose(); }
  };

  const stateColor = { idle: '#4b5563', connecting: '#fbbf24', connected: '#34d399', error: '#f87171' }[connState];
  const stateLabel = { idle: 'タップして開始', connecting: '接続中...', connected: '通話中', error: 'エラー' }[connState];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      <div className="w-full max-w-sm rounded-3xl p-5 space-y-4"
        style={{ background: 'rgba(10,10,20,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(99,102,241,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: stateColor }} />
            <p className="text-white font-bold text-sm">音声アシスタント</p>
          </div>
          <button onClick={() => { disconnect(); onClose(); }} className="p-1 text-gray-600 active:opacity-70">
            <PhoneOff size={18} />
          </button>
        </div>

        {/* Visualizer */}
        <div className="flex items-center justify-center gap-1 h-16">
          {connState === 'connected' ? (
            Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="rounded-full w-1" style={{
                background: muted ? '#374151' : `hsl(${240 + i * 5}, 70%, 65%)`,
                height: `${8 + Math.abs(Math.sin(i * 0.8)) * 32}px`,
                animation: `wave ${0.6 + (i % 3) * 0.2}s ease-in-out ${i * 0.04}s infinite alternate`,
              }} />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center relative"
                style={{ background: connState === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)', border: `2px solid ${connState === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
                {connState === 'connecting'
                  ? <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  : connState === 'error'
                  ? <AlertCircle size={22} className="text-red-400" />
                  : <Mic size={22} className="text-indigo-400" />
                }
              </div>
              <p className="text-gray-500 text-xs">{stateLabel}</p>
            </div>
          )}
        </div>
        <style>{`@keyframes wave { from { opacity:0.4; transform:scaleY(0.7); } to { opacity:1; transform:scaleY(1); } }`}</style>

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-gray-500 text-[10px] mb-1">あなた</p>
            <p className="text-gray-300 text-xs leading-relaxed">{transcript}</p>
          </div>
        )}

        {/* AI response */}
        {aiText && (
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-indigo-400 text-[10px] mb-1">Bridge AI</p>
            <p className="text-indigo-200 text-xs leading-relaxed">{aiText}</p>
          </div>
        )}

        {/* Detected directive */}
        {detectedDirective && (
          <button onClick={sendDirective}
            className="w-full py-3 rounded-xl text-xs font-bold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 20px rgba(79,70,229,0.3)' }}>
            AI Team に送信: {detectedDirective.slice(0, 40)}{detectedDirective.length > 40 ? '...' : ''}
          </button>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {connState === 'idle' || connState === 'error' ? (
            <button onClick={connect}
              className="flex-1 py-3.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #059669, #0ea5e9)', boxShadow: '0 0 25px rgba(5,150,105,0.25)' }}>
              <Phone size={15} />{connState === 'error' ? '再接続' : '通話開始'}
            </button>
          ) : connState === 'connecting' ? (
            <div className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-sm">接続中...</span>
            </div>
          ) : (
            <>
              <button onClick={toggleMute}
                className="flex-1 py-3 rounded-xl font-semibold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{
                  background: muted ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
                  border: muted ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: muted ? '#fca5a5' : '#9ca3af',
                }}>
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
                {muted ? 'ミュート中' : 'マイク ON'}
              </button>
              <button onClick={disconnect}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-red-400 active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <PhoneOff size={14} />切断
              </button>
            </>
          )}
        </div>

        <p className="text-gray-700 text-[10px] text-center">OpenAI Realtime API · WebRTC · gpt-4o-realtime-preview</p>
      </div>
    </div>
  );
}
