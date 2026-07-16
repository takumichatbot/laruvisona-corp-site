import { redirect } from 'next/navigation';

// /works 単体アクセスはトップの実績セクションへ
export default function WorksIndexPage() {
  redirect('/#works');
}
