'use client';
import { useState, useRef } from 'react';
import { Mic, MicOff, X as XIcon, AlertCircle, Volume2 } from 'lucide-react';

interface Props {
  projectName: string;
  onDirective: (text: string) => void;
  onClose: () => void;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export default function RealtimeVoice({ projectName, onDirective, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState('');
  const [directive, setDirective] = useState('');
  const [playingAudio, setPlayingAudio] = useState(false);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // mimeType を強制せず、ブラウザに任せる（iOS は mp4、Chrome は webm を選ぶ）
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(); // チャンク分割しない — stop() で全データが一括 ondataavailable で来る
      setRecording(true);
    } catch {
      setError('マイクへのアクセスが拒否されました。設定 → Safari → マイクを確認してください。');
    }
  };

  const stopAndProcess = async () => {
    if (!mrRef.current || !recording) return;
    setRecording(false);
    setProcessing(true);

    const mr = mrRef.current;
    mrRef.current = null;

    // stop() 後に最終 ondataavailable + onstop が発火するまで待つ
    await new Promise<void>(resolve => {
      mr.onstop = () => resolve();
      mr.stop();
    });
    mr.stream.getTracks().forEach(t => t.stop());

    const actualType = mr.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: actualType });

    if (blob.size < 200) {
      setError('録音データが空です。マイクの許可を確認するか、もう少し長く話してください。');
      setProcessing(false);
      return;
    }

    // ファイル名の拡張子を MIME タイプに合わせる
    const ext = actualType.includes('mp4') || actualType.includes('m4a') ? 'm4a'
      : actualType.includes('ogg') ? 'ogg'
      : 'webm';

    try {
      const fd = new FormData();
      fd.append('audio', blob, `recording.${ext}`);
      fd.append('projectName', projectName);
      fd.append('history', JSON.stringify(turns.slice(-6).map(t => ({ role: t.role, text: t.text }))));

      const resp = await fetch('/api/bridge/voice', { method: 'POST', body: fd });
      const data = await resp.json() as { transcript?: string; response?: string; directive?: string; audio?: string; error?: string };

      if (!resp.ok || data.error) throw new Error(data.error ?? '処理エラー');

      const newTurns: Turn[] = [];
      if (data.transcript) newTurns.push({ role: 'user', text: data.transcript });
      if (data.response)  newTurns.push({ role: 'assistant', text: data.response });
      setTurns(prev => [...prev, ...newTurns]);
      if (data.directive) setDirective(data.directive);

      // base64 audio → play
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = url;
        setPlayingAudio(true);
        audioRef.current.play().catch(() => {});
        audioRef.current.onended = () => { URL.revokeObjectURL(url); setPlayingAudio(false); };
      }

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理エラーが発生しました');
    }
    setProcessing(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    longPressRef.current = setTimeout(() => startRecording(), 50);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (recording) stopAndProcess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: 'rgba(8,8,18,0.99)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 0 80px rgba(99,102,241,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {playingAudio && <Volume2 size={13} className="text-indigo-400 animate-pulse" />}
            <p className="text-white font-bold text-sm">音声アシスタント</p>
            <span className="text-gray-600 text-[10px]">Whisper · Claude · TTS</span>
          </div>
          <button onClick={() => { audioRef.current?.pause(); onClose(); }}
            className="p-1 text-gray-600 active:opacity-70"><XIcon size={17} /></button>
        </div>

        {/* Conversation */}
        {turns.length > 0 && (
          <div className="px-4 pb-3 max-h-56 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'none' }}>
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                  style={t.role === 'user'
                    ? { background: 'rgba(99,102,241,0.18)', color: '#c4b5fd', border: '1px solid rgba(99,102,241,0.25)' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>
                  {t.text}
                </div>
              </div>
            ))}
            {processing && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                        style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Directive */}
        {directive && (
          <div className="px-4 mb-3">
            <button onClick={() => { onDirective(directive); onClose(); }}
              className="w-full py-3 rounded-xl text-xs font-bold text-white active:scale-95 transition-all text-left px-4"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 24px rgba(79,70,229,0.3)' }}>
              → AI Team に送信: {directive.slice(0, 50)}{directive.length > 50 ? '...' : ''}
            </button>
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center pb-6 pt-2 gap-3">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopAndProcess}
            onMouseLeave={() => { if (recording) stopAndProcess(); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            disabled={processing}
            className="w-20 h-20 rounded-full flex items-center justify-center select-none transition-all disabled:opacity-40"
            style={{
              background: recording
                ? 'radial-gradient(circle, #dc2626, #ef4444)'
                : 'radial-gradient(circle, #4f46e5, #7c3aed)',
              boxShadow: recording
                ? '0 0 0 8px rgba(220,38,38,0.15), 0 0 40px rgba(220,38,38,0.4)'
                : '0 0 0 0px transparent, 0 0 30px rgba(79,70,229,0.35)',
              transform: recording ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.15s ease',
            }}>
            {recording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
          </button>
          <p className="text-gray-600 text-[11px]">
            {recording ? '🔴 話しかけてください...' : processing ? '処理中...' : 'ボタンを押しながら話す'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:scaleY(0.6)} 40%{transform:scaleY(1)} }
      `}</style>
    </div>
  );
}
