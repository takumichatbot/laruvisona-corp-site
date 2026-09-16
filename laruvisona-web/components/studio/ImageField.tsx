"use client";
/* 編集対象の任意URLをそのまま確認するため、プレビューには通常のimgを使う。 */
/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Upload, ImagePlus, Check, LoaderCircle, Sparkles } from "lucide-react";
export const ImageUploadContext = createContext({
  pending: false,
  report: (_active: boolean) => {
    void _active;
  },
});
export function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (url: string) => void;
}) {
  const uploadState = useContext(ImageUploadContext);
  const report = uploadState.report;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const input = useRef<HTMLInputElement>(null),
    request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  /* AIで写真を作る。案内ページで「AIによる文章と画像の生成」と書いているのに、
     画像生成は旧エディタにしか無く、制作スタジオからは届かなかった。
     作った画像はアップロードし直してURLで持つ（サイトのデータにbase64を入れない）。 */
  const [wish, setWish] = useState("");
  const [making, setMaking] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    report(true);
    return () => report(false);
  }, [busy, report]);
  async function upload(file: File) {
    setError("");
    setDone(false);
    if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
      setError("JPEG・PNG・WebP・GIF・AVIFの写真を選んでください。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("写真は10MB以下で選んでください。");
      return;
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: data,
        signal: controller.signal,
      });
      const result = await res.json();
      if (!res.ok)
        throw Error(
          res.status === 401
            ? "写真をアップロードするにはログインしてください。"
            : result.error || "アップロードできませんでした。",
        );
      if (typeof result.url !== "string" || !/^https?:\/\//.test(result.url))
        throw Error("写真の保存先を確認できませんでした。");
      if (!controller.signal.aborted) {
        onChangeRef.current(result.url);
        setDone(true);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "アップロードできませんでした。",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function makeWithAi() {
    const text = wish.trim();
    if (!text) {
      setError("どんな写真がほしいかを、一行で書いてください。");
      return;
    }
    setError("");
    setDone(false);
    setMaking(true);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw Error(
          res.status === 401
            ? "写真を作るにはログインしてください。"
            : res.status === 429
              ? "今日の生成回数の上限に達しました。時間をおいてお試しください。"
              : result.error || "写真を作れませんでした。",
        );
      const url = String(result.url || "");
      if (!url.startsWith("data:image/")) throw Error("写真を受け取れませんでした。");
      const blob = await (await fetch(url)).blob();
      await upload(
        new File([blob], `ai-${Date.now()}.png`, { type: blob.type || "image/png" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "写真を作れませんでした。");
    } finally {
      setMaking(false);
    }
  }

  return (
    <div className="se-image-field">
      <span className="se-label">{label}</span>
      <button
        type="button"
        className="se-image-pick"
        disabled={busy || uploadState.pending}
        onClick={() => input.current?.click()}
        aria-label={`${label}を端末から選ぶ`}
      >
        {value ? (
          <img src={String(value)} alt="現在の写真" />
        ) : (
          <ImagePlus size={30} />
        )}
        <span>
          {busy ? (
            <LoaderCircle size={16} className="se-spin" />
          ) : (
            <Upload size={16} />
          )}{" "}
          {busy ? "写真を保存しています…" : "写真を選んで差し替える"}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label={`${label}のファイル`}
        className="se-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
        disabled={busy || uploadState.pending}
      />
      <p className="se-image-note">
        10MBまで。写真の保存にはログインが必要です。
      </p>
      <div role="status" className={error ? "se-image-error" : "se-image-done"}>
        {error ||
          (done ? (
            <>
              <Check size={14} />
              写真を差し替えました。サイトの保存は上のボタンから。
            </>
          ) : null)}
      </div>
      <details>
        <summary>AIで写真を作る</summary>
        <label className="se-image-url">
          どんな写真がほしいか
          <input
            value={wish}
            disabled={busy || making || uploadState.pending}
            placeholder="例: 朝の光が入る、落ち着いた美容室の店内"
            onChange={(e) => setWish(e.target.value.slice(0, 200))}
          />
        </label>
        <button
          type="button"
          onClick={() => void makeWithAi()}
          disabled={busy || making || uploadState.pending}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
            padding: "8px 14px", borderRadius: 8, border: "1px solid currentColor",
            background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}
        >
          {making ? <LoaderCircle size={14} className="se-spin" /> : <Sparkles size={14} />}
          {making ? "作っています…" : "この内容で作る"}
        </button>
        <p className="se-image-note">
          作った写真は、そのまま差し替わります。人物や店名は写せないので、実物の写真が用意できたら差し替えてください。
        </p>
      </details>
      <details>
        <summary>画像のURLを使う</summary>
        <label className="se-image-url">
          画像URL
          <input
            value={String(value || "")}
            disabled={busy || uploadState.pending}
            placeholder="https://…"
            onChange={(e) => {
              setDone(false);
              setError("");
              onChange(e.target.value.trim());
            }}
          />
        </label>
      </details>
    </div>
  );
}
export function FocalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const pos = String(value || "50% 50%");
  return (
    <fieldset className="se-focal">
      <legend>{label}</legend>
      <div className="se-focal-row">
        <div role="group" aria-label={label}>
          {[20, 50, 80].flatMap((y, yi) =>
            [20, 50, 80].map((x, xi) => {
              const v = `${x}% ${y}%`;
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`${["上", "中央", "下"][yi]}・${["左", "中央", "右"][xi]}`}
                  aria-pressed={pos === v}
                  onClick={() => onChange(v)}
                >
                  <span />
                </button>
              );
            }),
          )}
        </div>
        <p>
          残したい場所を選びます。
          <br />
          完成像で切り抜きを確認できます。
          <button type="button" onClick={() => onChange("")}>
            指定を戻す
          </button>
        </p>
      </div>
    </fieldset>
  );
}
