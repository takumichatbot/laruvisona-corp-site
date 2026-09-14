export type PublishResult = {
  versionSaved?: boolean;
  warning?: unknown;
};

/** 公開本体と版履歴の保存結果を、すべての管理画面で同じように伝える。 */
export function publishCompletion(
  result: PublishResult,
  successMessage = '公開しました',
): { message: string; warning: boolean } {
  if (result.versionSaved === false) {
    return {
      message: typeof result.warning === 'string' && result.warning.trim()
        ? result.warning
        : '公開は完了しましたが、版履歴を保存できませんでした',
      warning: true,
    };
  }
  return { message: successMessage, warning: false };
}
