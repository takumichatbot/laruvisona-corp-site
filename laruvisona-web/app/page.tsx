import type { Metadata } from "next";
import CompanyExperience from "@/components/immersive/CompanyExperience";
import BrandFonts from "@/components/BrandFonts";

export const metadata: Metadata = {
  title: "株式会社LaruVisona | 創造を、実装する。",
  // LARUSEO を独立した製品として並べない（LARUbotの機能のひとつ）。
  // 会社を探して来る人に、いちばん先に伝えるのは「自分で作って運用している」こと。
  description:
    "自社サービスLARU HP・LARUbotを企画から運用まで自社で行う会社です。その経験で、Web制作・AI・業務システム・サービス開発の受託も請けています。東京都板橋区。",
  alternates: { canonical: "https://laruvisona.jp/" },
  openGraph: {
    title: "株式会社LaruVisona | 創造を、実装する。",
    description:
      "自らサービスをつくる私たちが、あなたの事業も、ともにつくる。Web制作・AI・システム開発。",
    url: "https://laruvisona.jp",
  },
};

export default function Home() {
  return (
    <>
      <BrandFonts />
      <CompanyExperience />
    </>
  );
}
