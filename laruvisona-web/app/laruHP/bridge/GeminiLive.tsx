'use client';
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Radio } from 'lucide-react';

interface Props {
  projectName: string;
  recentHistory: { role: string; content: string }[];
  onInstruction: (text: string) => void;
  onClose: () => void;
}

type Phase = 'idle' | 'recording' | 'processing' | 'done';

export default function GeminiLive({ projectName, recentHistory, onInstruction, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { timerRef.current && clearInterval(timerRef.current); }, []);

  const startRecording = async () => {
    setError('');
    setTranscript('');
    setInstruction('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); processAudio(); };
      mr.start();
      mediaRef.current = mr;
      setPhase('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setError('マイクへのアクセスが拒否されました');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop();
      timerRef.current && clearInterval(timerRef.current);
    }
    setPhase('processing');
  };

  const processAudio = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        // 文字起こし
        const res1 = await fetch('/api/bridge/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transcribe', audioBase64: base64, mimeType: 'audio/webm' }),
        });
        const d1 = await res1.json();
        if (d1.error) throw new Error(d1.error);
        setTranscript(d1.result);

        // コーディング指示に変換
        const res2 = await fetch('/api/bridge/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'live_intent', transcript: d1.result, projectName, recentHistory }),
        });
        const d2 = await res2.json();
        if (d2.error) throw new Error(d2.error);
        setInstruction(d2.result);
        setPhase('done');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '処理エラー');
        setPhase('idle');
      }
    };
    reader.readAsDataURL(blob);
  };

  const useInstruction = () => {
    onInstruction(instruction);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a0520 0%, #000 70%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-violet-400" />
          <span className="text-violet-400 font-semibold text-sm tracking-wide">Gemini Live</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <p className="text-gray-500 text-xs tracking-widest uppercase text-center">{projectName}</p>

        {/* Mic button */}
        <div className="relative">
          {phase === 'recording' && (
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(139,92,246,0.3)', transform: 'scale(1.5)' }} />
          )}
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={phase === 'recording' ? stopRecording : undefined}
            disabled={phase === 'processing'}
            className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: phase === 'recording'
                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                : 'rgba(139,92,246,0.15)',
              border: `2px solid ${phase === 'recording' ? 'rgba(167,139,250,0.6)' : 'rgba(139,92,246,0.3)'}`,
              boxShadow: phase === 'recording' ? '0 0 30px rgba(139,92,246,0.5)' : 'none',
            }}>
            {phase === 'processing'
              ? <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              : <Mic size={32} className={phase === 'recording' ? 'text-white' : 'text-violet-400'} />
            }
            {phase === 'recording' && <span className="text-white text-xs font-mono">{seconds}s</span>}
          </button>
        </div>

        <p className="text-gray-600 text-sm text-center">
          {phase === 'idle' && '押しながら話してください'}
          {phase === 'recording' && '話してください... 離すと処理します'}
          {phase === 'processing' && 'Geminiが処理中...'}
          {phase === 'done' && '指示が生成されました'}
        </p>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        {/* Results */}
        {phase === 'done' && (
          <div className="w-full space-y-3">
            {transcript && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-gray-600 text-xs mb-1 tracking-widest">音声認識</p>
                <p className="text-gray-300 text-sm">{transcript}</p>
              </div>
            )}
            <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <p className="text-violet-400 text-xs mb-2 tracking-widest">生成された指示</p>
              <p className="text-white text-sm leading-relaxed">{instruction}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPhase('idle')}
                className="flex-1 py-3 rounded-xl text-sm text-gray-400 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                やり直す
              </button>
              <button onClick={useInstruction}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
                この指示を使う
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ping {
          0% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
