#!/usr/bin/env bash
# LARU SEO 記事ページ（M03）の確認の入口。
# 前提: 偽DB（tests/http/fixture.cjs :54999）と、Content API の代わり（このスクリプトが :54997 で起動）、
#       LARUBOT_API_URL=http://127.0.0.1:54997 HP_SEO_CONTENT_FRESH_MS=0 で起動した fixture 向けビルド（:3319）
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
curl -s -o /dev/null http://127.0.0.1:54997/__state || (SEO_MOCK_PORT=54997 setsid nohup node tests/http/seo-content-mock.cjs >/dev/null 2>&1 &)
sleep 1
status=0
node --import ./tests/_resolve-ts.mjs --test tests/hp-seo-articles.test.ts || status=1
node tests/http/hp-seo-articles-check.mjs || status=1
node tests/browser/hp-articles-layout-check.mjs || status=1
exit $status
