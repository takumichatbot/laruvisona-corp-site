import type { Metadata } from "next";
import CompanyExperience from "@/components/immersive/CompanyExperience";
import BrandFonts from "@/components/BrandFonts";

export const metadata: Metadata = {
  title: "株式会社LaruVisona | 創造を、実装する。",
  description:
    "オーダーメイドのWeb制作から、AI・業務システム、Webサービスの開発まで。LARU HP・LARUbot・LARUSEO・FLASTALの開発に取り組むLaruVisonaが、あなたの構想をともに形にします。",
  alternates: { canonical: "https://laruvisona.jp" },
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
