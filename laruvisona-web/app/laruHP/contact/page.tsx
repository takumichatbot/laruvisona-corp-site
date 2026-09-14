import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock3, Mail, ShieldCheck } from 'lucide-react';
import styles from './page.module.css';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  title: 'お問い合わせ | LARU HP',
  description: 'LARU HPの制作、料金、公開、独自ドメインについてご相談いただけます。',
  alternates: { canonical: 'https://laruhp.com/contact' },
};

const FORM_URL = 'https://larubot.tokyo/f/d51f2628-df7a-4776-8e58-67c9a453957f';

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="https://laruhp.com/" aria-label="LARU HP トップへ">
          LARU<span>HP</span><i aria-hidden="true" />
        </Link>
        <Link className={styles.start} href="https://laruvisona.jp/laruHP/studio">
          作りはじめる<ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.kicker}><span />ご相談・お問い合わせ</p>
          <h1>まだ言葉になっていないことも、<br />ここから聞かせてください。</h1>
          <p className={styles.lead}>制作、料金、公開後の運用まで。今の状況に合わせて、一緒に整理します。</p>
          <div className={styles.notes} aria-label="お問い合わせの案内">
            <span><Clock3 aria-hidden="true" />通常2営業日以内に返信</span>
            <span><ShieldCheck aria-hidden="true" />暗号化して送信</span>
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby="form-title">
          <div className={styles.formHeading}>
            <div><p>入力フォーム</p><h2 id="form-title">ご相談内容を送る</h2></div>
            <span>必須項目をご入力ください</span>
          </div>
          <div className={styles.frame}>
            <iframe src={FORM_URL} title="LARU HP お問い合わせフォーム" loading="lazy" />
          </div>
          <div className={styles.fallback}>
            <Mail size={18} aria-hidden="true" />
            <p>フォームが表示されない場合は、<a href={FORM_URL} target="_blank" rel="noopener noreferrer">別画面で開く</a>か、<a href="mailto:info@laruvisona.jp">info@laruvisona.jp</a>へご連絡ください。</p>
          </div>
        </section>

        <Link className={styles.back} href="https://laruhp.com/"><ArrowLeft size={17} aria-hidden="true" />LARU HP トップへ戻る</Link>
      </main>
    </div>
  );
}
