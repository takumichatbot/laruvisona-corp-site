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
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300
        ${solid ? 'bg-[#04080f]/85 backdrop-blur border-b border-white/10' : 'bg-transparent'}`}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
        <Link href="/" aria-label="株式会社LaruVisona トップ" className="flex items-center shrink-0">
          <Image
            src="/images/logo_dark.png" alt="LaruVisona" width={1300} height={375} priority sizes="240px"
            data-brand-mark="" className="h-6 md:h-7 w-auto"
          />
        </Link>
        <nav aria-label="メイン" className="flex items-center gap-4 md:gap-6 text-[12px] md:text-[13px] font-bold">
          <a href="#live" className="hidden sm:inline text-white/70 hover:text-white">実物を見る</a>
          <a href="#products" className="hidden sm:inline text-white/70 hover:text-white">事業・サービス</a>
          <a href="#company" className="hidden md:inline text-white/70 hover:text-white">会社について</a>
          <a href="#contact"
            className="inline-flex items-center min-h-[40px] px-4 rounded-full border border-white/25 hover:border-white/60
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            相談する
          </a>
        </nav>
      </div>
    </header>
  );
}
