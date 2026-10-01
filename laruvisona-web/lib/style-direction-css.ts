/**
 * 見た目の案（lib/style-direction-plan.ts）を採用した作品にだけ出すCSS。
 * 案を採用していない作品の公開HTMLには入らない（従来の見え方を変えない）。
 */
const AC = 'body:is([data-style-direction="editorial"],[data-style-direction="catalog"])';

export const STYLE_DIRECTION_CSS = `
/* 写真が見本のまま／写真が無いときの最初の画面：文字と写真の場所を上下に分ける（写真に重ねない） */
.lhp-hero.lhp-hero-separated{background-image:none!important;background-color:var(--lhp-d-bg,#fff)!important;color:var(--lhp-d-ink,#263248)!important;min-height:0!important;height:auto!important;padding:clamp(64px,8vw,112px) 24px clamp(48px,6vw,80px)!important;clip-path:none!important;margin-bottom:0!important}
.lhp-hero-separated::before,.lhp-hero-separated::after{display:none!important}
.lhp-hero-separated .lhp-hero-inner{display:block!important;max-width:960px!important;margin:0 auto!important;text-align:center!important}
.lhp-hero-separated .lhp-hero-content{max-width:40em;margin:0 auto}
.lhp-hero-separated :is(h1,.lhp-hero-sub){color:inherit!important}
.lhp-hero-stage{max-width:960px;margin:clamp(32px,4vw,56px) auto 0}
.lhp-hero-stage :is(picture,img){display:block;width:100%;height:auto}
.lhp-hero-stage img{aspect-ratio:3/2;object-fit:contain;background:var(--lhp-d-surface,#f3f3f3);border-radius:var(--lhp-d-r,0)}
/* 写真に文字を重ねる組み方：写真が読み込めないときも白い文字が読めるよう、下地を濃い色にする */
/* （スマホで「写真の全体を残す」ときは文字と写真を分けて組むので、明るい下地のまま） */
.lhp-hero-crafted:not(.lhp-hero-separated):not([data-photo-fit="contain"]){background-color:var(--lhp-d-ink,#1f2937)!important}
@media(min-width:769px){.lhp-hero-crafted[data-photo-fit="contain"]:not(.lhp-hero-separated){background-color:var(--lhp-d-ink,#1f2937)!important}}

/* 言葉で伝える／内容で選んでもらう：最初の画面・見出し・本文の読み始めを、節の中身の幅にそろえる */
${AC} [data-composition].lhp-hero .lhp-hero-inner{max-width:1052px}
/* 表示の動きの処理が style 属性を書き直す（"text-align: left;" になる）ので、両方の書き方を見る */
${AC} .lhp-section:is([style*="text-align:left"],[style*="text-align: left"])>p{margin-left:0;margin-right:auto}
${AC} .lhp-tabs{margin-left:0!important}
${AC} :is(.lhp-faq,.lhp-hours){margin-left:0}
/* 問い合わせ：見出し・案内文・フォームを同じ幅のまとまりにする */
${AC} .lhp-contact>:is(.lhp-section-title,.lhp-section-sub){display:block;max-width:560px;margin-left:auto!important;margin-right:auto!important;text-align:left!important}
`.trim();

/** 控えめな動き：短いフェードだけ。最初の画面は止めたまま。注意を引く点滅・脈動もしない */
export const CALM_MOTION_CSS = `
body[data-motion="calm"] [data-lhp-anim]{transition-duration:.32s!important;transition-delay:0s!important;transition-timing-function:ease-out!important;transform:none!important}
body[data-motion="calm"] :is(.lhp-hero,[data-lhp-instant]){opacity:1!important}
body[data-motion="calm"] .lhp-btn-primary,body[data-motion="calm"] .lhp-hero::before{animation:none!important}
`.trim();
