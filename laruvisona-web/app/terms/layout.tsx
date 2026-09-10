import BrandFonts from '@/components/BrandFonts';

// 会社サイトの画面。ここだけ会社のブランド書体を読み込む。
// 共通レイアウトには置かない（管理画面・顧客の公開ページには要らないため）。
export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BrandFonts />
      {children}
    </>
  );
}
