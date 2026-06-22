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

  // AI chat analysis
  const [analysis, setAnalysis] = useState<{
    faqs: Array<{ question: string; frequency: number; suggestedAnswer: string }>;
    painPoints: Array<{ topic: string; count: number; description: string }>;
    popularTopics: Array<{ topic: string; count: number }>;
    summary: string;
    conversationCount: number;
  } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Lead scoring
  const [leadScores, setLeadScores] = useState<Array<{
    conversationId: string;
    score: number;
    intent: 'hot' | 'warm' | 'cold';
    reasons: string[];
    suggestedAction: string;
    estimatedValue?: number;
  }>>([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [showLeads, setShowLeads] = useState(false);

  const handleLeadScore = async () => {
    if (!selectedSiteId) return;
    setLeadLoading(true);
    setShowLeads(true);
    try {
      const res = await fetch('/api/ai/lead-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const d = await res.json() as { scores?: typeof leadScores };
      setLeadScores(d.scores || []);
    } catch { setLeadScores([]); }
    setLeadLoading(false);
  };

  const handleAnalyze = async () => {
    if (!selectedSiteId) return;
    setAnalysisLoading(true);
    setShowAnalysis(true);
    try {
      const res = await fetch('/api/ai/chat-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const d = await res.json();
      setAnalysis(d.analysis ?? null);
    } catch { setAnalysis(null); }
    setAnalysisLoading(false);
  };

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

            {/* AI Analysis buttons */}
            {conversations.length > 0 && (
              <div className="mb-4 flex gap-2 flex-wrap">
                <button
                  onClick={handleAnalyze}
                  disabled={analysisLoading}
                  className="flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
                  {analysisLoading ? 'AI分析中...' : 'AI分析（FAQ・課題抽出）'}
                </button>
                <button
                  onClick={handleLeadScore}
                  disabled={leadLoading}
                  className="flex items-center gap-2 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  {leadLoading ? 'スコアリング中...' : 'リードスコア分析'}
                </button>
              </div>
            )}

            {/* AI Analysis results */}
            {showAnalysis && (
              <div className="bg-white border border-purple-200 rounded-2xl p-5 mb-6 shadow-sm">
                <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>
                  AIチャット分析レポート
                </h3>
                {analysisLoading ? (
                  <div className="text-sm text-gray-400 text-center py-8">AIが会話を分析中...</div>
                ) : analysis ? (
                  <div className="space-y-5">
                    <div className="text-xs text-gray-500 bg-purple-50 rounded-lg px-3 py-2">{analysis.summary}</div>

                    {/* FAQs */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 mb-2">よくある質問 Top {analysis.faqs.length}件</h4>
                      <div className="space-y-2">
                        {analysis.faqs.map((faq, i) => (
                          <div key={i} className="border border-gray-200 rounded-xl p-3">
                            <div className="flex items-start gap-2 mb-1.5">
                              <span className="text-[10px] font-bold text-purple-600 flex-shrink-0">{faq.frequency}件</span>
                              <div className="text-xs font-semibold text-gray-900">{faq.question}</div>
                            </div>
                            <div className="text-[10px] text-gray-500 leading-relaxed">{faq.suggestedAnswer}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pain points */}
                    {analysis.painPoints.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2">顧客の課題・悩み</h4>
                        <div className="space-y-2">
                          {analysis.painPoints.map((p, i) => (
                            <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-amber-700">{p.count}件</span>
                                <div className="text-xs font-semibold text-gray-900">{p.topic}</div>
                              </div>
                              <div className="text-[10px] text-gray-600">{p.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Popular topics */}
                    {analysis.popularTopics.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2">人気トピック</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.popularTopics.map((t, i) => (
                            <span key={i} className="text-xs bg-sky-50 border border-sky-200 text-sky-700 px-2.5 py-1 rounded-full">
                              {t.topic} <span className="font-bold">{t.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">分析に失敗しました。会話ログが少ない可能性があります。</div>
                )}
              </div>
            )}

            {/* Lead Scores */}
            {showLeads && (
              <div className="bg-white border border-amber-200 rounded-2xl p-5 mb-6 shadow-sm">
                <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  リードスコアリング（直近7日間）
                </h3>
                {leadLoading ? (
                  <div className="text-sm text-gray-400 text-center py-8">AIがリードを分析中...</div>
                ) : leadScores.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">スコアリング対象の会話がありません</div>
                ) : (
                  <div className="space-y-3">
                    {leadScores.map((lead, i) => (
                      <div key={i} className={`border rounded-xl p-3 ${lead.intent === 'hot' ? 'border-red-200 bg-red-50' : lead.intent === 'warm' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${lead.intent === 'hot' ? 'bg-red-500 text-white' : lead.intent === 'warm' ? 'bg-amber-500 text-white' : 'bg-gray-400 text-white'}`}>
                            {lead.intent.toUpperCase()} {lead.score}点
                          </span>
                          {lead.estimatedValue && (
                            <span className="text-[10px] text-gray-500">見込み: ¥{lead.estimatedValue.toLocaleString()}</span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-gray-800 mb-1">{lead.suggestedAction}</div>
                        <div className="flex flex-wrap gap-1">
                          {lead.reasons.map((r, j) => (
                            <span key={j} className="text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{r}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
