import { applyTemplateData, getTemplateForIndustry } from "@/lib/templates";
import { DESIGN_PRESETS } from "@/lib/site-design";
import { orderForGoal, type IntakeAnswers } from "@/lib/studio-schema";
import type { Block, Page, SEOSettings } from "@/types/laruHP";
import { composeIndustry } from '@/lib/studio-blueprints';
import { starterTemplate } from '@/lib/starter-template';

export const STARTER_EXAMPLES: Record<
  string,
  {
    name: string;
    area: string;
    audience: string;
    description: string;
    photo: string;
    goal: IntakeAnswers["goal"];
  }
> = {
  beauty: {
    name: "結い庵",
    area: "東京都国立市",
    audience: "朝の髪のお手入れを楽にしたい方",
    description: "一人ひとりの髪と向き合う、予約制のヘアサロン。",
    photo: "/salon/hero-1200.jpg",
    goal: "booking",
  },
  restaurant: {
    name: "喫茶 余白",
    area: "神奈川県鎌倉市",
    audience: "ゆっくりひと息つきたい方",
    description: "季節の味と、ゆっくり流れる時間を。",
    photo: "/studio/references/cafe-v1.webp",
    goal: "visit",
  },
  clinic: {
    name: "のぞみ整体院",
    area: "千葉県船橋市",
    audience: "毎日の体の使い方を見直したい方",
    description: "一人ひとりのお悩みを伺い、体と向き合う整体院です。",
    photo: "/studio/references/clinic-v1.webp",
    goal: "booking",
  },
  construction: {
    name: "暮らし設計室",
    area: "東京都世田谷区",
    audience: "自分らしい住まいを考えている方",
    description: "暮らしの話からはじめる、住まいづくり。",
    photo: "/company/concepts/architecture.webp",
    goal: "contact",
  },
  retail: {
    name: "日々のうつわ",
    area: "京都府京都市",
    audience: "日々の道具を大切に選びたい方",
    description: "いつもの食卓に、長く使いたい一品を。",
    photo: "/studio/references/tableware-v1.webp",
    goal: "buy",
  },

  dental: {
    name: "しろは歯科クリニック",
    area: "埼玉県さいたま市",
    audience: "痛くなる前に通いたい方",
    description: "説明をしてから始める、歯の治療とお手入れ。",
    photo: "/studio/references/clinic-v1.webp",
    goal: "booking",
  },
  legal: {
    name: "みなも法務事務所",
    area: "東京都千代田区",
    audience: "はじめて専門家に相談する方",
    description: "むずかしい話を、わかる言葉で。",
    photo: "/company/concepts/architecture.webp",
    goal: "contact",
  },
  education: {
    name: "こはる学習室",
    area: "神奈川県横浜市",
    audience: "勉強のしかたから見直したい方",
    description: "解き方より先に、つまずいた場所を見つけます。",
    photo: "/company/concepts/retreat.webp",
    goal: "contact",
  },
  fitness: {
    name: "スタジオ しるべ",
    area: "大阪府大阪市",
    audience: "運動を続けられなかった方",
    description: "続けられる量から、はじめる。",
    photo: "/company/concepts/retreat.webp",
    goal: "booking",
  },
  photo: {
    name: "写真室 ひなた",
    area: "福岡県福岡市",
    audience: "かしこまらない写真を残したい方",
    description: "その日の空気ごと、写しておく。",
    photo: "/company/concepts/ceramics.webp",
    goal: "contact",
  },
  pet: {
    name: "トリミング もこ",
    area: "愛知県名古屋市",
    audience: "はじめて預ける飼い主の方",
    description: "その子のペースに合わせて、整えます。",
    photo: "/company/concepts/retreat.webp",
    goal: "booking",
  },
  realestate: {
    name: "常盤台不動産",
    area: "東京都板橋区",
    audience: "この街で暮らしを探している方",
    description: "物件より先に、この街の話から。",
    photo: "/company/concepts/architecture.webp",
    goal: "contact",
  },
  hotel: {
    name: "旅宿 みなも",
    area: "長野県松本市",
    audience: "静かな時間を過ごしたい方",
    description: "何もしない一日を、ちゃんと過ごす宿。",
    photo: "/company/concepts/retreat.webp",
    goal: "booking",
  },
  wedding: {
    name: "リトルハウス",
    area: "神奈川県鎌倉市",
    audience: "小さな式を考えている方",
    description: "呼びたい人だけを呼ぶ、一日のかたち。",
    photo: "/company/concepts/ceramics.webp",
    goal: "contact",
  },
  accounting: {
    name: "さくら会計事務所",
    area: "東京都足立区",
    audience: "はじめて顧問をつける事業者の方",
    description: "数字の話を、経営の言葉にして返します。",
    photo: "/company/concepts/architecture.webp",
    goal: "contact",
  },
};
export const exampleFor = (industry: string) =>
  STARTER_EXAMPLES[industry] || {
    name: "あなたの屋号",
    area: "活動している地域",
    audience: "サービスを届けたい方",
    description: "大切にしていることを、あなたの言葉で。",
    photo: "/company/concepts/architecture.webp",
    goal: "contact" as const,
  };
const EMPTY: SEOSettings = {
  title: "",
  description: "",
  keywords: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
};

/** 選ぶ前の完成像と、選んだ後の編集内容は同じデータから作る。AIの生成処理ではない。 */
export function makeStarterSite(intake: IntakeAnswers, presetId: string) {
  const preset =
    DESIGN_PRESETS.find((p) => p.id === presetId) || DESIGN_PRESETS[0];
  const template = getTemplateForIndustry(intake.industry);
  let blocks: Block[] = template
    ? applyTemplateData(template, {
        name: intake.name || "店名を入力してください",
        address: intake.area,
        description: intake.description,
        catchphrase: "",
        phone: "",
        services: [],
        hours: [],
      })
    : [];
  blocks = starterTemplate(blocks, intake.description);
  if (!blocks.some((b) => b.type === "hero"))
    blocks.unshift({
      id: "start-hero",
      type: "hero",
      data: { heading: intake.name, subheading: intake.description },
    });
  const destinations: Record<
    IntakeAnswers["goal"],
    {
      type: Block["type"];
      text: string;
      link: string;
      data: Record<string, unknown>;
    }
  > = {
    booking: {
      type: "booking",
      text: "ご予約フォームへ",
      link: "#booking",
      data: {
        heading: "ご予約のご相談",
        subtext: "希望日時をお送りください。確認後にご連絡します。",
        bgColor: preset.design.bg,
        buttonColor: preset.design.accent,
      },
    },
    contact: {
      type: "contact",
      text: "相談する",
      link: "#contact",
      data: {
        heading: "お問い合わせ",
        subtext: "ご相談内容をお送りください。",
        fields: ["name", "email", "phone", "message"],
        buttonText: "送信する",
        bgColor: preset.design.bg,
        buttonColor: preset.design.accent,
      },
    },
    visit: {
      type: "two-col",
      text: "アクセスを見る",
      link: "#start-access",
      data: {
        col1Title: "アクセス",
        col1Text: intake.area || "住所を入力してください",
        col2Title: "営業時間",
        col2Text: "営業時間を入力してください",
      },
    },
    buy: {
      type: "services",
      text: "商品を見る",
      link: "#start-products",
      data: {
        heading: "商品について",
        items: [
          {
            title: "商品名を入力してください",
            description: "商品の特徴を入力してください",
            price: "",
          },
        ],
      },
    },
  };
  const target = destinations[intake.goal];
  if (!blocks.some((b) => b.type === target.type))
    blocks.push({
      id: "start-destination",
      type: target.type,
      data: target.data,
    });
  blocks = blocks.map((b, i) => ({
    ...b,
    id: `start-${i}-${b.type}`,
    data: { ...b.data },
  }));
  // 予約・連絡欄は生成側が固定アンカーを持つ。それ以外はブロックのIDへ向ける。
  const destination = blocks.find((b) => b.type === target.type)!;
  const link = target.link;
  if (["visit", "buy"].includes(intake.goal))
    destination.data = {
      ...destination.data,
      ...target.data,
      anchorId: link.slice(1),
    };
  const photo = exampleFor(intake.industry).photo;
  blocks = blocks.map((b) =>
    b.type === "hero"
      ? {
          ...b,
          data: {
            ...b.data,
            heading: intake.name || "店名を入力してください",
            subheading: [intake.area, intake.description]
              .filter(Boolean)
              .join("｜"),
            ctaText: target.text,
            ctaLink: link,
            bgImage: photo,
            bgImageWidth: intake.industry === "beauty" ? 1200 : ["restaurant","clinic","retail"].includes(intake.industry) ? 1448 : 1440,
            bgImageHeight: intake.industry === "beauty" ? 896 : ["restaurant","clinic","retail"].includes(intake.industry) ? 1086 : 960,
            bgImageAlt:
              "サンプル写真。公開前にご自身の写真へ差し替えてください。",
            bgColor: preset.design.bg,
            textColor: preset.design.ink,
          },
        }
      : b,
  );
  if (intake.audience.trim())
    blocks.splice(1, 0, {
      id: "start-audience",
      type: "paragraph",
      data: {
        text: `${intake.audience.trim()}へ。\n${intake.description}`,
        align: "center",
      },
    });
  blocks = composeIndustry(orderForGoal(blocks, intake.goal), intake.industry);
  const seo = {
    ...EMPTY,
    title: [intake.name, intake.area].filter(Boolean).join(" | "),
    description: intake.description.slice(0, 110),
  };
  const pages: Page[] = [
    { id: "page-main", name: "トップページ", path: "/", blocks, seo },
  ];
  return {
    name: intake.name || "無題のサイト",
    pages,
    settings: {
      colorScheme: "professional-blue",
      style: "clean",
      designStyle: preset.designStyle,
      fontFamily: preset.fontFamily,
      accentColor: preset.design.accent,
      heroLayout: "split" as const,
      headerStyle: "solid" as const,
      animLevel: "subtle" as const,
      larubot: false,
      laruseo: false,
      notifyEmail: "",
      gaTrackingId: "",
      customCss: "",
      design: { ...preset.design },
      designPreset: preset.id,
    },
  };
}
