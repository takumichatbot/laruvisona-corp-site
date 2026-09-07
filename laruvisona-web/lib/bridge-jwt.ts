// Bridge relay 用 JWT の定数。会員用 JWT（lib/member-auth.ts）とは
// 鍵・issuer・audience・用途を完全に分離する。
export const BRIDGE_JWT_ISSUER = 'laruvisona-bridge';
export const BRIDGE_JWT_AUDIENCE = 'bridge-relay';
export const BRIDGE_JWT_TYP = 'bridge';
