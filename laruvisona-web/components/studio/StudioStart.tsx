"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { DESIGN_PRESETS } from "@/lib/site-design";
import {
  GOALS,
  INDUSTRY_CHOICES,
  type IntakeAnswers,
} from "@/lib/studio-schema";
import {
  exampleFor,
  makeStarterSite,
  STARTER_EXAMPLES,
} from "@/lib/studio-start";
import { exportToHTML } from "@/lib/html-export";
import { withPreviewBridge } from "@/lib/preview-frame";
import { cleanIncomingText } from "@/lib/safe-markup";
import { useHydrated } from "@/lib/use-hydrated";
import "./studio-start.css";

function StudioHeader({ step }: { step: number }) {
  return (
    <header className="ls-start-header">
      <Link href="https://laruhp.com/" className="ls-start-logo">
        LARU <strong>HP</strong>
        <span>制作スタジオ</span>
      </Link>
      <nav aria-label="制作の手順">
        {["お店のこと", "見せ方", "編集・公開"].map((text, i) => (
          <span key={text} aria-current={step === i + 1 ? "step" : undefined}>
            <b>{step > i + 1 ? <Check size={12} /> : i + 1}</b>
            {text}
          </span>
        ))}
      </nav>
      <Link className="ls-start-exit" href="/laruHP/dashboard">
        サイト一覧
      </Link>
    </header>
  );
}
const mobileSnapshot = () => window.matchMedia("(max-width:760px)").matches;
const serverMobileSnapshot = () => false;
const subscribeMobile = (callback: () => void) => {
  const mq = window.matchMedia("(max-width:760px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
};

function StarterPreview({
  intake,
  presetId,
}: {
  intake: IntakeAnswers;
  presetId: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [chosenDevice, setDevice] = useState<"pc" | "sp" | null>(null);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverMobileSnapshot,
  );
  const device = chosenDevice ?? (mobile ? "sp" : "pc");
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const source = useMemo(() => {
    const s = makeStarterSite(intake, presetId);
    return withPreviewBridge(
      exportToHTML(
        s.pages,
        s.pages[0].seo!,
        { ...s.settings, animLevel: "none" },
        s.name,
      ),
    );
  }, [intake, presetId]);
  const frameWidth = device === "pc" ? 1100 : 390,
    scale = Math.min(1, width / frameWidth);
  return (
    <div className="ls-preview">
      <div className="ls-preview-toolbar">
        <span>
          <i />
          あなたのサイトの完成イメージ
        </span>
        <div aria-label="プレビューの画面幅">
          <button
            type="button"
            aria-label="パソコンの見え方"
            aria-pressed={device === "pc"}
            onClick={() => setDevice("pc")}
          >
            <Monitor size={15} />
          </button>
          <button
            type="button"
            aria-label="スマホの見え方"
            aria-pressed={device === "sp"}
            onClick={() => setDevice("sp")}
          >
            <Smartphone size={15} />
          </button>
        </div>
      </div>
      <div
        className="ls-preview-window"
        ref={container}
        style={{ height: Math.round((device === "pc" ? 900 : 670) * scale) }}
      >
        <iframe
          key={device + source}
          title="作りはじめるサイトの完成イメージ"
          sandbox="allow-scripts"
          srcDoc={source}
          style={{
            width: frameWidth,
            height: device === "pc" ? 900 : 670,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            left:
              device === "sp"
                ? Math.max(0, (width - frameWidth * scale) / 2)
                : 0,
          }}
        />
      </div>
      <div className="ls-preview-caption">
        <span>同じ見た目のまま、次の画面で編集できます。</span>
        <span>写真・「例」の内容は差し替えてください</span>
      </div>
    </div>
  );
}
export function StudioIntake({
  intake,
  setIntake,
  onNext,
}: {
  intake: IntakeAnswers;
  setIntake: Dispatch<SetStateAction<IntakeAnswers>>;
  onNext: () => void;
}) {
  const hydrated = useHydrated();
  const example = exampleFor(intake.industry),
    [showPreview, setShowPreview] = useState(false);
  const shown = useMemo(
    () => ({
      ...intake,
      name: intake.name || example.name,
      description: intake.description || example.description,
    }),
    [intake, example],
  );
  const field = (key: keyof IntakeAnswers, value: string, max = 200) =>
    setIntake((v) => ({ ...v, [key]: cleanIncomingText(value, max) }));
  return (
    <div className="ls-start">
      <StudioHeader step={1} />
      <main className="ls-start-grid" inert={!hydrated} data-ready={hydrated}>
        <div className="ls-intake">
          <div className="ls-kicker">
            <Sparkles size={14} />
            あなたのお店に、ちょうどいい一枚を。
          </div>
          <h1>
            伝えたいことから、
            <br />
            <em>お店の顔をつくろう。</em>
          </h1>
          <p className="ls-intro">
            まずは、店名と叶えたいことから。
            <br />
            言葉や写真は、できあがりを見ながら整えられます。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (intake.name.trim()) onNext();
            }}
          >
            <fieldset className="ls-industry">
              <legend>何のお店ですか</legend>
              <div className="ls-industry-pills">
                {Object.keys(STARTER_EXAMPLES).map((id) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={intake.industry === id}
                    onClick={() =>
                      setIntake((v) => ({
                        ...v,
                        industry: id,
                        goal: exampleFor(id).goal,
                      }))
                    }
                  >
                    {INDUSTRY_CHOICES.find((c) => c.value === id)?.label}
                  </button>
                ))}
              </div>
              <label className="ls-other">
                <span>すべての業種から選ぶ</span>
                <select
                  value={intake.industry}
                  onChange={(e) =>
                    setIntake((v) => ({
                      ...v,
                      industry: e.target.value,
                      goal: exampleFor(e.target.value).goal,
                    }))
                  }
                >
                  {INDUSTRY_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <div className="ls-field-pair">
              <label className="ls-field">
                店名・屋号 <small>必須</small>
                <input
                  required
                  maxLength={120}
                  value={intake.name}
                  placeholder={example.name}
                  onChange={(e) => field("name", e.target.value, 120)}
                />
              </label>
              <label className="ls-field">
                活動している地域 <small>任意</small>
                <input
                  maxLength={120}
                  value={intake.area}
                  placeholder={example.area}
                  onChange={(e) => field("area", e.target.value, 120)}
                />
              </label>
            </div>
            <fieldset className="ls-goals">
              <legend>サイトを見た人に、してほしいこと</legend>
              <div>
                {GOALS.map((g) => (
                  <button
                    type="button"
                    key={g.value}
                    aria-pressed={intake.goal === g.value}
                    onClick={() => setIntake((v) => ({ ...v, goal: g.value }))}
                  >
                    <span className="ls-radio">
                      {intake.goal === g.value && <Check size={11} />}
                    </span>
                    <span>
                      <strong>{g.label}</strong>
                      <small>{g.note}</small>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <details className="ls-more">
              <summary>
                もう少し、お店らしさを伝える <span>任意</span>
              </summary>
              <label className="ls-field">
                どんな人に来てほしいですか
                <input
                  value={intake.audience}
                  placeholder={example.audience}
                  onChange={(e) => field("audience", e.target.value)}
                />
              </label>
              <label className="ls-field">
                お店のことを、ひとことで
                <textarea
                  value={intake.description}
                  placeholder={example.description}
                  onChange={(e) => field("description", e.target.value, 600)}
                />
              </label>
            </details>
            <button
              className="ls-continue"
              type="submit"
              disabled={!intake.name.trim()}
            >
              雰囲気を選ぶ
              <ArrowRight size={18} />
            </button>
            <p className="ls-note">
              ここでは料金はかかりません。保存・公開にはログインとご契約が必要です。
            </p>
          </form>
        </div>
        <aside
          className={`ls-live-side ${showPreview ? "ls-mobile-open" : ""}`}
        >
          <button
            type="button"
            className="ls-preview-toggle"
            aria-expanded={showPreview}
            aria-controls="starter-live-preview"
            onClick={() => setShowPreview((v) => !v)}
          >
            <span className="ls-preview-thumb" aria-hidden="true" style={{ backgroundImage: `url(${example.photo})` }} />
            <span><strong>{intake.name || example.name}</strong><span>{showPreview ? "完成イメージを閉じる" : "いまの完成イメージを見る"}</span></span>
            <Monitor size={16} />
          </button>
          <div className="ls-live-inner" id="starter-live-preview">
            <div className="ls-live-heading">
              <span>入力すると、ここが変わります</span>
              <span>完成イメージ</span>
            </div>
            <StarterPreview intake={shown} presetId="refined" />
            <div className="ls-live-foot">
              <span>01</span>
              <p>
                <strong>選んだ目的が、サイトの導線に。</strong>
                <br />
                {GOALS.find((g) => g.value === intake.goal)?.note}
              </p>
            </div>
            <p className="ls-sample-note">
              仮の名前・写真と「例」の内容は、実際のお店の情報に差し替えてから公開してください。実績や体験談は自動では作りません。
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
export function StudioMood({
  intake,
  onBack,
  onPick,
  fromLp,
}: {
  intake: IntakeAnswers;
  onBack: () => void;
  onPick: (preset: string) => void;
  fromLp?: string | null;
}) {
  const valid = DESIGN_PRESETS.some((p) => p.id === fromLp)
    ? fromLp!
    : "refined";
  const [selected, setSelected] = useState(valid);
  const ordered = [...DESIGN_PRESETS].sort(
    (a, b) => Number(b.id === valid) - Number(a.id === valid),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="ls-start">
      <StudioHeader step={2} />
      <main className="ls-mood-layout">
        <div className="ls-mood-controls">
          <button type="button" className="ls-back" onClick={onBack}>
            <ArrowLeft size={15} />
            お店のことに戻る
          </button>
          <div className="ls-kicker">見せ方を選ぶ</div>
          <h1>
            らしさが、
            <br />
            伝わる見せ方を。
          </h1>
          <p className="ls-intro">
            同じお店でも、印象はいろいろ。
            <br />
            何度でも比べて、あとから選び直せます。
          </p>
          {fromLp && (
            <p className="ls-picked-note">
              案内の画面で選んだ見せ方を引き継ぎました。
            </p>
          )}
          <div
            className="ls-mood-options"
            role="radiogroup"
            aria-label="サイトの雰囲気"
          >
            {ordered.map((p, i) => (
              <button
                type="button"
                role="radio"
                aria-checked={selected === p.id}
                tabIndex={selected === p.id ? 0 : -1}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-preset={p.id}
                key={p.id}
                onClick={() => setSelected(p.id)}
                onKeyDown={(e) => {
                  let n = i;
                  if (e.key === "ArrowDown" || e.key === "ArrowRight")
                    n = (i + 1) % ordered.length;
                  else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
                    n = (i - 1 + ordered.length) % ordered.length;
                  else if (e.key === "Home") n = 0;
                  else if (e.key === "End") n = ordered.length - 1;
                  else return;
                  e.preventDefault();
                  setSelected(ordered[n].id);
                  refs.current[n]?.focus();
                }}
              >
                <span
                  className="ls-swatch"
                  style={{
                    background: p.design.bg,
                    color: p.design.ink,
                    fontFamily:
                      p.fontFamily === "mincho" ? "serif" : "sans-serif",
                  }}
                >
                  あ<span style={{ background: p.design.accent }} />
                </span>
                <span>
                  <strong>
                    {p.name}
                    {fromLp === p.id && <small>案内で選んだもの</small>}
                  </strong>
                  <span>{p.note}</span>
                </span>
                <span className="ls-radio">
                  {selected === p.id && <Check size={12} />}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ls-continue"
            onClick={() => onPick(selected)}
          >
            この見せ方で編集する
            <ArrowRight size={18} />
          </button>
          <p className="ls-note">
            選んでも公開されません。写真・文章を整えてから公開できます。
          </p>
        </div>
        <div className="ls-mood-preview">
          <StarterPreview intake={intake} presetId={selected} />
          <p className="ls-sample-note">
            見本写真・仮の料金は、編集画面でご自身の情報へ差し替えてください。
          </p>
        </div>
      </main>
    </div>
  );
}
