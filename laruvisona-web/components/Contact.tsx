'use client';

import { useEffect } from 'react';

export default function Contact() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.min.js';
    script.onload = () => {
      const fn = (window as unknown as Record<string, unknown>)['iFrameResize'];
      if (typeof fn === 'function') fn({ log: false, checkOrigin: false }, '#laru-contact-form');
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  return (
    <div className="bg-[#0a0a0a]/80 backdrop-blur-xl p-6 sm:p-8 md:p-12 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
      <div className="w-full text-left min-h-[300px]">
        <iframe
          id="laru-contact-form"
          src="https://larubot.tokyo/f/d51f2628-df7a-4776-8e58-67c9a453957f"
          width="100%"
          style={{ border: 'none', minHeight: '600px' }}
        />
      </div>
    </div>
  );
}
