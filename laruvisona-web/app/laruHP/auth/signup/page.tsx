export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: '無料登録 | LARU HP',
  description: 'LARU HP に無料登録し、完成像を見ながらホームページを制作。初月無料・月額999円から。',
  openGraph: {
    title: '無料登録 | LARU HP',
    description: '初月無料・月額999円から。写真と言葉を選び、完成像を見ながらホームページを制作できます。',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://laruvisona.jp/laruHP/auth/signup',
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
