import { ImageResponse } from 'next/og';
import fs from 'node:fs';
import path from 'node:path';

export const alt = 'LARU HP｜その仕事に、ふさわしいホームページを。';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const photo = fs.readFileSync(
    path.join(process.cwd(), 'public/lp/film/flow-share.jpg'),
  );
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#090e1c',
          color: '#f4f7ff',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={`data:image/jpeg;base64,${photo.toString('base64')}`}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            objectFit: 'cover',
            opacity: 0.65,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg,#090e1ce8,#090e1c20)',
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '56px 70px',
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 62,
            }}
          >
            LARU <span style={{ color: '#a5b6ff', marginLeft: 8 }}>HP</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 37,
              marginBottom: 16,
              color: '#d9e2f8',
            }}
          >
            その仕事に、
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: '-2px',
            }}
          >
            <span>ふさわしい</span>
            <span>ホームページを。</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 30,
              fontSize: 23,
              color: '#bfcee9',
            }}
          >
            写真と言葉から、完成を見ながらつくる。
          </div>
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              right: 60,
              bottom: 40,
              color: '#a5b6d3',
              fontSize: 18,
            }}
          >
            laruhp.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}
