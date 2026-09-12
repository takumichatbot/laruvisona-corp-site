'use client';
/**
 * 会社トップに置く実物のデモ。
 *
 * ここを挟んでいる理由はひとつ。**ページ全体の停止状態をデモへ渡すため**。
 * 渡さないと、「動きを止める」を押したあとに見せ方を選んだとき、
 * デモの中だけが分解・組立の動きをしてしまう。
 *
 * 他のページ（/laruHP）では今までどおり、デモが端末の設定だけを見て動く。
 */
import AssembleDemo from '@/components/lp/AssembleDemo';
import { useMotion } from './motion';

export default function LiveDemo() {
  const { paused } = useMotion();
  return <AssembleDemo startCta motionPaused={paused} />;
}
