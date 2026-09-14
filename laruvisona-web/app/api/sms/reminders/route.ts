import { NextResponse } from 'next/server';

// 旧処理は複数インスタンスで同じ予約を同時に選択し、SMSを二重送信できた。
// 現在の予約リマインダーはDBで排他取得するメール経路へ統合済み。
export async function POST() {
  return NextResponse.json(
    { error: 'このSMSリマインダーは廃止されました' },
    { status: 410 },
  );
}
