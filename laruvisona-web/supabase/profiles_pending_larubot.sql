-- LARUbot / LARUSEO の識別子を、サイトが出来るまで預かる場所。
--
-- いま起きていること（記事が0件になる本筋）:
--
--   料金ページから契約すると、Stripe の metadata の site_id は空文字になる
--   （app/api/stripe/checkout/route.ts）。まだサイトを作っていないのだから当然。
--   webhook はそれを渡すので、lib/larubot-provision.ts の linkLarubotIds は
--   「その人の全サイト」を探す経路に入り、**0件なので return して終わる。**
--
--   LARUbot 側の応答に入っていた public_id は、そこで**どこにも残らない。**
--   例外にもならず、ログも1行も出ない。画面は「契約済み」と出たまま。
--
--   その後サイトを作っても、識別子はもう無い。埋め込みタグが出ないので
--   ブログは1記事も出ない。あとから再登録する経路も無い。
--
--   「契約 → サイト作成」は標準の導線（料金ページからの契約後、
--   success_url はサイト未作成なら /dashboard に落ちる）。
--   つまり**普通に契約した人が、この道を通る。**
--
-- 実行方法: Supabase の SQL Editor にこのファイルの中身を貼って実行する。
--   （列が無いあいだも契約そのものは通る。アプリ側は預けられなかったことを
--     記録に残して先へ進む作りにしてある）

alter table public.profiles add column if not exists pending_larubot_public_id text;
alter table public.profiles add column if not exists pending_laruseo_public_id text;

comment on column public.profiles.pending_larubot_public_id is
  'サイトが出来る前に発行された LARUbot の public_id。最初のサイト作成時に移して空にする。';
comment on column public.profiles.pending_laruseo_public_id is
  'サイトが出来る前に発行された LARUSEO の public_id。最初のサイト作成時に移して空にする。';
