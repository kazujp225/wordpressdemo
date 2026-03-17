"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, Check, Code2, Monitor, Smartphone, Loader2, ImagePlus, Send, Mail, Undo2, Redo2, ExternalLink, Globe, Sparkles, RotateCw, ChevronDown, ArrowRight, CheckCircle2, Circle, Zap, Search, AlertCircle, TrendingUp, Save, Rocket, Github, Server, FileCode, ArrowLeft } from 'lucide-react';
import type { DesignContext } from '@/lib/claude-templates';
import toast from 'react-hot-toast';

interface HtmlCodeEditModalProps {
  onClose: () => void;
  currentHtml: string;
  templateType?: string;
  originalPrompt?: string;
  designDefinition?: DesignContext | null;
  layoutMode: 'desktop' | 'responsive';
  onSave: (newHtml: string) => void | Promise<void>;
  pageSlug?: string;
  pageId?: string;
  pageTitle?: string;
  isLoadingHtml?: boolean;
}

type DeployPhase = 'idle' | 'generating' | 'uploading' | 'deploying' | 'done' | 'failed';

interface DeploymentInfo {
  id: number;
  serviceName: string;
  status: string;
  siteUrl?: string;
  githubRepoUrl?: string;
  errorMessage?: string;
}

interface UploadedImage {
  file: File;
  preview: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  suggestions?: string[];
}

type AgentStatus = 'idle' | 'diagnosing' | 'thinking' | 'generating' | 'updating' | 'done';

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: '',
  diagnosing: 'ページを分析中...',
  thinking: '考え中...',
  generating: '作成中...',
  updating: '反映中...',
  done: '完了',
};

function getStorageKey(templateType?: string, pageSlug?: string): string {
  return `html-edit-chat:${pageSlug || 'default'}:${templateType || 'none'}`;
}

// --- Interactive Preview: iframe注入スクリプト ---
function buildInteractivePreviewInjection(): string {
  return `
<style>
.lp-editor-highlight {
  border: 2px solid #3b82f6;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 4px;
  transition: all 0.2s;
  pointer-events: none;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}
.lp-editor-editable {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px;
  border-radius: 2px;
  background: rgba(59, 130, 246, 0.05) !important;
  cursor: text !important;
}
@keyframes lp-editor-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
.lp-editor-changed {
  outline: 2px solid #22c55e !important;
  outline-offset: 2px;
  border-radius: 2px;
  animation: lp-editor-pulse 0.8s ease-in-out 3;
}
</style>
<script>
(function(){
  function getSelector(el){
    if(!el||el===document.body||el===document.documentElement)return 'body';
    var parts=[];
    var cur=el;
    while(cur&&cur!==document.body&&cur!==document.documentElement){
      var tag=cur.tagName.toLowerCase();
      if(cur.id){parts.unshift('#'+cur.id);break;}
      var siblings=cur.parentElement?Array.from(cur.parentElement.children):[];
      if(siblings.length>1){
        var idx=siblings.indexOf(cur)+1;
        tag+=':nth-child('+idx+')';
      }
      parts.unshift(tag);
      cur=cur.parentElement;
    }
    return parts.join(' > ');
  }

  function getLabel(el){
    var tag=el.tagName.toLowerCase();
    var text=(el.textContent||'').trim().slice(0,20);
    var map={
      button:'このボタン',a:'このリンク',h1:'この見出し',h2:'この見出し',
      h3:'この見出し',h4:'この見出し',h5:'この見出し',h6:'この見出し',
      p:'このテキスト',img:'この画像',input:'この入力欄',form:'このフォーム',
      nav:'このナビゲーション',header:'このヘッダー',footer:'このフッター',
      section:'このセクション',ul:'このリスト',ol:'このリスト',li:'この項目',
      table:'このテーブル',video:'この動画',span:'このテキスト',div:'このエリア'
    };
    var label=map[tag]||'この要素';
    return text?label+'「'+text+'」':label;
  }

  var highlightEl=null;
  var currentEditEl=null;
  var originalText='';

  // シングルクリック → 要素選択
  document.addEventListener('click',function(e){
    if(currentEditEl)return;
    e.preventDefault();
    e.stopPropagation();
    var el=e.target;
    if(!el||el.className==='lp-editor-highlight')return;
    // 前のハイライトを消す
    if(highlightEl)highlightEl.remove();
    // ハイライトオーバーレイ
    var rect=el.getBoundingClientRect();
    highlightEl=document.createElement('div');
    highlightEl.className='lp-editor-highlight';
    highlightEl.style.cssText='position:absolute;pointer-events:none;z-index:99999;'+
      'top:'+(rect.top+window.scrollY)+'px;left:'+(rect.left+window.scrollX)+'px;'+
      'width:'+rect.width+'px;height:'+rect.height+'px;';
    document.body.appendChild(highlightEl);
    parent.postMessage({
      type:'element-clicked',
      tag:el.tagName.toLowerCase(),
      text:(el.textContent||'').trim().slice(0,50),
      selector:getSelector(el),
      label:getLabel(el)
    },'*');
  },true);

  // ダブルクリック → インライン編集
  var editTags=['h1','h2','h3','h4','h5','h6','p','span','a','li','button','td','th','label','strong','em'];
  document.addEventListener('dblclick',function(e){
    e.preventDefault();
    e.stopPropagation();
    var el=e.target;
    if(!el||!editTags.includes(el.tagName.toLowerCase()))return;
    if(currentEditEl)finishEdit();
    currentEditEl=el;
    originalText=el.textContent||'';
    el.contentEditable='true';
    el.classList.add('lp-editor-editable');
    el.focus();
    // テキスト全選択
    var range=document.createRange();
    range.selectNodeContents(el);
    var sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // ハイライト消す
    if(highlightEl){highlightEl.remove();highlightEl=null;}
    el.addEventListener('blur',finishEdit);
    el.addEventListener('keydown',handleEditKey);
  },true);

  function finishEdit(){
    if(!currentEditEl)return;
    var el=currentEditEl;
    currentEditEl=null;
    el.contentEditable='false';
    el.classList.remove('lp-editor-editable');
    el.removeEventListener('blur',finishEdit);
    el.removeEventListener('keydown',handleEditKey);
    var newText=el.textContent||'';
    if(newText!==originalText){
      parent.postMessage({
        type:'inline-edit',
        oldText:originalText,
        newText:newText
      },'*');
    }
  }
  function handleEditKey(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishEdit();}
    if(e.key==='Escape'){currentEditEl.textContent=originalText;finishEdit();}
  }

  // 変更ハイライト受信
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='highlight-changes'&&Array.isArray(e.data.selectors)){
      e.data.selectors.forEach(function(sel){
        try{
          var el=document.querySelector(sel);
          if(el){
            el.classList.add('lp-editor-changed');
            setTimeout(function(){el.classList.remove('lp-editor-changed');},3000);
          }
        }catch(err){}
      });
    }
  });
})();
</script>`;
}

// iframe srcDocにインタラクティブスクリプトを注入
function injectInteractiveScript(html: string): string {
  const injection = buildInteractivePreviewInjection();
  if (html.includes('</body>')) return html.replace('</body>', injection + '</body>');
  if (html.includes('</html>')) return html.replace('</html>', injection + '</html>');
  return html + injection;
}

// 2つのHTMLを比較して変更された要素のセレクタを返す
function diffHtmlSelectors(oldHtml: string, newHtml: string): string[] {
  try {
    const parser = new DOMParser();
    const oldDoc = parser.parseFromString(oldHtml, 'text/html');
    const newDoc = parser.parseFromString(newHtml, 'text/html');
    const changed: string[] = [];
    const semanticTags = new Set(['H1','H2','H3','H4','H5','H6','P','BUTTON','A','LI','SPAN','TD','TH','LABEL','IMG','INPUT','STRONG','EM']);

    function buildSel(el: Element, doc: Document): string {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== doc.body && cur !== doc.documentElement) {
        let tag = cur.tagName.toLowerCase();
        if (cur.id) { parts.unshift('#' + cur.id); break; }
        const siblings = cur.parentElement ? Array.from(cur.parentElement.children) : [];
        if (siblings.length > 1) {
          const idx = siblings.indexOf(cur) + 1;
          tag += ':nth-child(' + idx + ')';
        }
        parts.unshift(tag);
        cur = cur.parentElement;
      }
      return parts.join(' > ');
    }

    function walk(oldEl: Element, newEl: Element) {
      if (semanticTags.has(newEl.tagName)) {
        if (oldEl.innerHTML !== newEl.innerHTML) {
          changed.push(buildSel(newEl, newDoc));
        }
        return;
      }
      const oldC = Array.from(oldEl.children);
      const newC = Array.from(newEl.children);
      const len = Math.max(oldC.length, newC.length);
      for (let i = 0; i < len; i++) {
        if (!oldC[i] && newC[i]) {
          changed.push(buildSel(newC[i], newDoc));
        } else if (oldC[i] && newC[i]) {
          walk(oldC[i], newC[i]);
        }
      }
    }

    walk(oldDoc.body, newDoc.body);
    return changed.slice(0, 30);
  } catch {
    return [];
  }
}

// HTML構文ハイライト（簡易版）
function colorizeHtml(line: string): React.ReactNode {
  // タグ、属性、文字列、コメントを色分け
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  while (remaining.length > 0) {
    // HTMLコメント
    const commentMatch = remaining.match(/^(<!--[\s\S]*?-->)/);
    if (commentMatch) {
      parts.push(<span key={key++} style={{ color: '#545d68' }}>{commentMatch[1]}</span>);
      remaining = remaining.slice(commentMatch[1].length);
      continue;
    }

    // HTMLタグ
    const tagMatch = remaining.match(/^(<\/?)([\w-]+)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*)(\/?>)/);
    if (tagMatch) {
      parts.push(<span key={key++} style={{ color: '#8b949e' }}>{tagMatch[1]}</span>);
      parts.push(<span key={key++} style={{ color: '#7ee787' }}>{tagMatch[2]}</span>);
      // 属性部分
      const attrStr = tagMatch[3];
      if (attrStr) {
        const attrParts = attrStr.replace(/([\w-]+)(=)("[^"]*"|'[^']*')/g, (_m, name: string, eq: string, val: string) => {
          return `\x01${name}\x02${eq}\x03${val}\x04`;
        });
        const attrTokens = attrParts.split(/(\x01.*?\x04)/);
        attrTokens.forEach(t => {
          const attrMatch2 = t.match(/\x01(.*?)\x02(.*?)\x03(.*?)\x04/);
          if (attrMatch2) {
            parts.push(<span key={key++} style={{ color: '#79c0ff' }}> {attrMatch2[1]}</span>);
            parts.push(<span key={key++} style={{ color: '#8b949e' }}>{attrMatch2[2]}</span>);
            parts.push(<span key={key++} style={{ color: '#a5d6ff' }}>{attrMatch2[3]}</span>);
          } else if (t.trim()) {
            parts.push(<span key={key++} style={{ color: '#79c0ff' }}>{t}</span>);
          }
        });
      }
      parts.push(<span key={key++} style={{ color: '#8b949e' }}>{tagMatch[4]}</span>);
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }

    // CSS プロパティ（style内）
    const cssMatch = remaining.match(/^([\w-]+)(\s*:\s*)([^;{]+)(;?)/);
    if (cssMatch && (line.includes('{') || line.includes(';') || line.trimStart().match(/^[\w-]+\s*:/))) {
      parts.push(<span key={key++} style={{ color: '#79c0ff' }}>{cssMatch[1]}</span>);
      parts.push(<span key={key++} style={{ color: '#8b949e' }}>{cssMatch[2]}</span>);
      parts.push(<span key={key++} style={{ color: '#a5d6ff' }}>{cssMatch[3]}</span>);
      parts.push(<span key={key++} style={{ color: '#8b949e' }}>{cssMatch[4]}</span>);
      remaining = remaining.slice(cssMatch[0].length);
      continue;
    }

    // その他の文字（1文字ずつ進める）
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return <>{parts}</>;
}

export default function HtmlCodeEditModal({
  onClose,
  currentHtml,
  templateType,
  designDefinition,
  layoutMode,
  onSave,
  pageSlug,
  pageId,
  pageTitle,
  isLoadingHtml = false,
}: HtmlCodeEditModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modifiedHtml, setModifiedHtml] = useState(currentHtml);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');

  // IME変換中フラグ
  const isComposingRef = useRef(false);

  // デプロイ状態
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [deployPhase, setDeployPhase] = useState<DeployPhase>('idle');
  const [deployServiceName, setDeployServiceName] = useState('');
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null);
  const [deployError, setDeployError] = useState('');
  const [settingsReady, setSettingsReady] = useState<boolean | null>(null);
  const deployPollRef = useRef<NodeJS.Timeout | null>(null);

  // 診断
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [diagnosisRecommendations, setDiagnosisRecommendations] = useState<{ title: string; prompt: string; reason: string }[]>([]);
  const [diagnosisDone, setDiagnosisDone] = useState(false);

  // Undo/Redo
  const [htmlHistory, setHtmlHistory] = useState<string[]>([currentHtml]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // チャット
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // インタラクティブプレビュー
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedElement, setSelectedElement] = useState<{ tag: string; text: string; label: string } | null>(null);
  const [changedSelectors, setChangedSelectors] = useState<string[]>([]);

  // currentHtml propが後から更新された場合（バックグラウンドフェッチ完了時）にmodifiedHtmlを同期
  const userHasEditedRef = useRef(false);
  const prevCurrentHtmlRef = useRef(currentHtml);

  useEffect(() => {
    // propが変わった場合のみ（バックグラウンドフェッチ完了時）
    if (currentHtml !== prevCurrentHtmlRef.current) {
      prevCurrentHtmlRef.current = currentHtml;
      // ユーザーがまだ編集していない場合のみ更新
      if (!userHasEditedRef.current) {
        setModifiedHtml(currentHtml);
        setHtmlHistory([currentHtml]);
        setHistoryIndex(0);
        setHasChanges(false);
      }
    }
  }, [currentHtml]); // eslint-disable-line react-hooks/exhaustive-deps

  // 会話復元
  useEffect(() => {
    try {
      const key = getStorageKey(templateType, pageSlug);
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {}
  }, [templateType, pageSlug]);

  // 会話保存
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const key = getStorageKey(templateType, pageSlug);
      localStorage.setItem(key, JSON.stringify(messages));
    } catch {}
  }, [messages, templateType, pageSlug]);

  // --- インタラクティブプレビュー: iframeからのメッセージ受信 ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      if (!data?.type) return;

      if (data.type === 'element-clicked') {
        // 要素クリック → チャット入力に自動セット
        setSelectedElement({ tag: data.tag, text: data.text, label: data.label });
        setInputText(data.label + 'を');
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (data.type === 'inline-edit') {
        // ダブルクリック直接編集 → HTMLを更新
        if (data.oldText && data.newText && data.oldText !== data.newText) {
          setModifiedHtml(prev => {
            const updated = prev.replace(data.oldText, data.newText);
            if (updated !== prev) {
              setHtmlHistory(h => [...h.slice(0, historyIndex + 1), updated]);
              setHistoryIndex(i => i + 1);
              setHasChanges(true);
              // 自動保存
              try { const r = onSave(updated); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch {}
              toast.success('テキストを更新しました');
            }
            return updated;
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [historyIndex, onSave]);

  const pushHtmlHistory = useCallback((newHtml: string) => {
    setHtmlHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newHtml];
    });
    setHistoryIndex(prev => prev + 1);
    setModifiedHtml(newHtml);
    setHasChanges(true);
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < htmlHistory.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setModifiedHtml(htmlHistory[newIndex]);
    setHasChanges(htmlHistory[newIndex] !== currentHtml);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setModifiedHtml(htmlHistory[newIndex]);
    setHasChanges(htmlHistory[newIndex] !== currentHtml);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) continue;
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    }
    setUploadedImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // URL検出: テキストがURLのみ or URLで始まる場合
  const detectUrl = (text: string): string | null => {
    const urlMatch = text.match(/^(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[1] : null;
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && uploadedImages.length === 0) return;
    userHasEditedRef.current = true;

    // URL検出: URLのみの入力の場合、HTMLを取得してプレビューに表示
    const detectedUrl = detectUrl(text);
    if (detectedUrl && text === detectedUrl) {
      const userMessage: ChatMessage = { role: 'user', content: text };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsGenerating(true);
      setAgentStatus('thinking');

      try {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: detectedUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            const prevHtml = modifiedHtml;
            pushHtmlHistory(data.html);
            try { const r = onSave(data.html); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch {}
            // 変更箇所ハイライト
            const diffs = diffHtmlSelectors(prevHtml, data.html);
            if (diffs.length > 0) { setChangedSelectors(diffs); setTimeout(() => setChangedSelectors([]), 4000); }
            setAgentStatus('done');
            setTimeout(() => setAgentStatus('idle'), 2000);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `${detectedUrl} のHTMLを取得しました。プレビューに表示しています。\n\nこのページをベースに編集できます。何をしますか？`,
              suggestions: ['ヘッダーを追加する', 'お問い合わせフォームを追加する', 'デザインを改善する'],
            }]);
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: 'HTMLの取得に失敗しました。' }]);
          }
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'URLの取得に失敗しました。URLが正しいか確認してください。' }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: '接続エラーが発生しました。' }]);
      } finally {
        setIsGenerating(false);
        setAgentStatus('idle');
      }
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      images: uploadedImages.map(img => img.preview),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);
    setStreamingText('');
    setAgentStatus('thinking');

    try {
      let imageUrls: string[] = [];
      if (uploadedImages.length > 0) {
        for (const img of uploadedImages) {
          const formData = new FormData();
          formData.append('file', img.file);
          const uploadRes = await fetch('/api/upload-temp-image', { method: 'POST', body: formData });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.url) imageUrls.push(uploadData.url);
          }
        }
      }
      setUploadedImages([]);

      let finalPrompt = text;
      if (imageUrls.length > 0) {
        finalPrompt += `\n\n【使用する画像URL】\n`;
        imageUrls.forEach((url, i) => { finalPrompt += `画像${i + 1}: ${url}\n`; });
      }

      const chatHistory = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: finalPrompt },
      ];

      // ステータスを段階的に進行
      setTimeout(() => setAgentStatus('generating'), 1500);

      const response = await fetch('/api/ai/claude-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          currentHtml: modifiedHtml,
          layoutMode,
          designContext: designDefinition || null,
          templateType,
          mode: 'edit',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAgentStatus('idle');
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `エラー: ${data.message || '修正に失敗しました'}`,
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullStreamText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'text') {
              fullStreamText += data.text;
              setStreamingText(fullStreamText);
              // HTMLが生成され始めたらステータス更新
              if (fullStreamText.includes('```html') || fullStreamText.includes('<!DOCTYPE')) {
                setAgentStatus('generating');
              }
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            } else if (data.type === 'done') {
              setStreamingText('');
              setAgentStatus('updating');

              if (data.html) {
                const prevHtml = modifiedHtml;
                pushHtmlHistory(data.html);
                // AI変更後に自動保存
                try { const r = onSave(data.html); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch {}
                // 変更箇所ハイライト
                const diffs = diffHtmlSelectors(prevHtml, data.html);
                if (diffs.length > 0) { setChangedSelectors(diffs); setTimeout(() => setChangedSelectors([]), 4000); }
              }

              setTimeout(() => {
                setAgentStatus('done');
                setTimeout(() => setAgentStatus('idle'), 2000);
              }, 500);

              let assistantContent = data.message || '変更を適用しました。';
              if (data.estimatedCost) {
                const credits = Math.ceil(data.estimatedCost * 1500);
                assistantContent += `\n\n消費: ${credits.toLocaleString()}クレジット`;
              }
              const successMsg: ChatMessage = {
                role: 'assistant',
                content: assistantContent,
                suggestions: data.suggestions,
              };
              setMessages(prev => [...prev, successMsg]);
            } else if (data.type === 'error') {
              setStreamingText('');
              setAgentStatus('idle');
              const errorMsg: ChatMessage = {
                role: 'assistant',
                content: `エラー: ${data.message}`,
              };
              setMessages(prev => [...prev, errorMsg]);
            }
          } catch {}
        }
      }

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      setStreamingText('');
      setAgentStatus('idle');
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: '接続エラーが発生しました。',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enterキーでは送信しない（送信ボタンのみ）
    // Shift+Enterで改行
  };

  // フォローアップ提案クリック: inputTextを経由せず直接送信
  const pendingSuggestionRef = useRef<string | null>(null);
  const handleSuggestionClick = (suggestion: string) => {
    pendingSuggestionRef.current = suggestion;
    setInputText(suggestion);
  };

  // pendingSuggestionが設定されたら即送信
  useEffect(() => {
    if (pendingSuggestionRef.current && inputText === pendingSuggestionRef.current) {
      pendingSuggestionRef.current = null;
      handleSend();
    }
  }, [inputText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    navigator.clipboard.writeText(modifiedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFullPreview = () => {
    const blob = new Blob([modifiedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(modifiedHtml);
      toast.success('保存しました');
      setHasChanges(false);
    } catch (error) {
      toast.error('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndDeploy = async () => {
    setIsDeploying(true);
    try {
      await onSave(modifiedHtml);
      setHasChanges(false);
      if (pageId && pageId !== 'new') {
        const res = await fetch(`/api/pages/${pageId}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'webhook' }),
        });
        if (res.ok) {
          toast.success('保存して公開しました');
        } else {
          toast.success('保存しました（公開に失敗）');
        }
      } else {
        toast.success('保存しました');
      }
    } catch (error) {
      toast.error('保存に失敗しました');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleReset = () => {
    setModifiedHtml(currentHtml);
    setHasChanges(false);
    setMessages([]);
    setHtmlHistory([currentHtml]);
    setHistoryIndex(0);
    setStreamingText('');
    setAgentStatus('idle');
    try {
      const key = getStorageKey(templateType, pageSlug);
      localStorage.removeItem(key);
    } catch {}
    toast.success('リセットしました');
  };

  // --- デプロイ機能 ---
  useEffect(() => {
    if (showDeployPanel && settingsReady === null) {
      fetch('/api/user/settings')
        .then(res => res.json())
        .then(data => setSettingsReady(!!data.hasRenderApiKey && !!data.hasGithubToken))
        .catch(() => setSettingsReady(false));
    }
  }, [showDeployPanel, settingsReady]);

  useEffect(() => {
    if (showDeployPanel && !deployServiceName && pageTitle) {
      const sanitized = (pageTitle || 'my-page')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 30);
      setDeployServiceName(sanitized || 'my-page');
    }
  }, [showDeployPanel, pageTitle, deployServiceName]);

  useEffect(() => {
    return () => {
      if (deployPollRef.current) clearInterval(deployPollRef.current);
    };
  }, []);

  const handleDeploy = async () => {
    if (!deployServiceName.trim()) {
      toast.error('サイト名を入力してください');
      return;
    }

    // まず保存
    try {
      await onSave(modifiedHtml);
      setHasChanges(false);
    } catch {
      toast.error('保存に失敗しました');
      return;
    }

    setDeployPhase('uploading');
    setDeployError('');

    try {
      // ページ全体のHTMLを取得（画像LP＋AI生成コード含む）
      let deployHtml = modifiedHtml;
      if (pageId) {
        try {
          const fullPageRes = await fetch(`/api/pages/${pageId}/deploy-html`);
          if (fullPageRes.ok) {
            const fullPageData = await fullPageRes.json();
            if (fullPageData?.html) deployHtml = fullPageData.html;
          }
        } catch {}
      }

      const deployRes = await fetch('/api/deploy/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: deployHtml,
          serviceName: deployServiceName.trim(),
          templateType: templateType || 'editor-deploy',
          prompt: `Editor deploy: ${pageTitle || 'page'}`,
          pageId: pageId ? parseInt(pageId) : undefined,
        }),
      });

      const data = await deployRes.json();
      if (!deployRes.ok) throw new Error(data.message || 'デプロイに失敗しました');

      setDeployPhase('deploying');
      setDeploymentInfo(data.deployment);

      // ポーリング開始
      if (deployPollRef.current) clearInterval(deployPollRef.current);
      const pollStart = Date.now();
      deployPollRef.current = setInterval(async () => {
        if (Date.now() - pollStart > 5 * 60 * 1000) {
          setDeployPhase('failed');
          setDeployError('タイムアウトしました');
          if (deployPollRef.current) clearInterval(deployPollRef.current);
          return;
        }
        try {
          const res = await fetch(`/api/deploy/${data.deployment.id}`);
          if (res.ok) {
            const status = await res.json();
            setDeploymentInfo(prev => prev ? { ...prev, ...status } : status);
            if (status.status === 'live') {
              setDeployPhase('done');
              if (deployPollRef.current) clearInterval(deployPollRef.current);
            } else if (status.status === 'failed') {
              setDeployPhase('failed');
              setDeployError(status.errorMessage || 'ビルドに失敗しました');
              if (deployPollRef.current) clearInterval(deployPollRef.current);
            }
          }
        } catch {}
      }, 4000);
    } catch (error: any) {
      setDeployPhase('failed');
      setDeployError(error.message || 'デプロイに失敗しました');
    }
  };

  // 自動ページ診断
  const runDiagnosis = useCallback(async () => {
    // 空テンプレートの場合は診断しない
    if (!modifiedHtml || modifiedHtml.includes('<body>\n\n</body>')) return;

    setIsDiagnosing(true);
    setAgentStatus('diagnosing');
    setDiagnosisText('');

    try {
      const response = await fetch('/api/ai/claude-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'このページのCV導線を診断してください。' }],
          currentHtml: modifiedHtml,
          layoutMode,
          designContext: designDefinition || null,
          mode: 'diagnose',
        }),
      });

      if (!response.ok) {
        setIsDiagnosing(false);
        setAgentStatus('idle');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              fullText += data.text;
              // [RECOMMEND]タグを除外して表示
              setDiagnosisText(fullText.replace(/\[RECOMMEND\][\s\S]*?\[\/RECOMMEND\]/g, '').replace(/\[RECOMMEND\][\s\S]*$/, ''));
            } else if (data.type === 'done') {
              if (data.recommendations && data.recommendations.length > 0) {
                setDiagnosisRecommendations(data.recommendations);
              }
              setDiagnosisText(data.message || fullText);
              setDiagnosisDone(true);
              setAgentStatus('done');
              setTimeout(() => setAgentStatus('idle'), 2000);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
    } finally {
      setIsDiagnosing(false);
    }
  }, [modifiedHtml, layoutMode, designDefinition]);

  // エディタ起動時に自動診断
  // 自動診断は無効化（クレジット消費を防止）
  // 必要な場合はユーザーが手動で診断を実行できる
  const diagnosisRan = useRef(false);

  // フォーム有効化
  const handleEnableFormSubmission = async () => {
    if (!pageSlug) { toast.error('ページ情報が取得できません'); return; }
    setIsGenerating(true);
    setAgentStatus('thinking');
    try {
      const formPrompt = `このHTMLフォームを有効化してください。
formタグにJavaScriptでフォーム送信処理を追加。送信先は /api/form-submissions (POST)。
送信データはJSON形式: { "pageSlug": "${pageSlug}", "formTitle": "お問い合わせ", "formFields": [{ "fieldName": "name", "fieldLabel": "お名前", "value": "入力値" }] }
送信成功時は「送信完了しました」表示、失敗時はエラーメッセージ、送信中はボタン無効化。
元のデザインは一切変更せず、スクリプトを</body>前に追加。`;

      setTimeout(() => setAgentStatus('generating'), 1000);

      const response = await fetch('/api/ai/claude-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: formPrompt }],
          currentHtml: modifiedHtml,
          layoutMode,
          designContext: designDefinition || null,
          templateType,
          mode: 'edit',
        }),
      });
      const data = await response.json();
      if (!response.ok) { toast.error(data.message || 'フォーム有効化に失敗しました'); setAgentStatus('idle'); return; }
      setAgentStatus('updating');
      if (data.html) {
        const prevHtml = modifiedHtml;
        pushHtmlHistory(data.html); try { const r = onSave(data.html); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch {}
        const diffs = diffHtmlSelectors(prevHtml, data.html);
        if (diffs.length > 0) { setChangedSelectors(diffs); setTimeout(() => setChangedSelectors([]), 4000); }
      }
      setTimeout(() => { setAgentStatus('done'); setTimeout(() => setAgentStatus('idle'), 2000); }, 500);
      toast.success('フォームを有効化しました');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'フォームを有効化しました。送信データは管理画面で確認できます。',
      }]);
    } catch (error) {
      toast.error('フォーム有効化に失敗しました');
      setAgentStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  // コスト見積もり（Claude Haiku 4.5, 50%減価適用後）
  // Input: $0.80/1M tokens, Output: $4.00/1M tokens × 0.5
  const estimateCost = useCallback((promptLength: number = 100) => {
    // トークン推定: 日本語は約2文字=1トークン、英語/HTMLは約4文字=1トークン
    const htmlTokens = Math.ceil(modifiedHtml.length / 3); // HTML混在
    const systemTokens = 500; // システムプロンプト
    const promptTokens = Math.ceil(promptLength / 2); // ユーザー入力(日本語)
    const chatHistoryTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 3), 0);
    const inputTokens = systemTokens + htmlTokens + promptTokens + chatHistoryTokens;
    const outputTokens = htmlTokens + 200; // 出力はHTML＋説明文

    const rawCost = (inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4.00;
    return rawCost * 0.5; // 50%減価
  }, [modifiedHtml, messages]);

  // クレジット換算（1 USD = 150円 × 10クレジット/円 = 1,500クレジット）
  const formatCostCredits = (usd: number) => {
    const credits = Math.ceil(usd * 1500);
    if (credits < 1) return '1クレジット未満';
    return `約${credits.toLocaleString()}クレジット`;
  };

  // Quick actions — フルスタックLP制作アクション
  const suggestions = [
    { icon: '🚀', label: 'LP一括生成', description: 'プロ品質のLPを丸ごと作成', prompt: 'プロ品質のランディングページを一括生成してください。ヘッダー（sticky、ロゴ+CTAボタン）、ヒーロー（全幅背景+キャッチコピー+CTA）、特徴セクション（3カラム）、お客様の声、料金表、FAQ、お問い合わせフォーム、フッターを含む完全なLPを作ってください。モダンで洗練されたデザインにしてください。' },
    { icon: '📋', label: 'お問い合わせフォーム', description: 'フォーム送信+バリデーション付き', prompt: 'お問い合わせフォームのセクションを追加してください。お名前、メールアドレス、電話番号、お問い合わせ内容のフィールドを含め、必須マーク付き、バリデーション付きの見やすいデザインにしてください。送信ボタンは大きく目立つように。' },
    { icon: '🎯', label: 'ヘッダー + CTA', description: 'sticky追従ヘッダー+ボタン', prompt: 'stickyヘッダーを追加してください。ロゴテキスト、ナビゲーションリンク、目立つCTAボタンを含めてください。スクロール時に半透明背景になり、モバイルではハンバーガーメニューに切り替わるようにしてください。' },
    { icon: '💰', label: '料金表', description: '3プラン比較テーブル', prompt: '料金プランの比較表セクションを追加してください。3プラン（ベーシック/スタンダード/プレミアム）を横並びカードで表示し、おすすめプランを強調してください。各プランに機能リスト、価格、CTAボタンを含めてください。' },
    { icon: '⭐', label: 'お客様の声', description: 'レビューカード3枚', prompt: '「お客様の声」セクションを追加してください。3つのレビューカードを横並びに配置し、写真（プレースホルダー）、名前、会社名、評価（星5つ）、コメントを含めてください。' },
    { icon: '❓', label: 'FAQ', description: 'アコーディオン形式', prompt: 'よくある質問（FAQ）のアコーディオンセクションを追加してください。5つのQ&Aを含め、クリックで開閉できるようにしてください。JavaScriptは最小限でCSSアニメーション付きにしてください。' },
    { icon: '✨', label: 'アニメーション追加', description: 'スクロール連動フェードイン', prompt: 'スクロール連動のフェードインアニメーションとボタンのホバーエフェクトを追加してください。CSS＋最小限のJSで実装してください。' },
    { icon: '📱', label: 'モバイル最適化', description: 'レスポンシブ完全対応', prompt: 'モバイル表示を改善してください。全セクションを画面幅100%で表示し、タップしやすいボタンサイズ(48px以上)、読みやすいフォントサイズ(16px以上)、適切な余白にしてください。' },
  ];

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#f5f5f0] flex">

      {/* ===== Left: Chat Panel ===== */}
      <div className="w-[440px] flex flex-col bg-white border-r border-gray-200/80">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="編集画面に戻る"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-gray-900">LP制作エージェント</h2>
              {agentStatus !== 'idle' && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[11px] text-green-600 font-medium">{STATUS_LABELS[agentStatus]}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasChanges && (
              <button onClick={handleReset} className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg transition-colors" title="リセット">
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-start px-5 py-6 overflow-y-auto">

              {/* 診断中のローディング */}
              {isDiagnosing && !diagnosisText && (
                <div className="w-full flex flex-col items-center justify-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                    <Search className="h-7 w-7 text-blue-400 animate-pulse" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">ページを診断中...</h3>
                  <p className="text-sm text-gray-400">CV導線と改善ポイントを分析しています</p>
                  <div className="flex gap-1 mt-4">
                    <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {/* 診断結果 */}
              {diagnosisText && (
                <>
                  <div className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                        <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900">ページ診断結果</span>
                      {diagnosisDone && (
                        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">完了</span>
                      )}
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {diagnosisText}
                      {isDiagnosing && <span className="inline-block w-1.5 h-4 bg-blue-400/50 animate-pulse ml-0.5 align-middle rounded-sm" />}
                    </div>
                  </div>

                  {/* 推奨アクション */}
                  {diagnosisRecommendations.length > 0 && (
                    <div className="w-full mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <span className="text-[13px] font-semibold text-gray-900">推奨アクション</span>
                      </div>
                      <div className="space-y-2">
                        {diagnosisRecommendations.map((rec, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setInputText(rec.prompt);
                              setTimeout(() => {
                                inputRef.current?.focus();
                                // 自動送信: ユーザーが推奨アクションを選んだら即実行
                              }, 100);
                            }}
                            className="w-full flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-all group"
                          >
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium text-gray-800 group-hover:text-emerald-700 block">{rec.title}</span>
                              <span className="text-[11px] text-gray-400 block mt-0.5">{rec.reason}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 flex-shrink-0 mt-1 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* フォーム有効化 */}
                  {pageSlug && diagnosisDone && (
                    <button
                      onClick={handleEnableFormSubmission}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-sm text-gray-500 hover:text-gray-700 transition-all disabled:opacity-40"
                    >
                      {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> 処理中...</> : <><Mail className="h-4 w-4" /> フォームを有効化</>}
                    </button>
                  )}
                </>
              )}

              {/* 空ページ — Manus風の案内 + クイックアクション */}
              {!isDiagnosing && !diagnosisText && (
                <div className="w-full flex flex-col py-8 px-2">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-900 mb-1">LP制作エージェント</h3>
                    <p className="text-[12px] text-gray-400 leading-relaxed">
                      プロ品質のLPを自律的に作成・編集します
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {suggestions.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:bg-gray-50 text-left transition-all group"
                      >
                        <span className="text-base flex-shrink-0">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900 block">{s.label}</span>
                          <span className="text-[11px] text-gray-400 block">{s.description}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {suggestions.slice(4).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-300 text-[11px] text-gray-500 hover:text-gray-700 transition-all"
                      >
                        <span>{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 px-2">
                    <p className="text-[11px] text-gray-300 text-center">URLを入力するとページを取り込めます</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-black text-white px-4 py-2.5 rounded-2xl rounded-br-md text-[13px] leading-relaxed">
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg.images.map((img, i) => (
                              <img key={i} src={img} alt="" className="h-14 w-14 object-cover rounded-lg" />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[90%]">
                        <div className="bg-gray-50 border border-gray-100 text-gray-700 px-4 py-2.5 rounded-2xl rounded-bl-md text-[13px] leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {/* Follow-up Suggestions */}
                        {msg.suggestions && msg.suggestions.length > 0 && idx === messages.length - 1 && !isGenerating && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.suggestions.map((suggestion, i) => (
                              <button
                                key={i}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-[12px] text-gray-600 font-medium transition-all"
                              >
                                <ArrowRight className="h-3 w-3 text-gray-400" />
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming */}
              {isGenerating && streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="bg-gray-50 border border-gray-100 text-gray-600 px-4 py-2.5 rounded-2xl rounded-bl-md text-[13px]">
                      <p className="whitespace-pre-wrap">{streamingText.replace(/\[SUGGEST\][\s\S]*?\[\/SUGGEST\]/g, '').replace(/\[SUGGEST\][\s\S]*$/, '')}</p>
                      <span className="inline-block w-1.5 h-4 bg-black/30 animate-pulse ml-0.5 align-middle rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              {isGenerating && !streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Image Preview */}
        {uploadedImages.length > 0 && (
          <div className="px-5 py-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {uploadedImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img.preview} alt="" className="h-14 w-14 object-cover rounded-xl border border-gray-200" />
                  <button onClick={() => handleRemoveImage(index)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100">
          {/* 選択された要素の表示 */}
          {selectedElement && (
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {selectedElement.label}
                <button
                  onClick={() => { setSelectedElement(null); setInputText(''); }}
                  className="ml-1 p-0.5 hover:bg-blue-100 rounded transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <span className="text-[11px] text-gray-400">← プレビューで選択中</span>
            </div>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-gray-300 focus-within:bg-white transition-all">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              placeholder="ご要望を入力してください..."
              rows={1}
              className="w-full px-4 pt-3 pb-1 bg-transparent text-[13px] text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="画像を添付"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                {inputText.trim() && (
                  <span className="text-[10px] text-gray-300 whitespace-nowrap">
                    {formatCostCredits(estimateCost(inputText.length))}
                  </span>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={isGenerating || (!inputText.trim() && uploadedImages.length === 0)}
                className="p-2 bg-black hover:bg-gray-800 text-white rounded-xl disabled:opacity-15 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Save / Deploy Footer - 常時表示 */}
        <div className="px-4 pb-3 pt-1 flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中</> : <><Save className="h-3.5 w-3.5" /> 保存</>}
          </button>
          <button
            onClick={() => setShowDeployPanel(true)}
            className="flex-1 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-[13px] font-medium transition-all flex items-center justify-center gap-1.5"
          >
            <Rocket className="h-3.5 w-3.5" /> 公開
          </button>
        </div>
      </div>

      {/* ===== Right: Computer View ===== */}
      <div className="flex-1 flex flex-col">

        {/* Computer Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#e8e8e3] border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            {/* Window Controls */}
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] hover:brightness-110 transition" />
              <div className="w-3.5 h-3.5 rounded-full bg-[#febc2e]" />
              <button onClick={handleFullPreview} className="w-3.5 h-3.5 rounded-full bg-[#28c840] hover:brightness-110 transition" />
            </div>
            <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">Computer</span>
          </div>

          {/* URL Bar */}
          <div className="flex-1 mx-6">
            <div className="flex items-center gap-2 bg-white/80 rounded-lg px-4 py-2 max-w-lg mx-auto border border-gray-200/50">
              {agentStatus !== 'idle' ? (
                <Loader2 className="h-4 w-4 text-gray-300 animate-spin flex-shrink-0" />
              ) : (
                <Globe className="h-4 w-4 text-gray-300 flex-shrink-0" />
              )}
              <span className="text-sm text-gray-400 truncate">
                {pageSlug ? `${pageSlug}.zettai.co.jp` : 'preview'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            {/* Device Toggle */}
            <div className="flex items-center bg-white/60 rounded-lg p-1 border border-gray-200/50">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-2 rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Monitor className="h-[18px] w-[18px]" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-2 rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Smartphone className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all disabled:opacity-20" title="元に戻す">
                <Undo2 className="h-[18px] w-[18px]" />
              </button>
              <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all disabled:opacity-20" title="やり直す">
                <Redo2 className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300/50 mx-1.5" />

            <button
              onClick={() => setShowCode(!showCode)}
              className={`p-2 rounded-md transition-all ${showCode ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500 hover:bg-white/60'}`}
              title="コードを表示"
            >
              <Code2 className="h-[18px] w-[18px]" />
            </button>
            <button onClick={handleCopy} className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-white/60 transition-all" title="コピー">
              {copied ? <Check className="h-[18px] w-[18px] text-green-500" /> : <Copy className="h-[18px] w-[18px]" />}
            </button>
            <button onClick={handleFullPreview} className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-white/60 transition-all" title="新しいタブで開く">
              <ExternalLink className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-[#e8e8e3] flex items-start justify-center p-3 relative">
          {showCode ? (
            <div className="w-full h-full rounded-lg overflow-auto bg-[#1e1e1e] shadow-xl">
              <pre className="p-5 text-[12px] leading-relaxed font-mono text-gray-300">
                <code>{modifiedHtml}</code>
              </pre>
            </div>
          ) : isLoadingHtml ? (
            <div
              className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all flex items-center justify-center ${previewDevice === 'mobile' ? 'w-[375px]' : 'w-full'}`}
              style={{ minHeight: 'calc(100vh - 80px)' }}
            >
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">ページを読み込み中...</p>
              </div>
            </div>
          ) : (
            <div
              className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all ${previewDevice === 'mobile' ? 'w-[375px]' : 'w-full'}`}
              style={{ minHeight: 'calc(100vh - 80px)' }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={injectInteractiveScript(modifiedHtml)}
                className="w-full border-0"
                style={{ height: 'calc(100vh - 80px)' }}
                sandbox="allow-scripts allow-forms"
                title="Preview"
                onLoad={() => {
                  if (changedSelectors.length > 0) {
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: 'highlight-changes', selectors: changedSelectors }, '*'
                    );
                  }
                }}
              />
            </div>
          )}

          {/* コード生成アニメーション — ストリーミング中にオーバーレイ表示 */}
          {isGenerating && streamingText && (() => {
            // ストリーミングテキストからHTMLコード部分を抽出
            const codeMatch = streamingText.match(/```html\s*([\s\S]*)/);
            const liveCode = codeMatch ? codeMatch[1].replace(/```\s*$/, '') : null;
            if (!liveCode) return null;

            const lines = liveCode.split('\n');
            const visibleLines = lines.slice(-35); // 最新35行を表示
            const startLine = Math.max(1, lines.length - 35 + 1);

            return (
              <div className="absolute inset-3 rounded-lg overflow-hidden shadow-2xl z-10 flex flex-col" style={{ background: '#0d1117' }}>
                {/* エディタヘッダー */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5" style={{ background: '#161b22' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                      <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                      <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="text-[11px] text-gray-500 ml-2 font-mono">index.html</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#1f6feb20', color: '#58a6ff' }}>
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      生成中...
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono">{lines.length} lines</span>
                  </div>
                </div>
                {/* コード表示 */}
                <div className="flex-1 overflow-hidden font-mono text-[12px] leading-[1.7]">
                  <div className="p-4">
                    {visibleLines.map((line, i) => {
                      const lineNum = startLine + i;
                      const isLast = i === visibleLines.length - 1;
                      return (
                        <div key={i} className="flex" style={{ opacity: isLast ? 1 : 0.7 + (i / visibleLines.length) * 0.3 }}>
                          <span className="w-10 text-right pr-4 select-none flex-shrink-0" style={{ color: '#484f58' }}>{lineNum}</span>
                          <span style={{ color: isLast ? '#e6edf3' : '#8b949e' }}>
                            {colorizeHtml(line)}
                            {isLast && <span className="inline-block w-[7px] h-[15px] ml-px align-middle rounded-sm animate-pulse" style={{ background: '#58a6ff' }} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* ステータスバー */}
                <div className="flex items-center justify-between px-4 py-1.5 text-[10px] border-t border-white/5" style={{ background: '#161b22', color: '#484f58' }}>
                  <span>HTML</span>
                  <span>{lines.length} 行 · UTF-8</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* デプロイパネル */}
      {showDeployPanel && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && deployPhase === 'idle') setShowDeployPanel(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Deploy Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">ページを公開</h2>
                  <p className="text-xs text-gray-400 mt-0.5">GitHub + Render Static Site</p>
                </div>
              </div>
              <button onClick={() => { if (deployPhase !== 'uploading' && deployPhase !== 'deploying') { setShowDeployPanel(false); setDeployPhase('idle'); setDeploymentInfo(null); setDeployError(''); }}} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {/* 設定未完了 */}
              {settingsReady === false && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">初期設定が必要です</p>
                        <p className="text-xs text-amber-700 mt-1">Render APIキーとGitHubトークンを設定画面で設定してください。</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
                      <Github className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700 flex-1">GitHub連携</span>
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">未設定</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
                      <Server className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700 flex-1">Render APIキー</span>
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">未設定</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading settings */}
              {settingsReady === null && (
                <div className="flex flex-col items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400">設定を確認中...</p>
                </div>
              )}

              {/* Idle: 入力フォーム */}
              {settingsReady === true && deployPhase === 'idle' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">サイト名</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={deployServiceName}
                        onChange={(e) => setDeployServiceName(e.target.value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase())}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                        placeholder="my-landing-page"
                      />
                    </div>
                    {deployServiceName && (
                      <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {deployServiceName}.onrender.com
                      </p>
                    )}
                  </div>
                  {hasChanges && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                      未保存の変更があります。公開時に自動保存されます。
                    </p>
                  )}
                  <button
                    onClick={handleDeploy}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Rocket className="h-4 w-4" />
                    デプロイを開始
                  </button>
                </div>
              )}

              {/* Deploying progress */}
              {settingsReady === true && (deployPhase === 'uploading' || deployPhase === 'deploying') && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    {[
                      { key: 'uploading', icon: Github, label: 'リポジトリ作成', desc: 'GitHubにアップロード中' },
                      { key: 'deploying', icon: Server, label: 'ビルド中', desc: 'Renderでサイトを構築中' },
                    ].map((step) => {
                      const isActive = deployPhase === step.key;
                      const isDone = (step.key === 'uploading' && deployPhase === 'deploying');
                      return (
                        <div key={step.key} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-blue-50 border border-blue-100' : isDone ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                          {isActive ? (
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                          )}
                          <div>
                            <p className={`text-sm font-medium ${isActive ? 'text-blue-700' : isDone ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</p>
                            <p className={`text-[11px] ${isActive ? 'text-blue-500' : isDone ? 'text-green-500' : 'text-gray-300'}`}>{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Done */}
              {settingsReady === true && deployPhase === 'done' && deploymentInfo && (
                <div className="space-y-5 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">公開完了</h3>
                    <p className="text-sm text-gray-500 mt-1">サイトが公開されました</p>
                  </div>
                  {deploymentInfo.siteUrl && (
                    <a
                      href={deploymentInfo.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-xl transition-colors text-center"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        サイトを開く
                      </span>
                    </a>
                  )}
                  {deploymentInfo.githubRepoUrl && (
                    <a
                      href={deploymentInfo.githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors text-center"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Github className="h-4 w-4" />
                        GitHubリポジトリ
                      </span>
                    </a>
                  )}
                </div>
              )}

              {/* Failed */}
              {settingsReady === true && deployPhase === 'failed' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle className="h-7 w-7 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">デプロイ失敗</h3>
                    <p className="text-sm text-red-500 mt-1">{deployError}</p>
                  </div>
                  <button
                    onClick={() => { setDeployPhase('idle'); setDeployError(''); setDeploymentInfo(null); }}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors"
                  >
                    やり直す
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
