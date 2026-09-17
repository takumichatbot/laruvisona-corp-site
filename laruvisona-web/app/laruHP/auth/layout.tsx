import './auth.css';

// ログイン・登録まわりだけに当てる見た目。
// 管理画面（app-shell.css）と同じ変数を使うが、入れ物が違うので別ファイルにしてある。
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
