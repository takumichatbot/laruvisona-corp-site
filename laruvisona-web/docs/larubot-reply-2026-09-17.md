# LARUbot 側からの回答（LARU HP からの依頼 13項目）

作成: 2026-09-17 / LARUbot（larubot.tokyo）側
対象コード: `app/routes/api.py`, `app/routes/main.py`, `app/static/embed.js`, `app/static/embed/blog.js`, `app/models/user.py`

いただいた文書の「こちらの実装」は鵜呑みにせず、**LARUbot 側のコードで1つずつ確かめました。**
鍵やトークンの値は書きません（環境変数名のみ）。

**この回答の内容は本番へ反映済みです。**

---

## ⚠️ まず、いただいた13項目に無い、いちばん重い問題

### 認証ヘッダーの名前が食い違っています

| | ヘッダー名 |
|---|---|
| そちら（文書 1-1） | `x-laru-secret` |
| こちら（修正前の実装） | `X-LARU-HP-Secret` |

HTTPのヘッダー名は大文字小文字を区別しないので、そこは問題ありません。
**違うのは `hp-` の有無です。**

```python
# 修正前 app/routes/api.py
if not api_secret or request.headers.get('X-LARU-HP-Secret') != api_secret:
    return jsonify({'error': 'Unauthorized'}), 401
```

名前が違えばヘッダーは見つからないので、**こちらは 401 を返して黙って弾いていた**ことになります。

そして、これが**どちらからも見えない形**になっています。

- そちらは「応答の本文は読んでいません（ステータスだけ見ています）」
- そちらは「失敗しても決済は止めません（ログに出すだけ）」

つまり「**課金は通ったのにボットが作られない**」が、両側の画面にもログにも出ません。

**こちらの対応（済）**

- `x-laru-secret` と `X-LARU-HP-Secret` の**両方**を受けるようにしました。そちらの修正を待たずに通ります。
- 照合を `==` から定数時間比較（`hmac.compare_digest`）に変えました。そちらに合わせています。

**お願い**

- 実際にどちらの名前で送っているか、そちらのコードでご確認ください。両方受けるので、どちらでも通ります。
- 過去に登録が 401 で落ちていた分がないか、そちらのログをご確認いただけますか。該当があれば、こちらで手動登録します。

---

## ① プラン名の語彙が2系統ある

### 現状（`app/routes/api.py` `hp_register` 内 `_PLAN_CONFIG`）

**2系統とも受け付けています。** どちらが正、ということはありません。

| 受け取る値 | 作られるプラン | LARUSEO |
|---|---|---|
| `lite` | lite | なし |
| `starter` | starter | なし |
| `pro` | starter | **あり** |
| `laru-cloud` | professional | **あり** |
| `hp-bot` | starter | なし |
| `hp-bot-seo` | starter | **あり** |
| `agency` ← 今回追加 | lite | **あり** |
| `hp_bot_light`（旧） | starter | なし |
| `hp_bot_seo_light`（旧） | starter | **あり** |

### 知らない値が来たときの扱い

**元から 400 で拒否しています。** 既定プランで黙って作ることはありません。

今回、本文を機械で判定できる形にしました。

```json
{
  "ok": false,
  "code": "invalid_plan",
  "error": "Unknown plan: foo",
  "message": "知らない plan です。受け付ける値は agency / hp-bot / ... です。",
  "valid_plans": ["agency", "hp-bot", "hp-bot-seo", "hp_bot_light", "hp_bot_seo_light", "laru-cloud", "lite", "pro", "starter"]
}
```

`valid_plans` は**プラン表そのものから作っています**。手書きの一覧だと、プランを足したときにここだけ古くなるためです（実際、`agency` を足すまで説明文に載っていませんでした）。

**お願い**: ステータスだけでなく**本文も読んでください**。いま一覧を返しても、読まれないままです。

---

## ② `agency` が `hp-bot` として登録されている

### 現状: ご指摘のとおりで、**LARUSEO が付いていませんでした**

`hp-bot` → `('starter', False)` の `False` が「SEOなし」です。
エージェンシー契約（HP + LARUbot Lite + LARUSEO）として売っているものと、作られるものが違っていました。

### こちらの対応（済）

`agency` を追加しました。

```python
'agency': ('lite', True),   # LARUbot Lite + LARUSEO
```

### そちらへのお願い

**`agency` を `hp-bot` に変換せず、`agency` のまま送ってください。**

（`hp-bot-seo` でも SEO は付きますが、ボットが `starter` になります。売り方が「LARUbot Lite 込み」であれば `agency` が正しい組み合わせです。）

---

## ③ LARUSEO の払い出し

### その前提は**正しいです**

`hp-bot-seo` / `pro` / `laru-cloud` / `agency` を送ると、こちらは登録時にこう設定します。

```python
seo_option_enabled: True
seo_article_limit: 5
seo_price_id: 'hp_bundle'
```

そのうえで、コールバックの `laruseo_public_id` に値を入れて返します。

### ⚠️ ただし1点、誤解されている可能性があります

**`laruseo_public_id` は `larubot_public_id` と同じ値です。** 別の ID ではありません。

こちらのアカウントは `public_id` を1つだけ持ち、チャットも LARUSEO も同じ値で参照します。
「別の値が来るはず」と待っていると、いつまでも紐付きません。

登録の応答にも明示するようにしました（後述 ④）。

---

## ④ 応答本文が使われていない／エラーの区別がつかない

### ⚠️ **public_id は、元から応答に入っています**

こちらは登録の応答（201 / 200）で、すでにこう返していました。

```json
{
  "status": "created",
  "public_id": "...",
  "user_id": 123,
  "plan": "starter",
  "embed": { "bot_script": "<script ...>", "seo_script": "<script ...>" }
}
```

**コールバックを待つ必要はありません。** この応答を読めば、その場で紐付けを終えられます。
「課金は通ったのにボットが付かない」の大半は、**本文を読むだけで消えます。**

### こちらの対応（済）: 分かりやすくキーを足しました

成功時（既存のキーはそのまま残しています）

```json
{
  "ok": true,
  "status": "created",          // または "existing"
  "public_id": "...",
  "larubot_public_id": "...",
  "laruseo_public_id": "...",   // SEOなしプランでは null
  "user_id": 123,
  "plan": "starter",
  "embed": { "bot_script": "...", "seo_script": null }
}
```

失敗時

```json
{ "ok": false, "code": "unauthorized",   "error": "...", "message": "..." }   // 401
{ "ok": false, "code": "email_required", "error": "...", "message": "..." }   // 400
{ "ok": false, "code": "invalid_plan",   "error": "...", "message": "...",
  "valid_plans": [...] }                                                       // 400
```

`code` で分岐できます。`error` は前のままなので、既存の扱いも壊れません。

---

## ⑤ コールバックが来なかったことを検知できない

### 現状: ご指摘のとおりでした

修正前は、こうでした。

```python
req_lib.post('https://laruvisona.jp/api/larubot/webhook', json={...}, timeout=10)
```

**`requests.post` は 4xx / 5xx でも例外を出しません。** つまり「送った」以外は何も分からず、
そちらが 400 を返していても、こちらのログには成功も失敗も残りませんでした。再送もありません。

### こちらの対応（済）

1. **応答の状態を見ます**（2xx 以外は失敗として扱う）
2. **間を空けて3回まで送り直します**（2秒 → 8秒）
3. 3回とも駄目なら、あとから手で直せるだけの情報を warning に残します（秘密は書きません）

```
[hp_register] LARU HP への通知が3回とも失敗: HTTP 400 ... (user_id=... site_id=... public_id=... seo=True)
```

4. **登録時に、そちらの `user_id` / `site_id` を控えるようにしました。**
   いままでは呼び出しの間だけ持っていて、捨てていました。控えが無いと、あとから照合できません。

### 照合用の口を作りました

```
GET https://larubot.tokyo/api/hp/status?email=<メールアドレス>
ヘッダー: x-laru-secret（または X-LARU-HP-Secret）
```

```json
{
  "ok": true,
  "linked": true,
  "email": "...",
  "public_id": "...",
  "larubot_public_id": "...",
  "laruseo_public_id": "...",   // SEO無しなら null
  "plan": "starter",
  "is_hp_bundle": true,
  "is_lite_plan": false,
  "seo_enabled": true,
  "hp_user_id": "...",          // 登録時に控えたもの
  "hp_site_id": "..."           // 登録時に控えたもの
}
```

アカウントが無いときは `{"ok": true, "linked": false}` を返します。

⚠️ **`user_id` では引けません。`email` でお願いします。**
そちらの `user_id` は、こちらでは索引の無い設定値の中にしか無く、全件走査になるためです。
控えた `user_id` は応答に入れてあるので、突き合わせはそちらで行えます。

---

## ⑥ `site_id` に空文字が届く

### 現状: そのまま転送していました

つまり、そちらの webhook には `site_id: ""` が届いていました。
そちらの仕様（UUID または省略）では **400 になり、何も紐付きません。**
こちらは応答を見ていなかったので、それにも気づけませんでした。

### こちらの対応（済）

空文字・UUIDでないものは、**コールバックのキーごと省略する**ようにしました。

⚠️ ただし、文書の補足にあるとおり、省略するとそちらは**そのユーザーの全サイト**に同じ public_id を書き込みます。
サイトを1つしか持たない方には正しく、複数持つ方には取り違えになります。
「書かれないよりはまだよい」という判断です。

### そちらへのお願い（根っこはこちら側です）

- **`site_id` は、値が無いときはキーごと省略してください。** 空文字は送らないでください。
- アップグレード経由でも `site_id` を渡せるようにしていただけると、複数サイトの方の取り違えが無くなります。

---

## ⑦ public_id の長さ

### 現状: **36文字固定**です。問題ありません

```python
# app/models/user.py:185
public_id = db.Column(db.String(36), unique=True, nullable=False,
                      default=lambda: str(uuid.uuid4()))
```

- `uuid4` の文字列表現なので、**常に36文字**、`0-9a-f` と `-` のみ
- 列の定義が `String(36)` なので、**37文字以上になることはありません**
- そちらの `[A-Za-z0-9_-]{1,128}` にも、公開HTML側の64文字・`[A-Za-z0-9_-]` にも収まります

**65文字以上のものを発行したことはありません。** そちらの上限を上げる必要はありません。

（こちら側にも「public_id が64文字以内・`[A-Za-z0-9_-]` のみであること」を確かめる検査を足しました。将来 uuid 以外の発行方式に変えた日に、そちらを壊さないためです。）

---

## ⑧ 会話ログの `session_id`

### ⚠️ 現状: **LARUbot は会話ログを送っていません**

`https://laruvisona.jp/api/larubot/conversations` を呼ぶコードは、LARUbot 側に**1行もありません。**
こちらから外部へ出ているのは、登録時のコールバック（`/api/larubot/webhook`）だけです。

```
$ grep -rn "larubot/conversations" app/   → 該当なし
$ grep -rn "laruvisona.jp/api" app/       → webhook の1箇所のみ
```

つまり、`session_id` が null で重複する、という状況は**まだ起きていません**（送っていないので）。

### そちらへの確認

- あの口は、**これから**こちらが送る前提で作られたものでしょうか。
- 必要であれば実装します。そのとき `session_id` は**必須**にし、同じ会話には同じ値を送ります。
  ただ、送る前に決めたいことがあります。
  - 送る対象（全テナントか、LARU HP 経由で作られたアカウントだけか）
  - 送る頻度（会話が終わるたびか、まとめてか）
  - 個人情報の扱い（会話本文をそちらに置いてよいか）

**急ぐ話でなければ、後回しでよいと考えています。**

---

## ⑨ `embed.js` の `requestIdleCallback`

### 現状: ご指摘のとおりでした

```javascript
// 修正前
if ('requestIdleCallback' in window) requestIdleCallback(loadSettings);
else setTimeout(loadSettings, 100);
```

`requestIdleCallback` は「メインスレッドが暇になったら呼ぶ」約束なので、
**暇にならないページでは永久に呼ばれません。**

⚠️ そして、出ないのは**重いページ = 一番見られているページ**です。
エラーは1つも出ないので、こちらからは気づけません。

（別の箇所には `timeout: 5000` が付いていましたが、これも長すぎました。重いページで5秒待たされます。）

### こちらの対応（済）

両方とも `{ timeout: 2000 }` に揃えました。

**そちらの回避コード（`requestIdleCallback` の差し替え）は、外していただいて構いません。**
外す前に、実際にランチャーが出ることをご確認ください。

---

## ⑩ `blog.js` の描画位置

### ⚠️ 先に1つ、こちらの取り違えをお伝えします

`/embed/blog.js` は**静的ファイルではありません。**
`app/static/embed/blog.js` というファイルは存在しますが、**読み込まれていません**（残った古い写しです）。
実際に配られているのは `app/routes/main.py` の `embed_blog_js()` がその場で組み立てている JavaScript です。

最初、写しのほうを直して「直した」とご報告しかけました。本番で確かめて気づきました。
**配られているほうを直してあります。** 写しの先頭には「これは配られていません」と書き、検査も配られているほうを見るように向け直しました。

### こちらの対応（済）: `data-target` を足しました

```html
<script src="https://larubot.tokyo/embed/blog.js"
        data-id="..." data-limit="6"
        data-target="#blog-list" defer></script>
```

- `data-target` があれば、その要素の**中に**描きます
- 無ければ、これまでどおり `<script>` タグの直前に差し込みます（既存の設置タグは壊れません）
- 指定された要素が**まだ無い**場合（React が後から描くなど）は、元の動きに落ちて、コンソールに警告を出します。黙って何も出さないのが一番困るためです

**動的注入の回避は、外していただけます。**

---

## ⑪ `data-id` と `data-public-id` の名前空間

### 答え: **どちらも同じ値**です

こちらのアカウントは `public_id` を1つだけ持ちます。

なお、配られている `blog.js` は **`data-id` と `data-public-id` の両方**を受け付けます（`data-id` を優先）。
どちらで書いても動きます。

```python
# 登録の応答で、こちらが組み立てている設置タグ
'bot_script': f'<script src=".../static/embed.js" data-public-id="{public_id}" async></script>',
'seo_script': f'<script src=".../embed/blog.js" data-id="{public_id}" data-limit="6" defer></script>',
```

`blog.js` の `data-id` は、**チャットの `data-public-id` と同じ値**を受け取る想定です。

> 顧客サイトでは `data-id` に LARUSEO の public_id（別の値）を渡しています

ここが食い違っています。**「別の値」は存在しません。** 別の値を渡している設置タグがあれば、記事が0件になっているはずです。ご確認をお願いします。

---

## ⑫ 料金ページの数量

### ⚠️ 食い違っていました。**こちらを料金ページに合わせて直しました**

| 項目 | 料金ページ (lite) | 修正前 | 料金ページ (hp-bot) | 修正前 | **現在** |
|---|---|---|---|---|---|
| Q&A 登録数 | 15件 | 15件 ✓ | 30件 | **10件** ✗ | **15 / 30** ✓ |
| メニュー項目 | （2体） | 2件 ✓ | （3体） | **上限なし** ✗ | **2 / 3** ✓ |
| 質問例 | 3件 | 3件 ✓ | 5件 | 5件 ✓ | 変更なし ✓ |

### 原因

同じ表が**6箇所に写して**あり、そのすべてで「hp_bundle」という枠を挟んでいました。

```python
plan_limits.get(('lite' if is_lite_plan else 'hp_bundle')
                if is_hp_bundle else customer_data.plan)
```

`is_hp_bundle` は「LARU HP 経由で作られた人」という印でしかありません。
プランはすでに `lite` / `starter` / `professional` として作られているので、**その plan をそのまま見れば料金ページと一致します。** 枠は不要でした。

メニュー項目の表には `'hp_bundle'` のキーが**無かった**ため `.get()` が `None` を返し、上限なしになっていました。

さらに `laru-cloud`（最上位）まで、この枠を通って **10件**に落ちていました。

### ⚠️ そのうえ、画面の表示と食い違っていました

Q&A の画面は `plan_limits.get(data.plan)` と、プランをそのまま見て「30」と出していました。

```
画面:  「登録数: 9 / 30」
実際:  10件目で止まる
```

**使う方には、何が起きたのか分かりません。** これも解消しています。

### 対応（済）

- 表を1箇所に集約（`QA_LIMITS` / `MENU_ITEM_LIMITS`）
- `hp_bundle` の枠を廃止し、`customer_data.plan` をそのまま見る
- 表に無いプラン（`professional` / `laru_cloud`）は**無制限**

**料金ページはそのままで結構です。** 実装のほうを合わせました。

### ⚠️ 「設置ボット数 2体 / 3体」について

**これに対応する上限は、こちらのコードにありません。**

- 1アカウント = 1ボットです（複数のボットを作る機能はありません）
- 設置タグ（`data-public-id`）は、**何サイトに貼っても動きます**。サイト数の制限もありません

数字が一致するのは「チャット内のメニュー項目」（lite 2 / hp-bot 3）ですが、意味が違います。

**お願い**: この行は、意味が合わないまま売っている状態です。
「チャット内のメニュー項目数」に書き換えるか、行ごと外していただくのが正確かと思います。
（「設置できるサイト数」として売りたい場合は、こちらで制限を実装する必要があります。ご指示ください。）

### `GET /api/hp/plan-limits`

数量が確定したので、ご要望があれば作ります。ひとことお知らせください。

---

## ⑬ ブログ記事のサーバー側取得

### ⚠️ **必要な口は、すでにあります**

#### 一覧

```
GET https://larubot.tokyo/api/seo/public/<public_id>/articles?limit=6&page=1
```

認証不要・CORS 可。返るもの:
`id` / `title` / `meta_description` / `snippet` / `thumbnail_url` / `slug` / `target_keyword` / `published_date` / `updated_at` / `has_more` / `custom_domain`

（`blog.js` が使っているのと同じ口です。）

#### 記事1本（**本文つき**）

```
GET https://larubot.tokyo/api/seo/public_article_data/<public_id>/<slug>
```

```json
{
  "success": true,
  "article": {
    "id": 12,
    "slug": "...",
    "title": "...",
    "content": "...",            // HTML
    "content_format": "html",
    "meta_description": "...",
    "thumbnail_url": "...",
    "published_at": "2026-09-01T...",
    "updated_at": "2026-09-10T..."
  }
}
```

この2つで `/blog` と `/blog/[slug]` をサーバー側で描けます。

### ⚠️ こちらの対応（済）: この口には問題が3つありました

1. **中の様子を外に出していました。** 記事が見つからないとき、こう返していました。

   ```
   【原因特定】DBに記事が存在しません。
   最新3件のDB状況: ['ID:12/ステータス:draft', 'ID:11/ステータス:published', ...]
   ```

   `public_id` は設置タグに書いてあるので誰でも知っています。つまり**誰でも、よその会社の下書きの有無と状態を数えられました。**
   → 返すのは「その記事はありません」だけにし、`code: "not_found"` を付けました。

2. **全件を読み込む総当たりのフォールバックがありました。** 誰でも叩ける口で、記事が増えるほど重くなります。ID でも slug でも引けないものは総当たりでも引けないので、消しました。

3. **一覧と公開の定義が食い違っていました。** 一覧は `published` と `wp_synced` の両方を公開として扱い、詳細は `published` だけでした。**一覧に出ているのに開けない記事**があり得ました。揃えました。

4. `published_at` が空のとき `utcnow()`（＝いま）を入れていました。受け取った側が「たったいま公開された記事」として一番上に並べてしまいます。**無いものは `null`** にしました。

### おまけ: よその会社の絵をやめました

記事に画像が無いとき、既定のサムネイルが **`images.unsplash.com`** でした。
これは**お客様のサイトに出るカード**です。向こうが止まるか直リンクを断れば、お客様のお客様の画面で絵が割れ、こちらには何の知らせも来ません。

→ API は `thumbnail_url` を空で返し、`blog.js` は行の中に持っている下地（`data:image/svg+xml`）を出します。
**そちらでサーバー側描画をする場合も、`thumbnail_url` が空のときの下地はそちらでご用意ください。**

### ⚠️ 追記: 同じ問題が、配られているほうにもありました（4箇所）

上の unsplash は API 側の話でした。**お客様のサイトに出るほうは `via.placeholder.com` でした。**
しかも1箇所ではありませんでした。

| 場所 | 何に出るか |
|---|---|
| `main.py` `embed_blog_js()` | お客様のサイトのブログカード |
| `main.py` `seo_public_iframe()` | 埋め込み iframe |
| `main.py` `seo_article_list_public()` | 公開記事一覧 |
| `templates/blog_site/index.html` | お客様のブログサイト本体 |

どれも**お客様のサイトに出ます**。しかも「画像の無い記事」にしか出ないので、こちらの画面ではまず気づけません。
4箇所とも、絵を行の中に持つ形（`data:`）にしました（`NO_IMAGE_THUMB` として1箇所に集約）。

---

## まとめ: そちら（LARU HP）側で直していただきたいこと

| # | 内容 |
|---|---|
| 1 | **登録の応答本文を読んでください。** `public_id` はすでに返っています。コールバック待ちは不要になります |
| 2 | 失敗時は `code`（`unauthorized` / `email_required` / `invalid_plan`）で分岐してください |
| 3 | エージェンシー契約は **`agency` のまま**送ってください（`hp-bot` に変換しない） |
| 4 | `site_id` は値が無いとき**キーごと省略**してください（空文字を送らない） |
| 5 | できれば、アップグレード経由でも `site_id` を渡せるようにしてください |
| 6 | `blog.js` の `data-id` には、**チャットと同じ `public_id`** を渡してください |
| 7 | `requestIdleCallback` の差し替えと、`blog.js` の動的注入の回避は、動作確認のうえ外してください |
| 8 | ⑫の数量は**こちらを料金ページに合わせました**。料金ページはそのままで結構です。ただし「設置ボット数」の行だけは意味が合っていません（後述） |
| 9 | 過去に 401 で落ちていた登録がないか、ログをご確認ください |

`public_id` は **36文字固定・`0-9a-f` と `-` のみ**です。そちらの上限を変える必要はありません。

---

## 4. larubot.tokyo から LARU HP への導線

**入れました（本番反映済み）。**

| # | 場所 | 文言 | リンク |
|---|---|---|---|
| 1 | 全公開ページのフッター | 「ホームページも作るなら **LARU HP**（月額999円〜・LARUbot Lite 込みのプランあり）」 | `https://laruhp.com/?ref=larubot` |
| 2 | 料金ページ（申し込みボタンの上） | 「ホームページごと必要な方へ」ブロック | `https://laruhp.com/plans?ref=larubot` |

料金ページの文面は、こう書いています。

> LARUbot は、すでにあるサイトに置いて使うものです。
> 置く先のサイトから作りたい場合は、姉妹サービスの LARU HP（月額999円〜）をご覧ください。
> LARUbot Lite が込みになったプランもあります。

ご指定どおり、

- ポップアップ・割り込みは使っていません（フッターの1行と、読み進めた先の1ブロック）
- LARUbot のプラン表の中には混ぜていません（**別のサービス**として置いています）
- `?ref=larubot` を付けています

検査でも縛りました（`?ref=larubot` が無い／`modal`・`popup`・`setTimeout`・`fixed inset-0` が混じっている、で落ちます）。

### ⚠️ 3つめの「LARU SEO のブログ記事の末尾」は、入れていません

これは larubot.tokyo の記事ではなく、**お客様のサイトに出ます。**

入れると、**他社のサイトで当社が別サービスを宣伝する**ことになります。
お客様は自分のブログのつもりで設置しておられるので、事前の合意なしにやるべきではないと考えました。

当社自身のブログに限る形であれば入れられます。ご希望であればお知らせください。
（こちらにも検査を置き、お客様のサイトに出るもの（埋め込みカード・お客様のブログサイト）に `laruhp` が入ったら落ちるようにしています。）

---

## 補足

（当初ここに「アフィリエイト用バナーが `placehold.co` のまま」と書いていましたが、**自社配信の画像2枚を作って差し替えました**。
貼り付けコードの画像は絶対URL・https にしてあります（よそのサイトに貼られるため）。）

いまのところ、こちら側で残している宿題はありません。

---

*このファイルは LARUbot 側で作成しました。鍵・トークンの値は含んでいません。*
