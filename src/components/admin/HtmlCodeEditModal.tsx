"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, Check, Code2, Monitor, Smartphone, Loader2, ImagePlus, Send, Mail, Undo2, Redo2, ExternalLink, Globe, Sparkles, RotateCw, ChevronDown, ArrowRight, CheckCircle2, Circle, Zap } from 'lucide-react';
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
}

interface UploadedImage {
  file: File;
  preview: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  actions?: string[];
}

type AgentStatus = 'idle' | 'thinking' | 'generating' | 'updating' | 'done';

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: '',
  thinking: '指示を分析中...',
  generating: 'コードを生成中...',
  updating: 'プレビューを更新中...',
  done: '完了',
};

function getStorageKey(templateType?: string, pageSlug?: string): string {
  return `html-edit-chat:${pageSlug || 'default'}:${templateType || 'none'}`;
}

export default function HtmlCodeEditModal({
  onClose,
  currentHtml,
  templateType,
  designDefinition,
  layoutMode,
  onSave,
  pageSlug,
}: HtmlCodeEditModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modifiedHtml, setModifiedHtml] = useState(currentHtml);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');

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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && uploadedImages.length === 0) return;

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
          actions: ['エラー'],
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
                pushHtmlHistory(data.html);
              }

              setTimeout(() => {
                setAgentStatus('done');
                setTimeout(() => setAgentStatus('idle'), 2000);
              }, 500);

              const actions = ['コード生成', 'HTML更新', 'プレビュー反映'];
              let assistantContent = data.message || '変更を適用しました。';
              if (data.estimatedCost) {
                assistantContent += `\n\nコスト: $${data.estimatedCost.toFixed(4)}`;
              }
              const successMsg: ChatMessage = {
                role: 'assistant',
                content: assistantContent,
                actions,
              };
              setMessages(prev => [...prev, successMsg]);
            } else if (data.type === 'error') {
              setStreamingText('');
              setAgentStatus('idle');
              const errorMsg: ChatMessage = {
                role: 'assistant',
                content: `エラー: ${data.message}`,
                actions: ['エラー'],
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      onClose();
    } catch (error) {
      toast.error('保存に失敗しました');
    } finally {
      setIsSaving(false);
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
      if (data.html) { pushHtmlHistory(data.html); }
      setTimeout(() => { setAgentStatus('done'); setTimeout(() => setAgentStatus('idle'), 2000); }, 500);
      toast.success('フォームを有効化しました');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'フォームを有効化しました。送信データは管理画面で確認できます。',
        actions: ['フォーム解析', 'スクリプト追加', 'プレビュー更新'],
      }]);
    } catch (error) {
      toast.error('フォーム有効化に失敗しました');
      setAgentStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick actions
  const suggestions = [
    { icon: '🎨', label: 'デザインを改善', prompt: 'デザインをよりモダンで洗練されたものに改善してください' },
    { icon: '📱', label: 'モバイル最適化', prompt: 'モバイル表示を改善してスマートフォンでも見やすいレイアウトにしてください' },
    { icon: '✨', label: 'アニメーション追加', prompt: 'スクロールアニメーションやホバーエフェクトを追加してください' },
    { icon: '📝', label: 'コンテンツ追加', prompt: '新しいセクションを追加してください' },
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
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-gray-900">AI エディタ</h2>
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
              <button onClick={handleReset} className="p-2 text-gray-300 hover:text-gray-500 rounded-lg transition-colors" title="リセット">
                <RotateCw className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
                <Sparkles className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">何をしますか？</h3>
              <p className="text-sm text-gray-400 mb-2 text-center">指示するだけで、AIがコードを生成・編集します</p>

              {/* Credit Warning */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 mb-7">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-[11px] text-amber-600">クレジットを消費します</span>
              </div>

              {/* Suggestion Chips */}
              <div className="w-full grid grid-cols-2 gap-2 mb-6">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputText(s.prompt); setTimeout(() => inputRef.current?.focus(), 100); }}
                    className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 text-left transition-all group"
                  >
                    <span className="text-base">{s.icon}</span>
                    <span className="text-[13px] text-gray-500 group-hover:text-gray-700">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Form Enable */}
              {pageSlug && (
                <button
                  onClick={handleEnableFormSubmission}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-sm text-gray-500 hover:text-gray-700 transition-all disabled:opacity-40"
                >
                  {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> 処理中...</> : <><Mail className="h-4 w-4" /> フォームを有効化</>}
                </button>
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
                        {/* Action Pills */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg.actions.map((action, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-[11px] text-green-700 font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                {action}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="bg-gray-50 border border-gray-100 text-gray-700 px-4 py-2.5 rounded-2xl rounded-bl-md text-[13px] leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming */}
              {isGenerating && streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    {/* Live Status Pills */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] text-blue-600 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {STATUS_LABELS[agentStatus] || 'コード生成中...'}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 text-gray-600 px-4 py-2.5 rounded-2xl rounded-bl-md text-[13px]">
                      <p className="whitespace-pre-wrap">{streamingText}</p>
                      <span className="inline-block w-1.5 h-4 bg-black/30 animate-pulse ml-0.5 align-middle rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              {isGenerating && !streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] text-blue-600 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {STATUS_LABELS[agentStatus] || '考え中...'}
                      </span>
                    </div>
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
          <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-gray-300 focus-within:bg-white transition-all">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="変更内容を入力..."
              rows={1}
              className="w-full px-4 pt-3 pb-1 bg-transparent text-[13px] text-gray-800 placeholder-gray-300 focus:outline-none resize-none"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title="画像を添付"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
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

        {/* Save Footer */}
        {hasChanges && (
          <div className="px-4 pb-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-black hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> 保存中...</> : '変更を保存'}
            </button>
          </div>
        )}
      </div>

      {/* ===== Right: Computer View ===== */}
      <div className="flex-1 flex flex-col">

        {/* Computer Header */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#e8e8e3] border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            {/* Window Controls */}
            <div className="flex items-center gap-1.5">
              <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <button onClick={handleFullPreview} className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-110 transition" />
            </div>
            <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">Computer</span>
          </div>

          {/* URL Bar */}
          <div className="flex-1 mx-6">
            <div className="flex items-center gap-2 bg-white/80 rounded-lg px-3 py-1.5 max-w-lg mx-auto border border-gray-200/50">
              {agentStatus !== 'idle' ? (
                <Loader2 className="h-3 w-3 text-gray-300 animate-spin flex-shrink-0" />
              ) : (
                <Globe className="h-3 w-3 text-gray-300 flex-shrink-0" />
              )}
              <span className="text-xs text-gray-400 truncate">
                {pageSlug ? `${pageSlug}.zettai.co.jp` : 'preview'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Device Toggle */}
            <div className="flex items-center bg-white/60 rounded-lg p-0.5 border border-gray-200/50">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={handleUndo} disabled={!canUndo} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all disabled:opacity-20" title="元に戻す">
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleRedo} disabled={!canRedo} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all disabled:opacity-20" title="やり直す">
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="w-px h-5 bg-gray-300/50 mx-1" />

            <button
              onClick={() => setShowCode(!showCode)}
              className={`p-1.5 rounded-md transition-all ${showCode ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-500 hover:bg-white/60'}`}
              title="コードを表示"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleCopy} className="p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-white/60 transition-all" title="コピー">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button onClick={handleFullPreview} className="p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-white/60 transition-all" title="新しいタブで開く">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-[#e8e8e3] flex items-start justify-center p-3">
          {showCode ? (
            <div className="w-full h-full rounded-lg overflow-auto bg-[#1e1e1e] shadow-xl">
              <pre className="p-5 text-[12px] leading-relaxed font-mono text-gray-300">
                <code>{modifiedHtml}</code>
              </pre>
            </div>
          ) : (
            <div
              className={`bg-white rounded-lg shadow-xl overflow-hidden transition-all ${previewDevice === 'mobile' ? 'w-[375px]' : 'w-full'}`}
              style={{ minHeight: 'calc(100vh - 80px)' }}
            >
              <iframe
                srcDoc={modifiedHtml}
                className="w-full border-0"
                style={{ height: 'calc(100vh - 80px)' }}
                sandbox="allow-scripts allow-forms"
                title="Preview"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
