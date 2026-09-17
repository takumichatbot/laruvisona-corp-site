import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * 出荷係（deploy を担う仕組み）が、静かに止まらないこと。
 *
 * ここは製品のコードではなく、製品を本番へ運ぶ仕組みそのもの。
 * これが止まると**直したものが1つも世に出ない。**
 * それでいて、止まったことが誰にも分からなかった。
 *
 * ── 実際に起きたこと ──
 *
 * .git に HEAD.lock と index.lock が残った。すると
 *   1. bundle から refs/ship/main を取り込む git fetch が失敗する
 *   2. 失敗を見ずに先へ進み、**前回の refs/ship/main を出荷しようとする**
 *   3. それは既に上がっているので「すでに同じ内容が上がっています」と出る
 *   4. 終了コードは 0。通知も「完了」。ログも正常に見える
 * 出荷できていないのに、どこにも異常が出なかった。
 *
 * ── もう1つの静かな死に方 ──
 *
 * 見張りは _ship/.lock で二重起動を防ぐ。出荷の途中で落ちるとこの印が残り、
 * **以後の巡回はすべて「先客あり」で黙って帰る。** 永久に何も出荷されない。
 * 何も書かずに終わる作りだったので、ログにも1行も残らない。
 *
 * ── だから ──
 *
 * 走るたびに必ず脈（_ship/state/heartbeat）を書く。古ければ死んでいる。
 * ここにあるのは Mac 側で動いている本物の写し。
 * 本物が消えたら、ここから戻せる（docs/出荷係.md）。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const watch = () => read('scripts/ship/ship-watch.sh');
const ship = () => read('scripts/ship/ship.sh');

test('取り込みに失敗したら、そこで止める', () => {
  // ここを黙って通したので、古い ref を出荷しようとして
  // 「すでに同じ内容が上がっています」とだけ出ていた。
  const src = ship();
  assert.match(src, /if ! git fetch --quiet --force "\$b" "\$ref:\$tmp"; then/,
    'fetch の失敗を見ていない');
  assert.doesNotMatch(src, /^\s*git fetch --quiet --force "\$b" "\$ref:\$tmp"\s*$/m,
    '失敗を見ない fetch が残っている');
});

test('取り込んだ中身が bundle と違ったら、出荷しない', () => {
  const src = ship();
  assert.match(src, /if \[ "\$got" != "\$sha" \]; then/, '中身を照合していない');
  assert.match(src, /if ship_ref "\$sha" "\$br"; then/,
    'bundle の SHA ではなく、手元の ref を出荷対象にしている');
});

test('本番ブランチは、印のある bundle だけ通す', () => {
  // 見張りは人が見ていない時間に -y で走る。ここが緩むと取り違え1回で本番が飛ぶ。
  const src = ship();
  assert.match(src, /main\|master\|release\|production\)/, '本番ブランチを守っていない');
  assert.match(src, /\[ -f "\$b\.allow-main" \]/, '1本ごとの許可の印を見ていない');
});

test('早送りにならない push はしない', () => {
  const src = ship();
  assert.match(src, /git merge-base --is-ancestor "\$remote" "\$sha"/, '巻き戻しを許している');
});

test('走るたびに、脈を残す', () => {
  // これが無いと「止まっている」と「静かなだけ」が見分けられない。
  const src = watch();
  assert.match(src, /BEAT="\$STATE\/heartbeat"/, '脈の置き場が無い');
  assert.ok((src.match(/^\s*beat /gm) || []).length >= 4,
    '脈を書かずに終わる道が残っている');
});

test('脈は、見張られている場所の直下に書かない', () => {
  /*
    launchd は WatchPaths で _ship/ を見張っている。
    その直下に毎回書くと、**自分の書き込みで自分が起き続ける。**
    だから _ship/state/ の中へ、上書きで書く。
  */
  const src = watch();
  assert.match(src, /STATE="\$DROP\/state"/, '脈を _ship/ の直下に置いている');
  assert.match(src, /> "\$BEAT"/, '上書き以外の書き方をしている');
  assert.doesNotMatch(src, /mv [^\n]* "\$BEAT"/, 'mv で書くと _ship/state/ が動いてしまう');
  // 念のための歯止め: 何も待っていないのに1分以内に呼ばれたら引き下がる
  assert.match(src, /\[ "\$\(age "\$BEAT"\)" -lt 60 \]/, '呼ばれ続けたときの歯止めが無い');
});

test('落ちた出荷が残した印を、外す', () => {
  // これが残ると、以後の巡回はすべて黙って帰る。永久に何も出荷されない。
  const src = watch();
  assert.match(src, /LOCK_STALE_SEC=\d+/, '古い印を外す決まりが無い');
  assert.match(src, /rmdir "\$LOCK" 2>\/dev\/null \|\| rm -rf "\$LOCK"/, '外していない');
  // 黙って外さない。誰かが見たときに分かること
  assert.match(src, /落ちた跡とみなして外します/, '外したことを記録に残していない');
});

test('.git に残ったロックを、外す', () => {
  // これで実際に詰まった。
  const src = watch();
  assert.match(src, /GIT_LOCK_STALE_SEC=\d+/);
  assert.match(src, /-name '\*\.lock'/, 'gitのロックを見ていない');
});

test('GitHubへ届かなくなったことに、bundleを置く前に気づく', () => {
  // 鍵の期限切れは、置いてみるまで分からなかった。
  const src = watch();
  assert.match(src, /git ls-remote --heads origin main/, '届くかを確かめていない');
  assert.match(src, /REMOTE_EVERY_SEC=\d+/, '毎回叩きに行っている');
  assert.match(src, /notify "届きません"/, '届かないのに黙っている');
});

test('記録に、鍵らしきものを残さない', () => {
  // ログは人に見せる。URLに合言葉が埋まっていても、そのまま書かない。
  const src = watch();
  assert.match(src, /scrub\(\) \{ sed -E 's#\(https:\/\/\)\[\^@\/\[:space:\]\]\*@#\\1#g'; \}/,
    '取り除く処理が無い');
  assert.match(src, /printf '%s\\n' "\$out" \| scrub/, '出荷の記録を素通しで書いている');
});

test('出荷できないままの bundle を、放置で終わらせない', () => {
  const src = watch();
  assert.match(src, /failed_count/, '不調の数を見ていない');
  assert.match(src, /notify "未処理あり"/, '溜まっても黙っている');
});

test('数えるのに ls を使わない', () => {
  /*
    脈を付けた初回に、待ち0件なのに「待ち 16 件」と出た。
    nullglob を立てているので、1件も無いと glob が**消える**。
    残るのは引数なしの `ls` で、それは「いまいる場所」を並べる。
    脈そのものが嘘をつくと、直したつもりが何も直っていない。
  */
  const src = watch();
  assert.doesNotMatch(src, /ls "\$DROP"[^\n]*\| wc -l/, 'ls で数えている');
  assert.match(src, /count_bundles\(\) \{ local -a a=\("\$1"\/\*\.bundle\); printf '%s' "\$\{#a\[@\]\}"; \}/,
    '配列で数えていない');
  // nullglob は数える所より先に立っていること（立っていないと0件が1件に見える）
  const nullglobAt = src.indexOf('shopt -s nullglob');
  const countAt = src.indexOf('count_bundles()');
  assert.ok(nullglobAt > 0 && nullglobAt < countAt, 'nullglob が数える所より後にある');
});

test('ファイルの時刻を、どちらのOSでも同じに読む', () => {
  /*
    stat は BSD(mac) と GNU(Linux) で書式が違う。
    取り違えると数でないものを数として扱い、`set -u` で落ちる。
    実際、確認用のLinux側で全部の判定が壊れた。
  */
  const src = watch();
  assert.match(src, /date -r "\$1" '\+%s'/, 'stat の書式差に依存している');
  assert.doesNotMatch(src, /stat -f %m/, 'macでしか動かない読み方が残っている');
  // 読めなかったときは「できたて」に倒す。生きている .lock を壊さないため。
  assert.match(src, /case "\$m" in ''\|\*\[!0-9\]\*\) echo 0; return ;; esac/,
    '読めなかったときに壊す側へ倒している');
});

test('本番に出たかどうかまで、追いかける', () => {
  /*
    push が成功したのに本番が入れ替わらない状態が、**どこからも見えなかった。**
    出荷係は push までしか知らず、Vercel の画面を人が開くまで誰も気づけない。
    「出荷しました」と出ているのに古いまま、というのがいちばん困る。
  */
  const src = watch();
  assert.match(src, /HEALTH_URL="https:\/\/laruvisona\.jp\/api\/health"/, '本番を見に行っていない');
  assert.match(src, /\[ -n "\$shipped" \] && printf '%s' "\$shipped" > "\$EXPECT"/,
    '出荷したコミットを控えていない');
  assert.match(src, /"\$\{want:0:\$\{#live\}\}" = "\$live"/, '突き合わせていない');
  assert.match(src, /DEPLOY_WARN_SEC=\d+/, '待ち続けるだけで知らせない');
  assert.match(src, /notify "本番が古いままです"/, '入れ替わらなくても黙っている');
  // 出荷が無いときも見に行くこと（出荷の直後だけ見ても、遅れて入るぶんを取り逃がす）
  const idle = src.indexOf('if [ ${#bundles[@]} -eq 0 ]; then');
  assert.ok(idle > 0);
  assert.match(src.slice(idle, idle + 600), /check_deploy/, '待ちなしのときに見ていない');
});

test('本番が何を動かしているかを、本番自身が答える', () => {
  const route = read('app/api/health/route.ts');
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/, 'コミットを返していない');
  assert.match(route, /export const dynamic = 'force-dynamic'/, '固めて配ると古い答えを返す');
  assert.match(route, /'Cache-Control': 'no-store, private'/, '途中で保存されうる');
  // 鍵になるものを返さないこと
  assert.doesNotMatch(route, /SERVICE_ROLE|SECRET|STRIPE|ANON_KEY/, '返してはいけないものが入っている');
});

test('本番が何を返したかで、状態を書き分ける', () => {
  /*
    「確認できません」だけだと、まだ配られていないのか、落ちているのか、
    識別子が入っていないのかが分からない。
    実際に最初の版は 404 と 200 と通信不能を全部ひとまとめにしていて、
    「コミットが入っていない」という本当の原因にたどり着けなかった。
  */
  const src = watch();
  assert.match(src, /404\) PROD_STATE="まだ入れ替わっていません/, '未配布と区別していない');
  assert.match(src, /200\) PROD_STATE="答えは返りますが、コミットが入っていません"/);
  assert.match(src, /''\|000\) PROD_STATE="本番に届きません/, '通信できない場合と区別していない');
  // 原因にたどり着けるよう、返ってきたものを残すこと（1時間に1回）
  assert.match(src, /本番は答えますが、コミットが入っていません。返ってきたもの/);
  assert.match(src, /head -c 300 \| scrub/, '素通しで書いている、または長すぎる');
});

test('識別子が短くても、突き合わせられる', () => {
  const src = watch();
  assert.match(src, /\[ "\$\{#live\}" -ge 7 \] && \[ "\$\{want:0:\$\{#live\}\}" = "\$live" \]/,
    '完全一致しか見ていない');
});

test('どのコミットかが分からないとき、それらしい値を作らない', () => {
  /*
    嘘の識別子が入ると「反映済み」と出たまま古いものが動き続ける。
    分からないなら null のままにして、「入っていません」と言わせる。
  */
  const cfg = read('next.config.ts');
  assert.match(cfg, /return '';\s*\n\s*\}\s*\n\}/, 'git が無いときに作り物を返している');
  assert.match(cfg, /\/\^\[0-9a-f\]\{7,40\}\$\//, '形を確かめずに使っている');
  assert.match(cfg, /env: \{ BUILD_COMMIT, BUILD_TIME/, 'ビルド時に焼き込んでいない');

  const route = read('app/api/health/route.ts');
  assert.match(route, /if \(typeof value === 'string' && \/\^\[0-9a-f\]\{7,40\}\$\/\.test\(value\)\) return value;/);
  assert.match(route, /return null;/, '見つからないときに嘘をついている');
});

test('置き場所を決め打ちしない', () => {
  // Vercel とは限らない。実際 VERCEL_GIT_COMMIT_SHA は本番で空だった。
  const route = read('app/api/health/route.ts');
  for (const key of ['BUILD_COMMIT', 'VERCEL_GIT_COMMIT_SHA', 'RENDER_GIT_COMMIT', 'SOURCE_VERSION']) {
    assert.ok(route.includes(key), `${key} を見ていない`);
  }
  // どこで動いているかは、変数の「名前があるか」だけ返す。中身は返さない
  assert.match(route, /PLATFORM_HINTS\.filter\(\(key\) => !!process\.env\[key\]\)/,
    '中身を返している');
});
