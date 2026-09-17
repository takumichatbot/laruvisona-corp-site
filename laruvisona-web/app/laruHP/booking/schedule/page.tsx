import AppShell from "@/components/laruhp/AppShell";
import ScheduleManager from "@/components/scheduling/ScheduleManager";
export const metadata = {
  title: "予約管理 | LARU HP",
  robots: { index: false, follow: false },
};
/*
  道しるべ（AppShell）を着せる。

  サイドバーの「予約管理」が指しているのは、この画面。
  それなのにここだけ骨組みが無く、**開くとサイドバーが消えていた。**
  美容室にとって予約は一番よく開く所で、そこで道しるべが無くなる。
  戻る道はブラウザの戻るしかない。

  ログイン後で骨組みを着ていないのは、あとは制作スタジオ・ビルダー・
  スマホ編集の3つだけ。あれは全画面の編集画面なので、着せないのが正しい。
*/
export default function Page() {
  return (
    <AppShell title="予約管理">
      <ScheduleManager />
    </AppShell>
  );
}
