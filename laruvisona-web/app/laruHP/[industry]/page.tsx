import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

// ─── Industry Data ─────────────────────────────────────────────────────────────
const INDUSTRY_DATA = {
  restaurant: {
    name: '飲食店・カフェ',
    emoji: '🍽',
    keyword: '飲食店・カフェ・レストラン',
    headline: '飲食店のホームページを、月額999円で。',
    sub: 'メニュー・営業時間・予約フォームが5分で完成。お客様がネット検索で見つけてくれるHPをAIが自動生成します。',
    accent: 'amber',
    heroGrad: 'from-orange-900 via-amber-900 to-orange-950',
    heroText: '気軽に、本格フレンチを。',
    heroSub: 'ランチ ¥1,500〜 / ディナー ¥4,800〜',
    navItems: ['メニュー','ランチ','ディナー','予約'],
    ctaBg: 'bg-amber-500',
    ctaText: 'ご予約はこちら',
    services: [{ icon: '🍴', label: 'メニュー掲載', desc: 'おすすめ料理・価格を見やすく' }, { icon: '📅', label: '予約フォーム', desc: '24時間ネット予約受付' }, { icon: '🗺', label: 'アクセス・地図', desc: 'Google Maps埋め込み' }],
    pains: [
      { q: '「Googleで検索されても上位に出ない」', a: '業種別JSON-LDスキーマとSEO最適化で、地域検索の上位表示を狙います。' },
      { q: '「食べログに依存していてHP費用が出ない」', a: '月額999円〜。食べログ広告費の数分の1でSEOが効く自社HPを持てます。' },
      { q: '「更新が面倒でメニューが古いまま」', a: 'ビジュアルエディタで非エンジニアでも1分で更新。スマホからも編集可能。' },
    ],
    seoTitle: '飲食店・カフェのホームページ作成 月額999円 | LARU HP',
    seoDesc: '飲食店・カフェ・レストランのホームページをAIが5分で自動生成。メニュー掲載・予約フォーム・SEO対応。月額999円、初月無料。',
  },
  beauty: {
    name: '美容室・サロン',
    emoji: '✂️',
    keyword: '美容室・ヘアサロン・エステ',
    headline: '美容室・サロンのHPを、月額999円で。',
    sub: '予約フォーム・メニュー表・スタッフ紹介・施術ギャラリーが5分で完成。Instagramと連携して集客力を高めます。',
    accent: 'rose',
    heroGrad: 'from-rose-800 via-pink-800 to-rose-950',
    heroText: '美しさを、もっと自由に。',
    heroSub: 'カット ¥4,400〜 / カラー ¥8,800〜',
    navItems: ['カット','カラー','パーマ','予約'],
    ctaBg: 'bg-rose-500',
    ctaText: '今すぐ予約する',
    services: [{ icon: '📸', label: 'ギャラリー掲載', desc: '施術写真をおしゃれに展示' }, { icon: '👩‍🎤', label: 'スタッフ紹介', desc: '指名予約につながるプロフィール' }, { icon: '🎁', label: 'クーポン設置', desc: '初回割引・リピーター特典' }],
    pains: [
      { q: '「ホットペッパーへの依存をやめたい」', a: '自社HPで予約を取れれば手数料ゼロ。月額999円で毎月節約できます。' },
      { q: '「インスタは頑張っているのにHPがない」', a: 'Instagramとセットで使う自社HPが最強。ネット検索からの新規客を獲得。' },
      { q: '「おしゃれなHPにお金をかけられない」', a: 'AIが業種特化の洗練されたデザインを自動生成。デザイン費用は0円。' },
    ],
    seoTitle: '美容室・サロンのホームページ作成 月額999円 | LARU HP',
    seoDesc: '美容室・ヘアサロン・エステのホームページをAIが5分で自動生成。予約フォーム・ギャラリー・スタッフ紹介対応。月額999円、初月無料。',
  },
  clinic: {
    name: '整体・接骨院・クリニック',
    emoji: '💆',
    keyword: '整体・接骨院・クリニック',
    headline: '整体・接骨院のHPを、月額999円で。',
    sub: '症状別メニュー・初回割引クーポン・Googleマップ連携が5分で完成。地域検索からの新規患者獲得に特化したHPです。',
    accent: 'emerald',
    heroGrad: 'from-emerald-700 via-teal-700 to-emerald-900',
    heroText: '痛みのない毎日を取り戻す。',
    heroSub: '整体・骨盤矯正・鍼灸 / 初回 ¥1,500',
    navItems: ['症状','施術','料金','予約'],
    ctaBg: 'bg-emerald-600',
    ctaText: '初回無料相談',
    services: [{ icon: '🩺', label: '症状別メニュー', desc: '肩こり・腰痛など検索されやすい構成' }, { icon: '⭐', label: '口コミ掲載', desc: 'Googleレビュー自動連携' }, { icon: '🕐', label: '営業時間・予約', desc: '当日予約もオンラインで完結' }],
    pains: [
      { q: '「地域検索で競合院に負けている」', a: '整体・接骨院向けのSEO構造化データで「〇〇市 整体」上位表示を狙います。' },
      { q: '「電話予約だと取りこぼしが多い」', a: '24時間受付のオンライン予約フォームで、夜間・休日の予約も逃しません。' },
      { q: '「HPの更新を院長がやる時間がない」', a: '1度設定すれば自動で最新情報を保持。更新は月1回5分もあれば十分。' },
    ],
    seoTitle: '整体・接骨院のホームページ作成 月額999円 | LARU HP',
    seoDesc: '整体・接骨院・クリニックのホームページをAIが5分で自動生成。症状別メニュー・予約フォーム・SEO対応。月額999円、初月無料。',
  },
  legal: {
    name: '士業・法律事務所・コンサル',
    emoji: '⚖️',
    keyword: '弁護士・司法書士・行政書士・コンサル',
    headline: '士業・法律事務所のHPを、月額999円で。',
    sub: '専門分野・弁護士プロフィール・無料相談フォームが5分で完成。信頼感が伝わるプロフェッショナルなデザインをAIが生成。',
    accent: 'slate',
    heroGrad: 'from-slate-800 to-slate-900',
    heroText: '難しい問題こそ、ご相談を。',
    heroSub: '遺産相続・企業法務・不動産 / 初回無料相談',
    navItems: ['業務案内','費用','弁護士','相談'],
    ctaBg: 'bg-yellow-600',
    ctaText: '無料相談を予約',
    services: [{ icon: '👨‍⚖️', label: '弁護士プロフィール', desc: '実績・専門分野を信頼感ある構成で' }, { icon: '📋', label: '業務案内', desc: '相続・企業法務など分野別に説明' }, { icon: '📩', label: '相談フォーム', desc: '秘密厳守の安心な問い合わせ窓口' }],
    pains: [
      { q: '「ホームページがなく、紹介以外の集客ができない」', a: 'SEO最適化で「〇〇市 弁護士」など地域検索から新規相談者を獲得。' },
      { q: '「WordPressは難しくて自分では更新できない」', a: 'ビジュアルエディタで直感的に更新。ITスキル不要でプロらしいHPを維持。' },
      { q: '「制作会社に頼むと数十万かかる」', a: '月額999円〜。初月無料で試せるので、投資リスクがほぼゼロです。' },
    ],
    seoTitle: '弁護士・士業のホームページ作成 月額999円 | LARU HP',
    seoDesc: '弁護士・司法書士・行政書士・コンサルのホームページをAIが5分で自動生成。無料相談フォーム・実績掲載対応。月額999円、初月無料。',
  },
  construction: {
    name: '建設・工務店・リフォーム',
    emoji: '🏗',
    keyword: '工務店・建設・リフォーム会社',
    headline: '工務店・建設会社のHPを、月額999円で。',
    sub: '施工事例ギャラリー・見積もり依頼フォーム・会社概要が5分で完成。地域の工事案件を自社HPで直接受注しましょう。',
    accent: 'amber',
    heroGrad: 'from-amber-800 via-yellow-800 to-amber-900',
    heroText: '地元の信頼と技術で、理想の住まいを。',
    heroSub: '新築・リフォーム・外構工事 / 見積もり無料',
    navItems: ['施工事例','サービス','料金','見積り'],
    ctaBg: 'bg-amber-600',
    ctaText: '無料見積もりを依頼',
    services: [{ icon: '🏠', label: '施工事例ギャラリー', desc: 'ビフォーアフター写真で実力を見せる' }, { icon: '📐', label: '見積もりフォーム', desc: '24時間受付で問い合わせを逃さない' }, { icon: '👷', label: '職人プロフィール', desc: '人柄が伝わる信頼のプロフィール' }],
    pains: [
      { q: '「チラシ配布だけでネット集客ができていない」', a: '「〇〇市 外壁塗装」などの地域キーワードで検索上位を狙います。' },
      { q: '「大手比較サイトに高額で掲載している」', a: '自社HPで直接問い合わせを受けると仲介手数料ゼロ。月999円で元が取れます。' },
      { q: '「施工写真があるのに見せる場所がない」', a: '施工事例ギャラリーブロックで写真を分かりやすく整理して掲載できます。' },
    ],
    seoTitle: '工務店・建設会社のホームページ作成 月額999円 | LARU HP',
    seoDesc: '工務店・建設会社・リフォーム業のホームページをAIが5分で自動生成。施工事例・見積もりフォーム対応。月額999円、初月無料。',
  },
  realestate: {
    name: '不動産会社',
    emoji: '🏢',
    keyword: '不動産会社・仲介・管理',
    headline: '不動産会社のHPを、月額999円で。',
    sub: '物件紹介・スタッフ紹介・問い合わせフォームが5分で完成。地域密着型の不動産会社がネット集客できるHPをAIが生成。',
    accent: 'emerald',
    heroGrad: 'from-emerald-800 via-green-800 to-emerald-900',
    heroText: '理想の住まい探しを、一緒に。',
    heroSub: '売買・賃貸・管理 / 地域密着25年',
    navItems: ['売買','賃貸','管理','相談'],
    ctaBg: 'bg-emerald-600',
    ctaText: '無料相談する',
    services: [{ icon: '🏠', label: '物件紹介', desc: 'おすすめ物件を見やすく掲載' }, { icon: '👔', label: 'スタッフ紹介', desc: '担当者の顔が見えて安心感アップ' }, { icon: '📊', label: '地域情報掲載', desc: '学校・商業施設など生活環境情報' }],
    pains: [
      { q: "「SUUMOやHOME'Sに掲載費が高い」", a: '自社HPでSEO集客。長期的に見ると大幅なコスト削減につながります。' },
      { q: '「営業エリアをネットで周知できていない」', a: '「〇〇市 不動産」などの地域キーワードでSEO上位表示を狙います。' },
      { q: '「信頼感のあるHPを安く作りたい」', a: 'AIが不動産会社らしいプロデザインを自動生成。デザイン費用は不要。' },
    ],
    seoTitle: '不動産会社のホームページ作成 月額999円 | LARU HP',
    seoDesc: '不動産会社・仲介業のホームページをAIが5分で自動生成。物件紹介・スタッフ紹介・問い合わせフォーム対応。月額999円、初月無料。',
  },
  retail: {
    name: '小売店・実店舗EC',
    emoji: '🛍',
    keyword: '小売店・実店舗・セレクトショップ',
    headline: '小売店・ショップのHPを、月額999円で。',
    sub: '商品紹介・店舗情報・オンライン問い合わせが5分で完成。実店舗への集客と商品認知を同時に高めるHPをAIが生成します。',
    accent: 'violet',
    heroGrad: 'from-violet-800 via-purple-800 to-violet-900',
    heroText: 'あなたの日常に、上質を。',
    heroSub: '厳選セレクト / 実店舗 & オンライン対応',
    navItems: ['商品','新着','セール','アクセス'],
    ctaBg: 'bg-violet-600',
    ctaText: 'お店を見る',
    services: [{ icon: '🛒', label: '商品カタログ', desc: 'おすすめ商品をビジュアルに展示' }, { icon: '📍', label: '店舗案内', desc: 'アクセス・駐車場・営業時間' }, { icon: '📣', label: 'セール告知', desc: 'LINEやInstagramへの誘導も' }],
    pains: [
      { q: '「Instagramだけでは購買に結びつかない」', a: '自社HPを集約点にすることでInstagramから購買・来店につなげます。' },
      { q: '「商品の魅力を伝えるページがない」', a: 'AIが商品説明・キャッチコピーを自動生成。写真を貼るだけで完成。' },
      { q: '「大手モールへの手数料が負担」', a: '自社HPから直接集客できれば手数料ゼロ。月額999円だけで済みます。' },
    ],
    seoTitle: '小売店・ショップのホームページ作成 月額999円 | LARU HP',
    seoDesc: '小売店・セレクトショップのホームページをAIが5分で自動生成。商品紹介・店舗案内・SNS連携対応。月額999円、初月無料。',
  },
  fitness: {
    name: 'フィットネス・ジム・ヨガ',
    emoji: '💪',
    keyword: 'フィットネス・ジム・ヨガスタジオ',
    headline: 'フィットネス・ジムのHPを、月額999円で。',
    sub: 'プログラム紹介・体験申し込み・スタッフ紹介が5分で完成。地域の新規会員獲得に強いHPをAIが自動生成します。',
    accent: 'red',
    heroGrad: 'from-red-800 via-orange-800 to-red-900',
    heroText: '限界を超える、一歩先へ。',
    heroSub: 'パーソナルトレーニング / 月額 ¥8,800〜',
    navItems: ['プログラム','料金','トレーナー','体験'],
    ctaBg: 'bg-red-500',
    ctaText: '無料体験を予約',
    services: [{ icon: '🏋️', label: 'プログラム紹介', desc: 'コース・料金を分かりやすく掲載' }, { icon: '🧑‍🏫', label: 'トレーナー紹介', desc: '資格・実績で信頼感をアップ' }, { icon: '🎯', label: '無料体験フォーム', desc: '来店を決める体験申込をWeb完結' }],
    pains: [
      { q: '「チラシ配りだけで集客限界を感じる」', a: '「〇〇市 パーソナルジム」など地域キーワードSEOで新規流入を獲得。' },
      { q: '「大手比較サイトに掲載費が高い」', a: '自社HPで直接体験予約を取れれば、比較サイトは不要になります。' },
      { q: '「会員のモチベーション管理に使うコンテンツがない」', a: 'ブログ・コンテンツ機能でトレーニング情報を発信しリピーター強化。' },
    ],
    seoTitle: 'フィットネス・ジムのホームページ作成 月額999円 | LARU HP',
    seoDesc: 'フィットネス・ジム・ヨガスタジオのホームページをAIが5分で自動生成。プログラム紹介・体験予約フォーム対応。月額999円、初月無料。',
  },
  hotel: {
    name: 'ホテル・旅館・民泊',
    emoji: '🏨',
    keyword: 'ホテル・旅館・ゲストハウス',
    headline: 'ホテル・旅館のHPを、月額999円で。',
    sub: '客室紹介・料金プラン・空室カレンダー・予約フォームが5分で完成。じゃらん・楽天旅行依存からの脱却を支援します。',
    accent: 'sky',
    heroGrad: 'from-sky-800 via-blue-800 to-sky-900',
    heroText: '非日常の、静かな時間を。',
    heroSub: '1泊2食付き ¥12,000〜 / 天然温泉完備',
    navItems: ['客室','プラン','温泉','予約'],
    ctaBg: 'bg-sky-600',
    ctaText: '空室を確認する',
    services: [{ icon: '🛏', label: '客室・施設紹介', desc: '写真ギャラリーで宿の魅力を全開放' }, { icon: '💰', label: 'プラン・料金表', desc: '季節・人数・食事プランを一覧で' }, { icon: '📅', label: '直接予約フォーム', desc: 'OTA手数料ゼロの自社予約を実現' }],
    pains: [
      { q: '「じゃらん・楽天に高い手数料を払い続けている」', a: '自社HPで直接予約を増やせばOTA手数料が削減。月999円で回収できます。' },
      { q: '「宿の雰囲気・魅力がうまく伝わらない」', a: 'AIが観光・旅行者の心に刺さるコピーとデザインを自動生成します。' },
      { q: '「SNSは運用しているがHPへの誘導ができない」', a: '自社HPをハブにしてSNS・OTA・Google検索からの流入を一元管理。' },
    ],
    seoTitle: 'ホテル・旅館のホームページ作成 月額999円 | LARU HP',
    seoDesc: 'ホテル・旅館・民泊のホームページをAIが5分で自動生成。客室紹介・プラン掲載・直接予約対応。月額999円、初月無料。',
  },
  education: {
    name: '教育・スクール・習い事',
    emoji: '📚',
    keyword: '学習塾・英会話・ピアノ教室・習い事スクール',
    headline: '教育・スクールのHPを、月額999円で。',
    sub: 'コース紹介・講師プロフィール・無料体験申し込みが5分で完成。地域の生徒募集に強いHPをAIが自動生成します。',
    accent: 'indigo',
    heroGrad: 'from-indigo-800 via-blue-800 to-indigo-900',
    heroText: 'あなたの可能性を、ここから広げる。',
    heroSub: '小学生〜社会人対応 / 無料体験レッスンあり',
    navItems: ['コース','講師','料金','体験'],
    ctaBg: 'bg-indigo-600',
    ctaText: '無料体験を申込む',
    services: [{ icon: '📖', label: 'コース・カリキュラム', desc: '対象年齢・目標別に分かりやすく' }, { icon: '👩‍🏫', label: '講師プロフィール', desc: '資格・実績で保護者の安心感を高める' }, { icon: '🎓', label: '合格・成果実績', desc: '卒業生の声・合格実績を掲載' }],
    pains: [
      { q: '「ポスティングだけでは新規生徒が集まらない」', a: '「〇〇市 英会話スクール」など地域検索で上位表示。Web集客を実現。' },
      { q: '「保護者に安心感を与えるコンテンツが作れない」', a: 'AIが講師紹介・合格実績・保護者の声など信頼要素を自動生成します。' },
      { q: '「他のスクールと差別化できていない」', a: 'オリジナルデザインと独自コンテンツで、地域での存在感を確立。' },
    ],
    seoTitle: '教育・スクールのホームページ作成 月額999円 | LARU HP',
    seoDesc: '学習塾・英会話・習い事スクールのホームページをAIが5分で自動生成。コース紹介・講師紹介・無料体験申込対応。月額999円、初月無料。',
  },
  wedding: {
    name: 'ウェディング・結婚式場',
    emoji: '💍',
    keyword: 'ウェディング・結婚式場・ブライダル',
    headline: 'ウェディング・式場のHPを、月額999円で。',
    sub: '式場ギャラリー・プラン紹介・見学予約フォームが5分で完成。カップルの心に響く、特別なブライダルHPをAIが生成。',
    accent: 'rose',
    heroGrad: 'from-rose-800 via-pink-700 to-rose-900',
    heroText: '二人だけの、特別な一日を。',
    heroSub: 'ゲスト50名〜 / ガーデンウェディング対応',
    navItems: ['式場','プラン','実例','見学'],
    ctaBg: 'bg-rose-500',
    ctaText: '見学を予約する',
    services: [{ icon: '💒', label: '式場ギャラリー', desc: '美しい会場写真でイメージを膨らませる' }, { icon: '💰', label: 'プラン・料金', desc: 'ゲスト数・スタイル別に分かりやすく' }, { icon: '💌', label: '見学フォーム', desc: '無料見学の予約をWeb完結で受付' }],
    pains: [
      { q: '「ゼクシィへの掲載費が高くて継続できない」', a: '自社HPでSEO集客。ゼクシィに頼らない直接集客の柱を作ります。' },
      { q: '「式場の雰囲気をネットで上手く伝えられない」', a: 'AIが感動的なコピーと写真ギャラリーで「ここで式を挙げたい」を演出。' },
      { q: '「口コミ・実例を見せられるページがない」', a: '先輩カップルの声・実例写真を掲載して成約率を高めます。' },
    ],
    seoTitle: 'ウェディング・結婚式場のHP作成 月額999円 | LARU HP',
    seoDesc: 'ウェディング・結婚式場・ブライダルのホームページをAIが5分で自動生成。式場ギャラリー・プラン掲載・見学予約対応。月額999円、初月無料。',
  },
  pet: {
    name: 'ペットサロン・動物病院',
    emoji: '🐾',
    keyword: 'ペットサロン・トリミング・動物病院',
    headline: 'ペットサロン・動物病院のHPを、月額999円で。',
    sub: 'トリミングメニュー・料金表・予約フォームが5分で完成。地域のペットオーナーが検索で見つけてくれるHPをAIが生成。',
    accent: 'amber',
    heroGrad: 'from-amber-700 via-stone-700 to-amber-900',
    heroText: '大切な家族を、愛情で包む。',
    heroSub: 'トリミング・シャンプー / 全犬種対応',
    navItems: ['メニュー','料金','スタッフ','予約'],
    ctaBg: 'bg-amber-500',
    ctaText: '予約する',
    services: [{ icon: '✂️', label: 'トリミングメニュー', desc: '犬種・サイズ別料金を分かりやすく' }, { icon: '🐕', label: 'スタッフ紹介', desc: 'トリマーの資格・得意犬種を掲載' }, { icon: '📅', label: 'オンライン予約', desc: '空き状況をリアルタイムで確認' }],
    pains: [
      { q: '「口コミサイトに頼っていて集客が不安定」', a: '自社HPでSEO集客。「〇〇区 トリミング」検索から安定的に新規客を獲得。' },
      { q: '「InstagramはあるのにHPへ誘導できない」', a: 'Instagramのリンクインバイオに自社HPを設置して予約・問い合わせを増加。' },
      { q: '「ペットの写真はたくさんあるが見せる場所がない」', a: 'ギャラリーブロックで施術後のかわいい写真を集客コンテンツとして活用。' },
    ],
    seoTitle: 'ペットサロン・動物病院のHP作成 月額999円 | LARU HP',
    seoDesc: 'ペットサロン・トリミング・動物病院のホームページをAIが5分で自動生成。メニュー・料金・予約フォーム対応。月額999円、初月無料。',
  },
  dental: {
    name: '歯科クリニック',
    emoji: '🦷',
    keyword: '歯科医院・歯医者・デンタルクリニック',
    headline: '歯科クリニックのHPを、月額999円で。',
    sub: '診療メニュー・医師紹介・Web予約フォームが5分で完成。「地域名 歯医者」検索で上位表示を狙えるSEO特化HPです。',
    accent: 'sky',
    heroGrad: 'from-sky-700 via-cyan-700 to-sky-900',
    heroText: '笑顔の源は、健康な歯から。',
    heroSub: '一般歯科・矯正・ホワイトニング / 初診受付中',
    navItems: ['診療案内','矯正','院長','予約'],
    ctaBg: 'bg-sky-600',
    ctaText: 'Web予約する',
    services: [{ icon: '🦷', label: '診療メニュー', desc: '一般歯科・審美・矯正を分かりやすく' }, { icon: '👨‍⚕️', label: '院長・医師紹介', desc: '専門資格・経歴で信頼感を高める' }, { icon: '🌐', label: 'Web予約', desc: '24時間いつでも予約受付' }],
    pains: [
      { q: '「競合クリニックが多く差別化できていない」', a: '審美歯科・矯正など専門性を前面に出して差別化。SEOで指名検索を獲得。' },
      { q: '「電話が混み合い予約取りこぼしが多い」', a: 'Web予約フォームで24時間受付。電話集中の問題を根本解決します。' },
      { q: '「患者さんに安心感を与えられていない」', a: 'AIが清潔感・信頼感あるデザインと医師紹介コンテンツを自動生成。' },
    ],
    seoTitle: '歯科クリニックのホームページ作成 月額999円 | LARU HP',
    seoDesc: '歯科医院・デンタルクリニックのホームページをAIが5分で自動生成。診療メニュー・Web予約・医師紹介対応。月額999円、初月無料。',
  },
  photo: {
    name: 'フォトスタジオ・カメラマン',
    emoji: '📷',
    keyword: 'フォトスタジオ・出張カメラマン・写真館',
    headline: 'フォトスタジオのHPを、月額999円で。',
    sub: 'ポートフォリオ・撮影プラン・予約フォームが5分で完成。写真の世界観を最大限に活かすHPをAIが自動生成します。',
    accent: 'stone',
    heroGrad: 'from-stone-700 via-gray-700 to-stone-900',
    heroText: '大切な瞬間を、永遠に。',
    heroSub: '七五三・成人式・婚前撮影 / 出張撮影対応',
    navItems: ['作品','プラン','カメラマン','予約'],
    ctaBg: 'bg-stone-700',
    ctaText: '撮影を予約する',
    services: [{ icon: '🖼', label: 'ポートフォリオ', desc: '作品ギャラリーで撮影スタイルを見せる' }, { icon: '💰', label: 'プラン・料金', desc: '撮影シーン別にわかりやすく掲載' }, { icon: '📆', label: '撮影予約フォーム', desc: '希望日時・シーンをWebで受付' }],
    pains: [
      { q: '「SNSで作品を見せているが予約につながらない」', a: '自社HPで予約フォームを設置すると、SNSからの流入を直接予約に転換。' },
      { q: '「写真の世界観を伝えるHPがない」', a: 'AIが写真を引き立てるミニマルで洗練されたデザインを自動生成します。' },
      { q: '「競合との差別化ポイントを伝えられない」', a: 'カメラマンプロフィール・受賞歴・機材情報で専門性をアピール。' },
    ],
    seoTitle: 'フォトスタジオ・カメラマンのHP作成 月額999円 | LARU HP',
    seoDesc: 'フォトスタジオ・出張カメラマンのホームページをAIが5分で自動生成。ポートフォリオ・撮影プラン・予約対応。月額999円、初月無料。',
  },
  accounting: {
    name: '税理士・会計士事務所',
    emoji: '📊',
    keyword: '税理士・会計士・確定申告・記帳代行',
    headline: '税理士・会計事務所のHPを、月額999円で。',
    sub: '業務案内・担当者紹介・無料相談フォームが5分で完成。確定申告・記帳代行の依頼を自社HPで受け付けましょう。',
    accent: 'blue',
    heroGrad: 'from-blue-800 via-slate-700 to-blue-900',
    heroText: '数字を、経営の力に変える。',
    heroSub: '税務顧問・確定申告・記帳代行 / 初回相談無料',
    navItems: ['業務案内','料金','スタッフ','相談'],
    ctaBg: 'bg-blue-600',
    ctaText: '無料相談を予約',
    services: [{ icon: '📋', label: '業務案内', desc: '税務申告・記帳代行など分かりやすく' }, { icon: '💼', label: '担当者紹介', desc: '税理士登録番号・専門分野を掲載' }, { icon: '🧮', label: '料金シミュレーター', desc: '規模別の目安料金を掲示' }],
    pains: [
      { q: '「紹介以外の新規顧問先が獲得できない」', a: '「〇〇市 税理士」「確定申告 代行 〇〇」などで検索上位を狙います。' },
      { q: '「HPがないため信頼性で競合に負けている」', a: 'プロフェッショナルなHPで第一印象を上げ、依頼率を高めます。' },
      { q: '「HPに払う費用対効果が見えない」', a: '月額999円〜。顧問1件取れれば数十倍の回収が可能です。' },
    ],
    seoTitle: '税理士・会計士のホームページ作成 月額999円 | LARU HP',
    seoDesc: '税理士・会計士事務所のホームページをAIが5分で自動生成。業務案内・担当者紹介・無料相談フォーム対応。月額999円、初月無料。',
  },
} as const;

type IndustryId = keyof typeof INDUSTRY_DATA;
const VALID_IDS = Object.keys(INDUSTRY_DATA) as IndustryId[];

// ─── Static generation ─────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return VALID_IDS.map(industry => ({ industry }));
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const d = INDUSTRY_DATA[industry as IndustryId];
  if (!d) return { title: 'LARU HP' };
  return {
    title: d.seoTitle,
    description: d.seoDesc,
    openGraph: { title: d.seoTitle, description: d.seoDesc },
  };
}

// ─── Accent color map ──────────────────────────────────────────────────────────
const ACCENT: Record<string, { bg: string; text: string; border: string; light: string; btn: string }> = {
  amber:  { bg: 'bg-amber-600',  text: 'text-amber-600',  border: 'border-amber-200', light: 'bg-amber-50',  btn: 'bg-amber-500 hover:bg-amber-400' },
  rose:   { bg: 'bg-rose-500',   text: 'text-rose-500',   border: 'border-rose-200',  light: 'bg-rose-50',   btn: 'bg-rose-500 hover:bg-rose-400' },
  emerald:{ bg: 'bg-emerald-600',text: 'text-emerald-600',border: 'border-emerald-200',light: 'bg-emerald-50',btn: 'bg-emerald-600 hover:bg-emerald-500' },
  slate:  { bg: 'bg-slate-700',  text: 'text-slate-700',  border: 'border-slate-200', light: 'bg-slate-50',  btn: 'bg-yellow-600 hover:bg-yellow-500' },
  sky:    { bg: 'bg-sky-600',    text: 'text-sky-600',    border: 'border-sky-200',   light: 'bg-sky-50',    btn: 'bg-sky-600 hover:bg-sky-500' },
  violet: { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-200',light: 'bg-violet-50', btn: 'bg-violet-600 hover:bg-violet-500' },
  red:    { bg: 'bg-red-500',    text: 'text-red-500',    border: 'border-red-200',   light: 'bg-red-50',    btn: 'bg-red-500 hover:bg-red-400' },
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-200',light: 'bg-indigo-50', btn: 'bg-indigo-600 hover:bg-indigo-500' },
  stone:  { bg: 'bg-stone-700',  text: 'text-stone-700',  border: 'border-stone-200', light: 'bg-stone-50',  btn: 'bg-stone-700 hover:bg-stone-600' },
  blue:   { bg: 'bg-blue-600',   text: 'text-blue-600',   border: 'border-blue-200',  light: 'bg-blue-50',   btn: 'bg-blue-600 hover:bg-blue-500' },
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function IndustryLP({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const d = INDUSTRY_DATA[industry as IndustryId];
  if (!d) notFound();

  const ac = ACCENT[d.accent] ?? ACCENT.sky;

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ─── Header ─── */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/laruHP" className="flex items-center gap-2">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={32} width={160} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/laruHP/auth/login" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg transition-all">
              ログイン
            </Link>
            <Link href={`/laruHP/onboarding?industry=${industry}`}
              className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
              初月無料で始める →
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 ${ac.light} ${ac.border} border px-4 py-2 rounded-full text-sm font-medium ${ac.text} mb-8`}>
            <span>{d.emoji}</span>
            <span>{d.keyword}向け</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight text-gray-900">
            {d.headline}
          </h1>
          <p className="text-gray-500 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            {d.sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href={`/laruHP/onboarding?industry=${industry}`}
              className={`${ac.btn} text-white font-bold px-10 py-4 rounded-2xl text-base transition-all shadow-lg`}>
              無料で始める（初月無料）→
            </Link>
            <Link href="/laruHP/builder"
              className="border border-gray-200 hover:border-sky-300 text-gray-600 hover:text-gray-900 font-medium px-10 py-4 rounded-2xl text-base transition-all">
              ▶ デモを体験する
            </Link>
          </div>
          <p className="text-gray-400 text-sm">初月無料 → 月額999円（税別）/ 最低6ヶ月 / クレジットカード決済</p>
        </div>
      </section>

      {/* ─── Site Preview Mock ─── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className={`text-sm font-medium ${ac.text}`}>完成イメージ</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-2 text-gray-900">こんなサイトが5分で作れます</h2>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-2xl">
            {/* Browser chrome */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-2 flex-shrink-0">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                <div className="w-3 h-3 bg-green-400 rounded-full" />
              </div>
              <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5 max-w-xs mx-auto">
                <span>🔒</span>
                <span>your-shop.laruvisona.com</span>
              </div>
            </div>
            {/* Site content */}
            <div>
              {/* Nav */}
              <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{d.emoji} {d.name}</span>
                <div className="hidden sm:flex gap-4">
                  {d.navItems.map(t => <span key={t} className="text-xs text-gray-500">{t}</span>)}
                </div>
                <span className={`text-xs ${ac.btn} text-white px-3 py-1 rounded-full font-medium`}>{d.ctaText}</span>
              </div>
              {/* Hero */}
              <div className={`bg-gradient-to-br ${d.heroGrad} px-8 py-10 text-white relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                <div className="relative max-w-lg">
                  <div className="text-xs text-white/60 mb-3 tracking-widest uppercase">{d.name}</div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-snug">{d.heroText}</h3>
                  <p className="text-sm text-white/70 mb-6">{d.heroSub}</p>
                  <span className={`inline-block text-sm ${ac.btn} text-white px-5 py-2.5 rounded-xl font-bold shadow-lg`}>
                    {d.ctaText} →
                  </span>
                </div>
              </div>
              {/* Services */}
              <div className="bg-white px-6 py-8">
                <div className="text-center mb-6">
                  <div className="text-xs text-gray-400 font-medium tracking-widest mb-2">サービス・特徴</div>
                  <div className="w-8 h-0.5 bg-gray-200 mx-auto" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {d.services.map(s => (
                    <div key={s.label} className={`${ac.light} ${ac.border} border rounded-xl p-4 text-center`}>
                      <div className="text-2xl mb-2">{s.icon}</div>
                      <div className={`text-xs font-bold ${ac.text} mb-1`}>{s.label}</div>
                      <div className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* CTA bar */}
              <div className={`bg-gradient-to-r ${d.heroGrad} px-6 py-5 flex items-center justify-between`}>
                <div className="text-white">
                  <div className="text-sm font-bold">{d.ctaText}</div>
                  <div className="text-xs text-white/60">お気軽にご連絡ください</div>
                </div>
                <span className="bg-white text-sm font-bold px-4 py-2 rounded-xl" style={{ color: '#1e293b' }}>
                  お問い合わせ →
                </span>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-400 text-xs mt-4">※ AIが業種・店舗情報から自動生成するイメージです</p>
        </div>
      </section>

      {/* ─── Pain points ─── */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sky-600 text-xs font-medium tracking-widest">こんなお悩みはありませんか？</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-3 text-gray-900">{d.name}オーナーの声</h2>
          </div>
          <div className="space-y-4">
            {d.pains.map((p, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100">
                  <span className="text-red-400 text-lg flex-shrink-0 mt-0.5">😟</span>
                  <p className="text-gray-700 font-medium text-sm">{p.q}</p>
                </div>
                <div className="flex items-start gap-4 px-6 py-5 bg-sky-50">
                  <span className={`text-lg flex-shrink-0 mt-0.5 ${ac.text}`}>✓</span>
                  <p className="text-gray-600 text-sm">{p.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-sky-600 text-xs font-medium tracking-widest">すべて込み</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-3 text-gray-900">LARU HPでできること</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: '🤖', title: 'AIコンテンツ自動生成', desc: '業種情報を入力するだけ。AIが見出し・説明文・CTAを自動で最適化。' },
              { icon: '✏️', title: 'ビジュアルエディタ', desc: 'ドラッグ＆ドロップで自由にレイアウト。HTMLの知識は一切不要。' },
              { icon: '📈', title: 'SEO自動最適化', desc: '業種別JSON-LD・メタタグ・モバイル対応を自動で設定。' },
              { icon: '📩', title: 'お問い合わせフォーム', desc: '送信即メール通知。LINEやWebhookへの転送も設定可能。' },
              { icon: '📊', title: 'アクセス解析ダッシュボード', desc: 'PV数・流入元をシンプルに確認。Googleアナリティクス連携も。' },
              { icon: '🌐', title: '独自ドメイン対応', desc: '取得済みのドメインを1クリックで設定。SSL証明書も自動。' },
            ].map(f => (
              <div key={f.title} className="flex gap-4 p-5 border border-gray-100 rounded-2xl hover:border-sky-200 hover:bg-sky-50 transition-all">
                <div className="text-2xl flex-shrink-0">{f.icon}</div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1 text-sm">{f.title}</div>
                  <div className="text-gray-500 text-sm">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-sky-600 text-xs font-medium tracking-widest">料金</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-3 mb-10 text-gray-900">シンプルな料金設定</h2>
          <div className="bg-white border-2 border-sky-200 rounded-3xl p-8 shadow-xl">
            <div className="text-xs font-medium text-sky-600 bg-sky-100 px-3 py-1 rounded-full inline-block mb-4">すべて込み</div>
            <div className="flex items-end justify-center gap-2 mb-2">
              <span className="text-5xl font-bold text-gray-900">¥999</span>
              <span className="text-gray-400 mb-2">/月（税別）</span>
            </div>
            <div className="text-sm text-emerald-600 font-semibold mb-6">🎉 初月無料キャンペーン中</div>
            <ul className="text-left space-y-2 mb-8">
              {['HP作成・公開（無制限ページ）','AIコンテンツ自動生成','ビジュアルエディタ','SEO自動最適化','お問い合わせフォーム','独自ドメイン対応','SSL・サーバー費用込み','Google Analytics連携'].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="text-emerald-500 font-bold flex-shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href={`/laruHP/onboarding?industry=${industry}`}
              className={`block w-full ${ac.btn} text-white font-bold py-4 rounded-2xl text-base transition-all shadow-md`}>
              初月無料で{d.name}のHPを作る →
            </Link>
            <p className="text-gray-400 text-xs mt-3">最低6ヶ月契約 / クレジットカード決済 / 解約はいつでも可能（7ヶ月目〜）</p>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className={`py-20 px-6 bg-gradient-to-br ${d.heroGrad}`}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            今すぐ{d.name}のHPを<br className="hidden sm:block" />無料で作ってみませんか？
          </h2>
          <p className="text-white/70 mb-8 text-base">初月無料・5分で完成・クレジットカード不要で試せます</p>
          <Link href={`/laruHP/onboarding?industry=${industry}`}
            className="inline-block bg-white text-gray-900 font-bold text-lg px-12 py-4 rounded-2xl hover:bg-gray-50 transition-all shadow-xl">
            無料で始める →
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Image src="/laruhp_logo.png" alt="LARU HP" height={24} width={160} className="h-6 w-auto brightness-0 invert" />
          </div>
          <div className="flex gap-4 flex-wrap">
            <Link href="/laruHP/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
            <Link href="/laruHP/terms" className="hover:text-white transition-colors">利用規約</Link>
            <Link href="/laruHP/tokusho" className="hover:text-white transition-colors">特定商取引法</Link>
            <Link href="/laruHP" className="hover:text-white transition-colors">トップ</Link>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-6 pt-6 border-t border-gray-800 text-xs text-center">
          © 2026 LARUvisona Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
