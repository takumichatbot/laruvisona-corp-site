// mp4 の moov アトムを先頭へ移す（いわゆる faststart）。
//
// なぜ必要か:
// Veo が出す mp4 は moov（再生に必要な索引）がファイル末尾にある。
// ブラウザは索引が読めるまで再生を始められないので、5MBのファイルなら
// 先頭を読み → 末尾まで取りに行き → もう一度戻る、という往復が発生する。
// moov を先頭に置けば、最初の数十KBで再生を始められる。
//
// ffmpeg を使えば1コマンドだが、この環境からは動画ファイルにネットワークで
// 到達できず、Render に ffmpeg を積むのは1回きりの処理のために重すぎる。
// mp4 のトップレベル構造を書き換えるだけなので、依存なしで実装する。
//
// やること:
//   1. トップレベルのアトムを順に読む
//   2. moov が mdat より後ろにあるなら、[ftyp][moov][残りを元の順で] に組み直す
//   3. mdat が moov のサイズ分だけ後ろにずれるので、moov の中の
//      stco / co64（各チャンクの絶対オフセット）を同じ分だけ加算する
//      ※ これを忘れると、構造は正しいのに再生できないファイルになる

export interface Atom { type: string; start: number; size: number; }

/** トップレベルのアトムを列挙する */
export function topLevelAtoms(buf: Buffer): Atom[] {
  const out: Atom[] = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    if (size === 1) {
      if (p + 16 > buf.length) break;
      size = Number(buf.readBigUInt64BE(p + 8));
    } else if (size === 0) {
      size = buf.length - p; // 最後まで
    }
    if (size < 8 || p + size > buf.length) break;
    out.push({ type, start: p, size });
    p += size;
  }
  return out;
}

/** moov の中の stco / co64 の位置を集める（入れ子をたどる） */
function findOffsetTables(buf: Buffer, start: number, end: number, acc: Atom[]): void {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let headerSize = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(buf.readBigUInt64BE(p + 8));
      headerSize = 16;
    }
    if (size < 8 || p + size > end) break;
    if (type === 'stco' || type === 'co64') acc.push({ type, start: p, size });
    else if (CONTAINERS.has(type)) findOffsetTables(buf, p + headerSize, p + size, acc);
    p += size;
  }
}

/** stco / co64 のオフセットを delta だけずらす（buf を直接書き換える） */
function shiftOffsets(buf: Buffer, table: Atom, delta: number): void {
  // アトムヘッダ8 + version/flags 4 + entryCount 4
  const countAt = table.start + 12;
  const count = buf.readUInt32BE(countAt);
  let p = countAt + 4;
  for (let i = 0; i < count; i++) {
    if (table.type === 'stco') {
      if (p + 4 > table.start + table.size) break;
      buf.writeUInt32BE(buf.readUInt32BE(p) + delta, p);
      p += 4;
    } else {
      if (p + 8 > table.start + table.size) break;
      buf.writeBigUInt64BE(buf.readBigUInt64BE(p) + BigInt(delta), p);
      p += 8;
    }
  }
}

export interface FaststartResult {
  buffer: Buffer;
  changed: boolean;
  reason?: string;
  moovWasAt?: number;
  atoms: string[];
}

/**
 * moov を先頭へ移した Buffer を返す。
 * 既に先頭にある / 構造が読めない場合は、元の Buffer をそのまま返す（changed:false）。
 */
export function faststart(input: Buffer): FaststartResult {
  const atoms = topLevelAtoms(input);
  const names = atoms.map(a => a.type);
  const moov = atoms.find(a => a.type === 'moov');
  const mdat = atoms.find(a => a.type === 'mdat');
  const ftyp = atoms.find(a => a.type === 'ftyp');

  if (!moov || !mdat) return { buffer: input, changed: false, reason: 'moov か mdat が見つからない', atoms: names };
  if (moov.start < mdat.start) return { buffer: input, changed: false, reason: '既に moov が前にある', atoms: names };

  // moov を切り出して、その中のオフセットを +moov.size する。
  // 組み直し後、mdat はちょうど moov のサイズ分だけ後ろへ動くため。
  const moovBuf = Buffer.from(input.subarray(moov.start, moov.start + moov.size));
  const tables: Atom[] = [];
  findOffsetTables(moovBuf, 8, moovBuf.length, tables);
  for (const t of tables) shiftOffsets(moovBuf, t, moov.size);

  const parts: Buffer[] = [];
  if (ftyp) parts.push(input.subarray(ftyp.start, ftyp.start + ftyp.size));
  parts.push(moovBuf);
  for (const a of atoms) {
    if (a === moov || (ftyp && a === ftyp)) continue;
    parts.push(input.subarray(a.start, a.start + a.size));
  }

  return {
    buffer: Buffer.concat(parts),
    changed: true,
    moovWasAt: moov.start,
    atoms: names,
  };
}
