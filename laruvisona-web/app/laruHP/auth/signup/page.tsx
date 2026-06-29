export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: '無料登録 | LARU HP',
  description: 'LARU HP に無料登録してAIでホームページを5分で作成。初月無料・月額999円。',
  openGraph: {
    title: '無料登録 | LARU HP',
    description: '初月無料・月額999円。AIが自動でプロ品質のHPを生成します。',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP/auth/signup',
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
