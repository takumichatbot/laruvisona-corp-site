import type { Metadata } from 'next';

// Bridge は社内ツール。親（/laruHP）のレイアウトが LARU HP 用の manifest を
// 指定しているので、ここで Bridge 自身のものに戻す。
//
// 経緯: 以前は /laruHP レイアウトが Bridge の manifest（/manifest.json）を
// 読んでおり、その結果 LARU HP の顧客がホーム画面に追加すると
// 「Bridge — AI Coding Assistant」というアイコンが並んでいた。
// 顧客向けを LARU HP のものに直したぶん、Bridge がインストールできなく
// なってしまうので、ここで明示的に上書きしている。
// Bridge の起動先（start_url: /laruHP/bridge）とプッシュ通知
// （BridgeClient の registerPush → /api/bridge/push）はどちらも
// このレイアウトとは独立して動くので影響しない。
export const metadata: Metadata = {
  manifest: '/manifest.json',
};

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
