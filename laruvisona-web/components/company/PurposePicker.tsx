'use client';
/**
 * 「何をしたいか」から、実例と説明へ入ってもらうところ。
 *
 *  ・選ばなくても、3つとも読める。選択は必須にしない。
 *  ・選んでも画面は動かさない（勝手なスクロールをしない）。開くだけ。
 *  ・入力を持っていないので、選び直しで消えるものが無い。
 */
import Link from 'next/link';
import { useId, useState } from 'react';

interface Purpose {
  id: string;
  label: string;
  lead: string;
  answer: string;
  body: string[];
  link: { label: string; href: string; external?: boolean };
  sub?: { label: string; href: string };
}

const PURPOSES: Purpose[] = [
  {
    id: 'shop',
    label: 'お店の魅力を伝えたい',
    lead: 'ホームページが無い。あっても古く、自分では直せない。',
    answer: 'LARU HP',
    body: [
      '4つの質問に答えると、写真も文章も入ったたたき台ができます。出来上がった画面を見ながら直して、そのまま公開できます。',
      '公開したあとも同じ画面から自分で直せます。予約・問い合わせフォーム、独自ドメイン、SSLを含みます。月額999円（税別）から。',
    ],
    link: { label: 'LARU HP を見る', href: '/laruHP' },
    sub: { label: 'この上の実例を、もう一度さわる', href: '#live' },
  },
  {
    id: 'inquiry',
    label: '問い合わせに応えたい',
    lead: '同じ質問への返信で手が止まる。営業時間外の連絡を取りこぼす。',
    answer: 'LARUbot',
    body: [
      'サイトに置くAIチャットボットです。よくある質問に答え、人が答えるべきものだけを渡します。',
      '顧客管理・メール配信・Web予約・決済まで含む構成もあります。月額27,500円から。LARU HP のプランに含まれる Lite 版もあります。',
    ],
    link: { label: 'larubot.tokyo を見る', href: 'https://larubot.tokyo', external: true },
  },
  {
    id: 'work',
    label: '仕事を効率化したい',
    lead: '手作業が多い。既存のツールに、自分たちのやり方が合わない。',
    answer: 'システム開発',
    body: [
      'Webシステム・AIを使ったアプリケーションの受託開発です。まず困りごとを伺い、実現の仕方・費用・期間をお出しします。',
      '窓口と開発が分かれていません。聞いた人間がそのまま設計して作ります。相談の段階では費用はかかりません。',
    ],
    link: { label: '相談する', href: '#contact' },
  },
];

export default function PurposePicker() {
  const [open, setOpen] = useState<string>('');
  const base = useId();

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {PURPOSES.map(p => {
          const on = open === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-expanded={on}
              aria-controls={`${base}-${p.id}`}
              onClick={() => setOpen(on ? '' : p.id)}
              className={`min-h-[48px] px-5 rounded-full border text-[13px] md:text-[14px] font-bold transition-colors
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500
                ${on
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-600'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <ul className="space-y-4">
        {PURPOSES.map((p, i) => {
          const on = open === p.id;
          return (
            <li key={p.id} className="border-t border-slate-200 pt-5">
              <div className="grid md:grid-cols-[3rem_minmax(0,17rem)_minmax(0,1fr)] gap-x-6 gap-y-1.5 items-baseline">
                <span className="text-[13px] font-bold text-sky-700 tabular-nums">0{i + 1}</span>
                <span className="text-[15px] font-bold text-slate-900">{p.label}</span>
                <p className="text-[14px] leading-[1.95] text-slate-600">{p.lead}</p>
              </div>
              <div
                id={`${base}-${p.id}`}
                hidden={!on}
                className="md:pl-[calc(3rem+1.5rem)] mt-4 border-l-2 border-sky-200 pl-4 md:ml-0"
              >
                <p className="text-[12px] font-bold tracking-widest text-sky-700 mb-2">{p.answer}</p>
                {p.body.map(t => (
                  <p key={t} className="text-[14px] leading-[2] text-slate-700 mb-3 max-w-[44em]">{t}</p>
                ))}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {p.link.external ? (
                    <a href={p.link.href} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[48px] px-5 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-700">
                      {p.link.label}
                    </a>
                  ) : (
                    <Link href={p.link.href}
                      className="inline-flex items-center min-h-[48px] px-5 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-700">
                      {p.link.label}
                    </Link>
                  )}
                  {p.sub && (
                    <a href={p.sub.href} className="text-[13px] font-bold text-sky-700 hover:text-sky-900 min-h-[44px] inline-flex items-center">
                      {p.sub.label}
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-[12px] text-slate-500">選ばなくても、この下の説明はすべて読めます。</p>
    </div>
  );
}
