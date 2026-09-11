import { createHash } from 'node:crypto';

/**
 * 中身の指紋。
 *
 * 「いま置かれている公開HTMLが、こちらが書いたものと同じかどうか」を
 * 確かめるために使う。同じなら、そのあと誰も公開し直していない。
 * 違えば、利用者が新しく公開したということなので、上から書いてはいけない。
 *
 * 中身そのものを比べてもよいが、数十KBの文字列をやり取りすることになる。
 * 指紋なら64文字で済み、記録にも残せる。
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
