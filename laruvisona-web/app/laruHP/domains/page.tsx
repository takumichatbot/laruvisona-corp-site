import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Globe2, Mail, ShieldCheck } from 'lucide-react';
import {
  DOMAIN_BILLING_NOTE,
  HAS_SPONSORED_DOMAIN_LINK,
  DOMAIN_OWNERSHIP_NOTE,
  DOMAIN_REGISTRARS,
} from '@/lib/domain-guidance';
import styles from './page.module.css';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  title: '独自ドメインの取得と接続 | LARU HP',
  description: 'ドメインを持っていない場合の取得方法と、取得済みドメインをLARU HPへ安全に接続する手順を案内します。',
  alternates: { canonical: 'https://laruhp.com/domains' },
  openGraph: {
    title: '独自ドメインの取得と接続 | LARU HP',
    description: '取得前でも取得済みでも、現在地に合わせて独自ドメインを接続できます。',
    url: 'https://laruhp.com/domains',
    siteName: 'LARU HP',
    type: 'website',
  },
};

export default function DomainsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="https://laruhp.com/" className={styles.brand} aria-label="LARU HP トップへ">
          <Image src="/laruhp_logo.png" alt="" width={32} height={32} priority />
          <span>LARU HP</span>
        </Link>
        <Link href="https://laruvisona.jp/laruHP/settings?tab=domain" className={styles.headerLink}>接続設定を開く</Link>
      </header>

      <main>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>独自ドメイン</p>
          <h1>あなたの名前で、<br />公開を続けられるように。</h1>
          <p>ドメインをまだ持っていなくても、すでに使っていても大丈夫です。所有者と更新方法を曖昧にせず、LARU HPへつなぎます。</p>
          <div className={styles.heroActions}>
            <a href="#new-domain" className={styles.primary}>まだ持っていない</a>
            <a href="#owned-domain" className={styles.secondary}>すでに持っている</a>
          </div>
        </section>

        <section className={styles.principles} aria-label="先に知っておくこと">
          <article><ShieldCheck aria-hidden="true" /><h2>名義はお客様自身に</h2><p>{DOMAIN_OWNERSHIP_NOTE}</p></article>
          <article><Globe2 aria-hidden="true" /><h2>LARU HPの月額とは別</h2><p>{DOMAIN_BILLING_NOTE}</p></article>
          <article><Mail aria-hidden="true" /><h2>利用中のメールを守る</h2><p>メールを使っている場合は、MXレコードとメール認証用TXTを削除せずに接続します。</p></article>
        </section>

        <section id="new-domain" className={styles.flow}>
          <div className={styles.flowLead}><p className={styles.step}>01</p><h2>まだ持っていない場合</h2><p>取得しなくても標準URLで公開できます。店名や会社名で覚えてもらいたい時に追加してください。</p></div>
          <ol className={styles.steps}>
            <li><span>1</span><div><h3>名前を決める</h3><p>短く、読み間違えにくい英数字を推奨します。wwwは別購入ではなく、同じドメインの一部です。</p></div></li>
            <li><span>2</span><div><h3>自分のアカウントで取得する</h3><p>自動更新を有効にし、更新忘れによる失効を防ぎます。サーバーとSSLはLARU HPに含まれるため追加契約は不要です。</p></div></li>
            <li><span>3</span><div><h3>LARU HPへ戻って接続する</h3><p>取得した文字列を入力すると、必要なDNSレコードをサイトごとに表示します。</p></div></li>
          </ol>
          <div className={styles.registrars}>
            <div>
              <h3>取得先を開く</h3>
              <p>{HAS_SPONSORED_DOMAIN_LINK ? '広告・紹介リンクを含みます。契約先と料金は利用者自身で選べます。' : '現在は各社の通常ページへの案内です。'} 価格は初年度だけでなく更新時も確認してください。</p>
            </div>
            <div className={styles.registrarLinks}>
              {DOMAIN_REGISTRARS.map(registrar => (
                <a key={registrar.id} href={registrar.url} target="_blank" rel={registrar.sponsored ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}>{registrar.name}<ExternalLink size={15} aria-hidden="true" /></a>
              ))}
            </div>
          </div>
        </section>

        <section id="owned-domain" className={styles.flow}>
          <div className={styles.flowLead}><p className={styles.step}>02</p><h2>すでに持っている場合</h2><p>登録事業者の移管は必要ありません。いまの契約を保ったまま、Webサイト向けDNSだけを変更します。</p></div>
          <ol className={styles.steps}>
            <li><span>1</span><div><h3>ドメインだけを入力</h3><p>https:// やページのパスを付けず、example.comのように入力します。</p></div></li>
            <li><span>2</span><div><h3>表示された値をDNSへ登録</h3><p>所有確認用TXTと、Webサイト用のAまたはCNAMEを登録します。画面の値はコピーできます。</p></div></li>
            <li><span>3</span><div><h3>接続を確認して公開</h3><p>所有確認、DNS、SSLの順に状態を確認します。apexとwwwの片方を主URLにし、もう片方は同じページへ転送できます。</p></div></li>
          </ol>
          <aside className={styles.mailWarning}><Mail aria-hidden="true" /><div><h3>独自ドメインのメールを利用中の方へ</h3><p>MX、SPF、DKIM、DMARCなどの既存レコードは消さないでください。不明な場合は変更前の画面を保存し、LARU HPへご相談ください。</p></div></aside>
        </section>

        <section className={styles.cta}>
          <p>サイトごとに、設定すべき値を表示します。</p>
          <h2>取得済みなら、そのまま接続へ。</h2>
          <Link href="https://laruvisona.jp/laruHP/settings?tab=domain">独自ドメイン設定を開く<ArrowRight size={18} aria-hidden="true" /></Link>
          <small>接続後も、ドメインの契約と更新は登録事業者で管理します。</small>
        </section>
      </main>
    </div>
  );
}
