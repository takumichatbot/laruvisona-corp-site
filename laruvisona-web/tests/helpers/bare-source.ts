/**
 * 注釈を落としたコード。決めごとを注釈にも書くので、探すのは外だけにする。
 *
 * 素朴に /\/\*[\s\S]*?\*\// で消すと、**コードまで消える。**
 *
 *   <input accept="image/*" ... />
 *              ↑ ここの /* が注釈の始まりに見える
 *
 * 実際 app/laruHP/builder/page.tsx で、ここから次の *​/ までの
 * **725行が丸ごと消えていた。** その間にある不具合は、どんな見張りを
 * 書いても見えない。見張りが静かに目をつぶっている状態で、
 * 「通った」という結果だけが出る。いちばん質の悪い壊れ方。
 *
 * 本物の注釈の始まりは、行頭・空白・`{` のどれかの直後にしか来ない。
 * 文字列の途中に現れる `/*` は、その手前が英数字や引用符になる。
 */
const BLOCK_COMMENT = /(^|[\s{])\/\*[\s\S]*?\*\//g;

export function bareSource(src: string): string {
  return src
    .replace(BLOCK_COMMENT, '$1')
    .split('\n')
    .filter(line => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .join('\n');
}
