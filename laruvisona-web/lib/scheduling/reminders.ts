import { dateLabel } from './config';

export type BookingReminder = {
  reminder_id:string; claim_token:string; kind:'24h'|'2h'; site_id:string;
  appointment_id:string; appointment_revision:number; customer_name:string;
  customer_email:string; service_name:string; staff_name:string;
  starts_at:string; site_name:string;
};

export type LegacyBookingReminder = {
  reservation_id:string; claim_token:string; site_id:string; customer_name:string;
  customer_email:string; service_name:string; starts_at:string; site_name:string;
};

export function bookingReminderMessage(row:BookingReminder){
  const timing=row.kind==='24h'?'明日':'まもなく';
  const siteName=row.site_name.replace(/[\r\n\u0000-\u001f\u007f]+/g,' ').trim();
  return {
    subject:`【${timing}のご予約】${siteName}`,
    text:[
      `${row.customer_name} 様`,
      '',
      `${siteName}のご予約が${timing}となりました。`,
      `日時: ${dateLabel(row.starts_at)}`,
      `メニュー: ${row.service_name}`,
      `担当: ${row.staff_name}`,
      `予約番号: ${row.appointment_id}`,
      '',
      '変更・キャンセルは予約完了時にお渡しした確認リンクから行えます。',
      'リンクが分からない場合は、お店へ直接お問い合わせください。',
    ].join('\n'),
  };
}

export function legacyBookingReminderMessage(row:LegacyBookingReminder){
  const siteName=row.site_name.replace(/[\r\n\u0000-\u001f\u007f]+/g,' ').trim();
  return {
    subject:`【ご予約リマインダー】${siteName}`,
    text:[
      `${row.customer_name} 様`,'',`${siteName}のご予約が近づいています。`,
      `日時: ${dateLabel(row.starts_at)}`,
      ...(row.service_name?[`メニュー: ${row.service_name}`]:[]),
      `予約番号: ${row.reservation_id}`,'',
      '変更・キャンセルはお早めにお店へ直接お問い合わせください。',
    ].join('\n'),
  };
}
