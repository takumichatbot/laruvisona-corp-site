import test from 'node:test';
import assert from 'node:assert/strict';
import { faststart, topLevelAtoms } from '../lib/mp4-faststart.ts';

// 実ファイルはこの環境から取得できないので、同じ構造の最小mp4を組み立てて検証する。
// 壊れ方の本体は「moovを前に出したのに stco のオフセットを直し忘れる」なので、
// そこを直接確かめられれば意味がある。

function atom(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, payload]);
}

/** stco を1つ持つ moov を作る */
function makeMoov(offsets: number[]): Buffer {
  const body = Buffer.alloc(8 + offsets.length * 4);
  body.writeUInt32BE(0, 0);              // version + flags
  body.writeUInt32BE(offsets.length, 4); // entry count
  offsets.forEach((o, i) => body.writeUInt32BE(o, 8 + i * 4));
  const stco = atom('stco', body);
  return atom('moov', atom('trak', atom('mdia', atom('minf', atom('stbl', stco)))));
}

function readStco(buf: Buffer): number[] {
  const i = buf.indexOf(Buffer.from('stco', 'latin1'));
  assert.notEqual(i, -1, 'stco が見つからない');
  const countAt = i - 4 + 12;
  const n = buf.readUInt32BE(countAt);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(buf.readUInt32BE(countAt + 4 + k * 4));
  return out;
}

test('moovが末尾にあるファイルは先頭へ移る', () => {
  const ftyp = atom('ftyp', Buffer.from('isomiso2', 'latin1'));
  const mdat = atom('mdat', Buffer.alloc(1000, 7));
  const mdatDataStart = ftyp.length + 8;
  const moov = makeMoov([mdatDataStart, mdatDataStart + 100]);
  const input = Buffer.concat([ftyp, mdat, moov]);

  assert.deepEqual(topLevelAtoms(input).map(a => a.type), ['ftyp', 'mdat', 'moov']);

  const r = faststart(input);
  assert.equal(r.changed, true);
  assert.deepEqual(topLevelAtoms(r.buffer).map(a => a.type), ['ftyp', 'moov', 'mdat']);
  assert.equal(r.buffer.length, input.length, 'サイズが変わってはいけない');
});

test('チャンクのオフセットが moov のぶんだけ正しくずれる', () => {
  // ここを忘れると、構造は正しいのに再生できないファイルになる
  const ftyp = atom('ftyp', Buffer.from('isomiso2', 'latin1'));
  const mdat = atom('mdat', Buffer.alloc(1000, 7));
  const mdatDataStart = ftyp.length + 8;
  const moov = makeMoov([mdatDataStart, mdatDataStart + 100]);
  const input = Buffer.concat([ftyp, mdat, moov]);

  const r = faststart(input);
  const shifted = readStco(r.buffer);
  assert.deepEqual(shifted, [mdatDataStart + moov.length, mdatDataStart + 100 + moov.length]);

  // 実際にそのオフセットが mdat の中身を指しているか
  const atoms = topLevelAtoms(r.buffer);
  const newMdat = atoms.find(a => a.type === 'mdat')!;
  for (const off of shifted) {
    assert.ok(off > newMdat.start && off < newMdat.start + newMdat.size,
      `オフセット ${off} が mdat(${newMdat.start}..${newMdat.start + newMdat.size}) の外を指している`);
  }
});

test('既に先頭にあるファイルは触らない', () => {
  const ftyp = atom('ftyp', Buffer.from('isomiso2', 'latin1'));
  const moov = makeMoov([0]);
  const mdat = atom('mdat', Buffer.alloc(100, 1));
  const input = Buffer.concat([ftyp, moov, mdat]);
  const r = faststart(input);
  assert.equal(r.changed, false);
  assert.equal(r.buffer, input, '同じBufferをそのまま返すこと');
});

test('構造が読めないものは壊さずそのまま返す', () => {
  for (const junk of [Buffer.alloc(0), Buffer.from('not an mp4 at all'), Buffer.alloc(64, 0xff)]) {
    const r = faststart(junk);
    assert.equal(r.changed, false);
    assert.equal(r.buffer, junk);
  }
});

test('co64（64bitオフセット）でも正しくずれる', () => {
  const body = Buffer.alloc(8 + 8);
  body.writeUInt32BE(0, 0);
  body.writeUInt32BE(1, 4);
  body.writeBigUInt64BE(BigInt(500), 8);
  const co64 = atom('co64', body);
  const moov = atom('moov', atom('trak', atom('mdia', atom('minf', atom('stbl', co64)))));
  const ftyp = atom('ftyp', Buffer.from('isomiso2', 'latin1'));
  const mdat = atom('mdat', Buffer.alloc(1000, 7));
  const r = faststart(Buffer.concat([ftyp, mdat, moov]));
  assert.equal(r.changed, true);
  const i = r.buffer.indexOf(Buffer.from('co64', 'latin1'));
  assert.equal(r.buffer.readBigUInt64BE(i - 4 + 16), BigInt(500 + moov.length));
});
