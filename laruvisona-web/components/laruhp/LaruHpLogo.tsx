import Image from 'next/image';

/**
 * LARU HP の元ロゴ（マーク上・文字下のほぼ正方形）。新しいロゴではない。
 * public/laruhp_logo.png（1024×1024・白背景・ロゴ本体は高さの約 41%）から、白背景の透過と余白の詰めだけをした tight 版（448×432）。
 * - 比率は 448:432 のまま、幅だけ className で決める（高さは auto。横長に引き伸ばさない・cover で切らない）。
 * - 原色（紺・青緑）のまま。暗い面では plate で白い台紙に載せる。invert / brightness-0 で色を変えない。
 */
export const LARUHP_LOGO_SRC = '/brand/laruhp/laruhp-transparent-tight-448x432.png';

export default function LaruHpLogo({
  className = 'w-14',
  sizes = '80px',
  plate = false,
  platePadding = 'p-1',
  alt = 'LARU HP',
  priority = false,
}: {
  /** 表示幅（Tailwind の w-*）。高さは比率から決まる */
  className?: string;
  /** 実際の表示幅に合わせる（Next の画像変換が小さい版を選ぶ） */
  sizes?: string;
  /** 暗い面：白い台紙に載せる */
  plate?: boolean;
  /** 台紙の余白（狭い帯では細く。帯の高さを変えないため） */
  platePadding?: string;
  alt?: string;
  priority?: boolean;
}) {
  const img = (
    <Image
      src={LARUHP_LOGO_SRC}
      alt={alt}
      width={448}
      height={432}
      sizes={sizes}
      priority={priority}
      className={`block h-auto max-w-none shrink-0 object-contain ${className}`}
    />
  );
  if (!plate) return img;
  return <span className={`inline-flex shrink-0 rounded-md bg-white ${platePadding}`}>{img}</span>;
}
