import ScheduleManager from "@/components/scheduling/ScheduleManager";
export const metadata = {
  title: "予約管理 | LARU HP",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ScheduleManager />;
}
