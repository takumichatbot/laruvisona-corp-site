import { getSiteLimit } from './plan-limits';

/** Call with auth.getUser()'s email and server configuration, never request-body roles. */
export function siteCreationAccess(
  email: string | undefined,
  plan: string | null,
  status: string | null,
  adminConfiguration: Array<string | undefined>,
) {
  const admins = adminConfiguration.filter(Boolean).join(',').split(',')
    .map(value => value.trim().toLowerCase()).filter(Boolean);
  // Same trusted allowlist as the existing publish route. Does not change billing records.
  const admin = !!email && admins.includes(email.trim().toLowerCase());
  return {
    allowed: admin || !!(plan && (!status || status === 'active' || status === 'trialing')),
    limit: getSiteLimit(admin ? 'agency' : plan),
  };
}
