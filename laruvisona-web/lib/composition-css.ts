/** 明示して選んだ構成だけ。固定高や省略で文章を隠さず、幅に合わせて整える。 */
export const COMPOSITION_CSS = `
[data-composition] {overflow-wrap:anywhere; min-width:0}
[data-composition] :is(.lhp-hero-content,.lhp-col,.lhp-card,.lhp-grid,.lhp-three-col,.lhp-two-col){min-width:0}
[data-composition] :is(h1,h2,h3,p,a){overflow-wrap:anywhere}
[data-composition] .lhp-hero-sub {max-width:32em;white-space:pre-line}
[data-composition] .lhp-btn-primary{max-width:100%;white-space:normal;text-align:center}
[data-composition].lhp-hero {height:auto;min-height:560px}
[data-composition].lhp-hero h1 {max-width:18em;text-wrap:pretty;line-height:1.55}
[data-heading-density="long"].lhp-hero h1{font-size:clamp(25px,2.7vw,36px)}
[data-composition="editorial"] .lhp-hero-inner{display:flex;flex-direction:row;gap:clamp(28px,4vw,60px);max-width:1180px;width:100%;margin:auto}
[data-composition="editorial"] .lhp-hero-content{flex:1 1 42%;min-width:0}
[data-composition="editorial"] .lhp-hero-split-img{position:relative;flex:1 1 58%;aspect-ratio:4/3;overflow:hidden}
[data-composition="editorial"] .lhp-hero-split-img :is(picture,img){display:block;width:100%;height:100%}
[data-composition="editorial"] .lhp-hero-img{object-fit:cover;object-position:var(--lhp-hero-pos,50% 50%)}
[data-composition="immersive"].lhp-hero{min-height:680px;padding:clamp(80px,13vw,170px) 24px}
[data-composition="immersive"] .lhp-hero-content{max-width:800px;margin:auto}
[data-composition="catalog"].lhp-hero{min-height:460px}
[data-composition="catalog"] .lhp-grid{gap:1px;background:var(--lhp-d-line,#ddd);border:1px solid var(--lhp-d-line,#ddd)}
[data-composition="catalog"] .lhp-card{box-shadow:none;border:0;border-radius:0;background:var(--lhp-d-bg,#fff);padding:32px}
[data-composition="editorial"] .lhp-gallery{gap:24px}
[data-composition="editorial"] .lhp-gallery-img:nth-child(even){margin-top:48px}
[data-composition="immersive"] .lhp-gallery:has(>img:only-child){max-width:100%;padding-bottom:0}
[data-composition="immersive"] .lhp-gallery>img:only-child{position:static;margin-bottom:0}
@media(max-width:768px){
 [data-composition].lhp-hero{height:auto;min-height:0;padding:42px 22px}
 [data-composition].lhp-hero .lhp-hero-inner{max-width:100%;gap:28px}
 [data-composition="editorial"] .lhp-hero-inner{flex-direction:column!important}
 [data-composition="editorial"] :is(.lhp-hero-content,.lhp-hero-split-img){width:100%;flex:none}
 [data-composition="editorial"] .lhp-hero-split-img{aspect-ratio:3/4}
 [data-composition] .lhp-hero-img{object-position:var(--lhp-hero-pos-sp,var(--lhp-hero-pos,50% 50%))!important}
 [data-composition].lhp-hero h1{font-size:clamp(26px,7.5vw,34px);letter-spacing:.035em;line-height:1.55}
 [data-heading-density="long"].lhp-hero h1{font-size:clamp(24px,6.4vw,28px)}
 [data-composition="immersive"].lhp-hero,[data-composition="catalog"].lhp-hero{padding:100px 22px 70px;min-height:520px}
 [data-composition="editorial"] .lhp-gallery{gap:12px}
 [data-composition="editorial"] .lhp-gallery-img:nth-child(even){margin-top:24px}
 [data-composition] :is(.lhp-three-col,.lhp-grid-3){grid-template-columns:minmax(0,1fr)}
 [data-photo-fit="contain"] .lhp-hero-split-img{aspect-ratio:auto;background:var(--lhp-d-surface,#f3f3f3)}
 [data-photo-fit="contain"] .lhp-hero-split-img :is(img,picture){height:auto;object-fit:contain}
 [data-photo-fit="contain"].lhp-hero-crafted{background-image:none!important;padding-top:42px;min-height:0;background-color:var(--lhp-d-bg,#fff)!important;color:var(--lhp-d-ink,#263248)!important}
 [data-photo-fit="contain"].lhp-hero-crafted::before,[data-photo-fit="contain"].lhp-hero-crafted::after{display:none}
 .lhp-adaptive-mobile-photo{display:block;width:100%;height:auto;margin-top:28px;object-fit:contain}
 [data-photo-fit="contain"].lhp-hero-crafted>.lhp-hero-media{display:none}
}
@media(min-width:769px){.lhp-adaptive-mobile-photo{display:none}}
@media(prefers-reduced-motion:reduce){[data-composition] .lhp-gallery-stack img{position:static}}
`;
