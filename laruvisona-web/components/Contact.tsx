'use client';

import { FormEvent, useState, useEffect } from 'react';

interface ContactProps {
  initialMessage: string;
}

export default function Contact({ initialMessage }: ContactProps) {
  // フォームの入力状態を管理
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 親から新しい initialMessage が渡ってきたら、テキストエリアを更新する
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // ここで実際にAPI（/api/contact など）にデータをPOSTする処理を書きます
    // 今回はデモとして、2秒待ってから成功を表示します
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitStatus('success');
      // 送信成功後、フォームをリセットしたい場合は以下を有効化
      // setMessage('');
    }, 2000);
  };

  return (
    <div className="bg-[#030712]/80 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden text-left">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
      
      {submitStatus === 'success' ? (
        <div className="text-center py-12 animate-[fadeIn_0.5s_ease-out]">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-check text-2xl"></i>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">送信完了しました</h3>
          <p className="text-slate-400 text-sm">お問い合わせありがとうございます。<br/>内容を確認の上、担当者よりご連絡いたします。</p>
          <button onClick={() => setSubmitStatus('idle')} className="mt-8 text-blue-400 text-sm hover:text-white transition-colors">
            新しくメッセージを送る
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-3 tracking-widest font-en">NAME</label>
              <input type="text" required disabled={isSubmitting} className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50" placeholder="山田 太郎" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-3 tracking-widest font-en">EMAIL</label>
              <input type="email" required disabled={isSubmitting} className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50" placeholder="info@laruvisona.co.jp" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-3 tracking-widest font-en">MESSAGE</label>
            <textarea 
              rows={5} 
              required 
              disabled={isSubmitting}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors resize-none disabled:opacity-50" 
              placeholder="ご相談内容をご記入ください"
            ></textarea>
          </div>
          <div className="text-center pt-4">
            <button type="submit" disabled={isSubmitting} className="bg-white text-black font-bold py-4 px-12 rounded-full hover:bg-blue-500 hover:text-white transition-all duration-300 text-sm tracking-widest font-en disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : "SEND MESSAGE"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}