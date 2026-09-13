import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  decodeSlug,
  isHostForSite,
  canonicalBase,
} from "@/lib/public-site-url";
import PublicBooking from "@/components/scheduling/PublicBooking";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "ご予約",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function ReservePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = decodeSlug((await params).slug);
  const { data: site } = await createServiceClient()
    .from("sites")
    .select("id,name,slug,custom_domain")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!site || !isHostForSite(site, (await headers()).get("host"))) notFound();
  return (
    <PublicBooking
      siteId={site.id}
      name={site.name}
      home={canonicalBase(site)}
    />
  );
}
