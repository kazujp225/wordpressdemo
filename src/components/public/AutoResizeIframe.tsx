"use client";

import { useRef, useEffect } from 'react';

interface Props {
  htmlContent: string;
  className?: string;
}

export function AutoResizeIframe({ htmlContent, className = '' }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // postMessageでiframe内部からの高さ通知を受信
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'iframe-resize' && typeof event.data.height === 'number') {
        const iframe = iframeRef.current;
        if (iframe && event.data.height > 100) {
          iframe.style.height = event.data.height + 'px';
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // iframe内部にリサイズスクリプトを注入（sandboxにallow-scriptsが必要）
  const resizeScript = `<script>
    function notifyHeight() {
      var h = document.documentElement.scrollHeight;
      parent.postMessage({ type: 'iframe-resize', height: h }, '*');
    }
    window.addEventListener('load', notifyHeight);
    new ResizeObserver(notifyHeight).observe(document.documentElement);
  <\/script>`;

  const wrappedHtml = htmlContent.includes('<head>')
    ? htmlContent.replace(
        '<head>',
        `<head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow-x:hidden}img{display:block;max-width:100%}</style>${resizeScript}`
      )
    : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow-x:hidden}img{display:block;max-width:100%}</style>${resizeScript}</head><body>${htmlContent}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      className={`w-full border-0 ${className}`}
      style={{ minHeight: '100vh', width: '100%', display: 'block' }}
      sandbox="allow-scripts"
      title="Embedded content"
    />
  );
}
