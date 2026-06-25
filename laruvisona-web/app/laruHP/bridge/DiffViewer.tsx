'use client';
import { X as XIcon, GitBranch } from 'lucide-react';

interface Props {
  stat: string;
  diff: string;
  onClose: () => void;
}

export default function DiffViewer({ stat, diff, onClose }: Props) {
  const lines = diff.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(12px)' }}>
      <div className="flex-1 flex flex-col mt-12 rounded-t-3xl overflow-hidden" style={{ background: '#F8F7F4' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #E8E3DC' }}>
          <div className="flex items-center gap-2">
            <GitBranch size={16} style={{ color: '#0EA5E9' }} />
            <p className="font-bold text-sm" style={{ color: '#1E293B' }}>変更内容</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#EDE8DC' }}>
            <XIcon size={15} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Stat summary */}
        <div className="px-4 py-3" style={{ background: '#E0F2FE', borderBottom: '1px solid #BAE6FD' }}>
          <pre className="text-xs font-mono" style={{ color: '#0369A1', whiteSpace: 'pre-wrap' }}>{stat}</pre>
        </div>

        {/* Full diff */}
        <div className="flex-1 overflow-y-auto px-1 py-2" style={{ scrollbarWidth: 'none' }}>
          {lines.map((line, i) => {
            const isAdd = line.startsWith('+') && !line.startsWith('+++');
            const isDel = line.startsWith('-') && !line.startsWith('---');
            const isHunk = line.startsWith('@@');
            const isFile = line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---');
            return (
              <div key={i} className="px-3 py-0.5 font-mono text-xs leading-relaxed"
                style={{
                  background: isAdd ? 'rgba(16,185,129,0.08)' : isDel ? 'rgba(239,68,68,0.08)' : isHunk ? 'rgba(14,165,233,0.06)' : isFile ? '#F5EFE6' : 'transparent',
                  color: isAdd ? '#065F46' : isDel ? '#991B1B' : isHunk ? '#0369A1' : isFile ? '#64748B' : '#1E293B',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
