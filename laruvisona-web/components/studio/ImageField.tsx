"use client";
/* 編集対象の任意URLをそのまま確認するため、プレビューには通常のimgを使う。 */
/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Upload, ImagePlus, Check, LoaderCircle } from "lucide-react";
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
