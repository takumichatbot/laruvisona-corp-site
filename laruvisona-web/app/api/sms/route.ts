import { NextResponse } from 'next/server';

// 旧APIはログイン済みであれば任意の電話番号と本文をTwilioへ送れていた。
// 宛先を予約台帳から決め、排他取得と事業者の冪等キーを持つSMSキューへ
// 移行するまで外部送信口を閉じる。
export async function POST() {
  return NextResponse.json(
    { error: 'SMS送信は現在利用できません' },
    { status: 410 },
  );
}
