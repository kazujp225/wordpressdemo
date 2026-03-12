"use client";

import { useRef, useEffect } from 'react';

interface Props {
  htmlContent: string;
  className?: string;
}

export function AutoResizeIframe({ htmlContent, className = '' }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = doc.documentElement.scrollHeight;
        if (h > 100) iframe.style.height = h + 'px';

        // ResizeObserverで動的なコンテンツ変更に対応
        const observer = new ResizeObserver(() => {
          const newH = doc.documentElement.scrollHeight;
          if (newH > 100) iframe.style.height = newH + 'px';
        });
        observer.observe(doc.documentElement);
        return () => observer.disconnect();
      } catch {}
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [htmlContent]);

  // HTMLのbody margin:0を強制注入
  const wrappedHtml = htmlContent.includes('<head>')
    ? htmlContent.replace(
        '<head>',
        '<head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow-x:hidden}img{display:block;max-width:100%}</style>'
      )
    : `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;overflow-x:hidden}img{display:block;max-width:100%}</style></head><body>${htmlContent}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      className={`w-full border-0 ${className}`}
      style={{ minHeight: '100vh', width: '100%', display: 'block' }}
      sandbox="allow-same-origin"
      title="Embedded content"
    />
  );
}
