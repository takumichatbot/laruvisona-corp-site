'use client';
/**
 * 会社サイトの共通ヘッダー。
 * ロゴは本番の公開資産（public/images/logo_dark.png）をそのまま使う。
 * 仮の文字表記は置かない。
 *
 * 上に固定するが、下の文字と重ならないよう、背景は下へスクロールしてから付ける。
 */
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SiteHeader() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header
      /* 文字色はここで明示する。共通の既定色（濃い墨）のままだと、
         暗いヘッダーの上でラベルが読めない */
      className={`fixed inset-x-0 top-0 z-40 text-slate-100 transition-colors duration-300
        ${solid
          ? 'bg-[#04080f]/85 backdrop-blur border-b border-white/10'
          : 'bg-[linear-gradient(180deg,rgba(4,8,15,.72),rgba(4,8,15,0))]'}`}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
        <Link href="/" aria-label="株式会社LaruVisona トップ" className="flex items-center shrink-0">
          <Image
            src="/images/logo_dark.png" alt="LaruVisona" width={1300} height={375} priority sizes="240px"
            data-brand-mark="" className="h-6 md:h-7 w-auto"
          />
        </Link>
        <nav aria-label="メイン" className="flex items-center gap-4 md:gap-6 text-[12px] md:text-[13px] font-bold">
          {/* 行き先は、実際にそのIDがある区画にする。
              「実物を見る」は説明ではなく、触れる方（#live-demo）へ直接案内する */}
          <a href="#live-demo" className="hidden sm:inline text-white/80 hover:text-white
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            実物を見る
          </a>
          <a href="#purpose" className="hidden sm:inline text-white/80 hover:text-white
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            事業・サービス
          </a>
          <a href="#company" className="hidden md:inline text-white/80 hover:text-white
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            会社について
          </a>
          <a href="#contact"
            className="inline-flex items-center min-h-[40px] px-4 rounded-full border border-white/40
              text-white hover:text-white hover:border-white
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            相談する
          </a>
        </nav>
      </div>
    </header>
  );
}
