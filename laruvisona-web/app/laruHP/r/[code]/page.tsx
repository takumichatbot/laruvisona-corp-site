import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

// Referral landing: /laruHP/r/[code]
// Stores the referrer's user ID in a cookie, then redirects to onboarding.
// The code is the first 8 chars of the referrer's user ID.

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Validate: find a user whose ID starts with the code
  const service = await createServiceClient();
  const { data: profiles } = await service
    .from('profiles')
    .select('id')
    .ilike('id', `${code}%`)
    .limit(1);

  if (!profiles?.length) {
    redirect('/laruHP/onboarding');
  }

  const referrerId = profiles[0].id;

  // Redirect to onboarding with referrer info in query string
  // The signup page will read this and store it
  redirect(`/laruHP/onboarding?ref=${referrerId}`);
}
