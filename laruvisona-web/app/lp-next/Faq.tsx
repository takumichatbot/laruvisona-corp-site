'use client';

import { FAQ } from './facts';

/**
 * よくある質問。<details> を使う。
 * 開閉のstateをJSで持たなくても動くので、JSが落ちても中身が読める。
 * キーボードでも Tab → Enter で開ける（ブラウザ標準の挙動）。
 */
export default function Faq() {
  return (
    <div className="space-y-3">
      {FAQ.map((item) => (
        <details
          key={item.q}
          className="group rounded-2xl border border-slate-200 bg-white overflow-hidden"
        >
          <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-4 min-h-[56px] font-medium text-[15px] text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600">
            <span className="text-balance-jp">{item.q}</span>
            <span
              aria-hidden="true"
              className="shrink-0 mt-0.5 text-slate-400 transition-transform group-open:rotate-45 text-xl leading-none"
            >
              +
            </span>
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-[1.9] text-slate-600 border-t border-slate-100 pt-4">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
