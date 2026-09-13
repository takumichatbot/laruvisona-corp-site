import type Stripe from "stripe";
import { appOrigin, hostnameOf } from "@/lib/public-site-url";

export type PaidAppointment = {
  id: string;
  site_id: string;
  status: string;
  payment_status: string;
  hold_until: string;
  service_name: string;
  price: number;
  email: string;
  revision: number;
  [key: string]: unknown;
};

export type BookingPayment = {
  appointment_id: string;
  site_id: string;
  account_id: string;
  livemode: boolean;
  session_id: string | null;
  intent_id: string | null;
  return_url: string | null;
  attempted_at: string | null;
  refund_started_at: string | null;
  refund_id: string | null;
};

export function bookingReturnUrl(
  origin: string | null,
  site: { slug: string; custom_domain?: string | null },
) {
  const base = new URL(appOrigin());
  const candidate = origin ? new URL(origin) : base;
  if (
    candidate.protocol !== "https:" ||
    candidate.username ||
    candidate.password ||
    candidate.port
  )
    throw Error("invalid_origin");
  const host = candidate.hostname.toLowerCase();
  const main = hostnameOf(base.host);
  if (host === main || host === `www.${main}`)
    return `${candidate.origin}/hp/${encodeURIComponent(site.slug)}/reserve`;
  if (
    host === site.custom_domain?.toLowerCase() ||
    host === `${site.slug.toLowerCase()}.${main}`
  )
    return `${candidate.origin}/reserve`;
  throw Error("invalid_origin");
}

export function validatePaymentSession(
  session: Stripe.Checkout.Session,
  payment: BookingPayment,
  appointment: PaidAppointment,
) {
  if (
    session.mode !== "payment" ||
    session.livemode !== payment.livemode ||
    session.currency !== "jpy" ||
    session.amount_total !== appointment.price ||
    session.metadata?.kind !== "hp_scheduling" ||
    session.metadata?.appointment_id !== appointment.id ||
    session.metadata?.site_id !== payment.site_id ||
    (payment.session_id && payment.session_id !== session.id)
  )
    throw Error("payment_mismatch");
}
