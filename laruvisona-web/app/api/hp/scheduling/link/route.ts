import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { canonicalBase, siteUrl } from "@/lib/public-site-url";
import { uuidPattern } from "@/lib/scheduling/config";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("siteId") || "";
  if (!uuidPattern.test(id))
    return new NextResponse("Not found", { status: 404 });
  const { data } = await createServiceClient()
    .from("sites")
    .select("slug,custom_domain")
    .eq("id", id)
    .eq("published", true)
    .single();
  if (!data?.slug) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(
    new URL(siteUrl(canonicalBase(data), "reserve")),
    307,
  );
}
