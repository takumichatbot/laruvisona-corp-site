'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  session_id: string | null;
  messages: Message[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface Site {
  id: string;
  name: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

function firstUserMessage(messages: Message[]): string {
  const msg = messages.find(m => m.role === 'user');
  return msg ? msg.content.slice(0, 60) + (msg.content.length > 60 ? '…' : '') : '（メッセージなし）';
}

export default function LarubotLogsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/laruHP/auth/login'); return; }
      const res = await fetch('/api/sites');
      const data = await res.json();
      const s: Site[] = (data.sites || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }));
      setSites(s);
      if (s.length > 0) setSelectedSiteId(s[0].id);
      setLoading(false);
    })();
  }, []);

  const loadConversations = useCallback(async (siteId: string) => {
    setConvLoading(true);
    const res = await fetch(`/api/larubot/conversations?siteId=${siteId}`);
    const data = await res.json();
    setConversations(data.conversations || []);
    setConvLoading(false);
  }, []);

  useEffect(() => {
    if (selectedSiteId) loadConversations(selectedSiteId);
  }, [selectedSiteId, loadConversations]);

  const totalMessages = conversations.reduce((s, c) => s + c.messages.length, 0);
  const avgMessages = conversations.length > 0 ? (totalMessages / conversations.length).toFixed(1) : '0';
  const userMessages = conversations.reduce((s, c) => s + c.messages.filter(m => m.role === 'user').length, 0);

  return (
    <div className="min-h-screen bg-sky-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/laruHP/dashboard" className="text-gray-500 hover:text-gray-900 text-sm transition-colors">← ダッシュボード</Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 text-[9px] font-bold">LB</div>
            <h1 className="text-sm font-bold text-gray-900">LARUbot 会話ログ</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : sites.length === 0 ? (
          <div className="text-gray-500 text-sm">サイトがありません</div>
        ) : (
          <>
            {/* Site selector */}
            <div className="flex items-center gap-3 mb-6">
              <select
                value={selectedSiteId || ''}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-500"
              >
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Stats */}
            {!convLoading && conversations.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: '総会話数', value: conversations.length.toString(), unit: '件' },
                  { label: '平均ターン数', value: avgMessages, unit: '回' },
                  { label: 'ユーザー発言', value: userMessages.toString(), unit: '件' },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center shadow-sm">
                    <p className="text-xl font-bold text-indigo-600">{s.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{s.unit}</span></p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Conversations */}
            {convLoading ? (
              <div className="text-gray-500 text-sm py-8 text-center">読み込み中...</div>
            ) : conversations.length === 0 ? (
              <div className="py-16 text-center border border-gray-200 border-dashed rounded-xl bg-white">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-xl font-bold text-indigo-400">LB</div>
                <p className="text-gray-500 text-sm">まだ会話ログがありません</p>
                <p className="text-gray-400 text-xs mt-1">LARUbotがこのサイトに設置されると、会話が記録されます</p>
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left max-w-sm mx-auto">
                  <p className="text-xs font-semibold text-gray-700 mb-1">LARUbot側の設定</p>
                  <p className="text-[11px] text-gray-500">会話終了時に以下のエンドポイントへPOSTするよう設定してください：</p>
                  <code className="text-[10px] text-indigo-600 block mt-1 break-all">POST /api/larubot/conversations</code>
                  <code className="text-[10px] text-gray-500 block mt-0.5">x-laru-secret: {'$LARU_HP_API_SECRET'}</code>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map(conv => (
                  <div key={conv.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === conv.id ? null : conv.id)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-indigo-600">
                        {conv.messages.filter(m => m.role === 'user').length}回
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{conv.summary || firstUserMessage(conv.messages)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(conv.updated_at)} · {conv.messages.length}メッセージ</p>
                      </div>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-gray-400 flex-shrink-0 transition-transform ${expanded === conv.id ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {expanded === conv.id && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
                        {conv.messages.map((msg, i) => (
                          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-[8px] font-bold text-indigo-600 mt-0.5">LB</div>
                            )}
                            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-sky-600 text-white rounded-br-sm'
                                : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                            }`}>
                              {msg.content}
                            </div>
                            {msg.role === 'user' && (
                              <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0 text-[8px] text-sky-600 mt-0.5">U</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
