export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'ログイン | LARU HP',
  description: 'LARU HP アカウントにログインしてサイトを管理します。月額999円・初月無料のAI搭載HPビルダー。',
  openGraph: {
    title: 'ログイン | LARU HP',
    description: '月額999円・初月無料。小さなお店のためのAI搭載HPビルダー。',
    images: ['/og-image.png'],
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
