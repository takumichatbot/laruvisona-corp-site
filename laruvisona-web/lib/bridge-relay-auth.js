// Bridge relay のトークン検証。server.js（素の Node で動く CommonJS）と
// テストの両方から使うため、TypeScript ではなく素の JS で置く。
//
// 署名だけを見る検証は不十分。同じ鍵で発行された別用途のトークン
// （会員ログイン等）が運用リレーの認証を通ってしまうため、
// issuer / audience / 用途 / 主体 / role まで検証する。
const jwt = require('jsonwebtoken');

const BRIDGE_ISSUER = 'laruvisona-bridge';
const BRIDGE_AUDIENCE = 'bridge-relay';
const BRIDGE_TYP = 'bridge';
const ROLES = ['mac', 'client'];

/**
 * @param {string} token   クエリで渡されたトークン
 * @param {string} role    接続しようとしている role
 * @param {string} secret  BRIDGE_JWT_SECRET
 * @returns {boolean}
 */
function verifyBridgeToken(token, role, secret) {
  if (!secret) return false;               // 鍵未設定なら誰も通さない
  if (!ROLES.includes(role)) return false;
  try {
    const payload = jwt.verify(token, secret, {
      issuer: BRIDGE_ISSUER,
      audience: BRIDGE_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (payload.typ !== BRIDGE_TYP || payload.sub !== BRIDGE_TYP) return false;
    // トークンに role が入っている場合は接続時の role と一致すること
    if (payload.role && payload.role !== role) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = { verifyBridgeToken, BRIDGE_ISSUER, BRIDGE_AUDIENCE, BRIDGE_TYP, ROLES };
