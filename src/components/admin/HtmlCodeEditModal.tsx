"use client";

import React, { useState, useRef } from 'react';
import { X, Copy, Check, Eye, Code2, Monitor, Smartphone, Loader2, ImagePlus, Send, Mail } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // チャット
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 画像アップロード処理
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

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      images: uploadedImages.map(img => img.preview),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);

    try {
      // 画像がある場合は先にアップロード
      let imageUrls: string[] = [];
      if (uploadedImages.length > 0) {
        for (const img of uploadedImages) {
          const formData = new FormData();
          formData.append('file', img.file);
          const uploadRes = await fetch('/api/upload-temp-image', {
            method: 'POST',
            body: formData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.url) imageUrls.push(uploadData.url);
          }
        }
      }
      setUploadedImages([]);

      // プロンプト構築
      let finalPrompt = text;
      if (imageUrls.length > 0) {
        finalPrompt += `\n\n【使用する画像URL】\n`;
        imageUrls.forEach((url, i) => {
          finalPrompt += `画像${i + 1}: ${url}\n`;
        });
      }

      const response = await fetch('/api/ai/claude-edit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentHtml: modifiedHtml,
          editPrompt: finalPrompt,
          layoutMode,
          designContext: designDefinition || null,
          templateType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `エラー: ${data.message || '修正に失敗しました'}`,
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }

      setModifiedHtml(data.html);
      setHasChanges(true);

      const successMsg: ChatMessage = {
        role: 'assistant',
        content: '修正を適用しました。プレビューで確認してください。',
      };
      setMessages(prev => [...prev, successMsg]);

      // スクロール
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
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
    toast.success('リセットしました');
  };

  // フォーム有効化: HTMLを修正してResend API連携を追加
  const handleEnableFormSubmission = async () => {
    if (!pageSlug) {
      toast.error('ページ情報が取得できません');
      return;
    }

    setIsGenerating(true);
    try {
      // AIにフォーム有効化を依頼
      const response = await fetch('/api/ai/claude-edit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentHtml: modifiedHtml,
          editPrompt: `このHTMLフォームを有効化してください。

【重要な変更点】
1. formタグにonsubmit属性を追加して、JavaScriptでフォーム送信を処理する
2. 送信先は /api/form-submissions (POSTリクエスト)
3. 送信データはJSON形式で以下の構造:
   {
     "pageSlug": "${pageSlug}",
     "formTitle": "お問い合わせ",
     "formFields": [
       { "fieldName": "name", "fieldLabel": "お名前", "value": "入力値" },
       { "fieldName": "email", "fieldLabel": "メールアドレス", "value": "入力値" },
       ...（フォームの各フィールドを含める）
     ]
   }
4. 送信成功時は「送信完了しました」のメッセージを表示
5. 送信失敗時はエラーメッセージを表示
6. 送信中はボタンを無効化して「送信中...」と表示

【フォームフィールドの取得方法】
- 各input, select, textareaからname属性とlabel要素のテキストを取得
- labelが見つからない場合はplaceholderやname属性を使用

【サンプルコード参考】
<script>
document.querySelector('form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '送信中...';

  const formData = new FormData(this);
  const fields = [];
  for (const [name, value] of formData.entries()) {
    const input = this.querySelector('[name="' + name + '"]');
    const label = input?.closest('div')?.querySelector('label')?.textContent || name;
    fields.push({ fieldName: name, fieldLabel: label.replace('*', '').trim(), value: String(value) });
  }

  try {
    const res = await fetch('/api/form-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageSlug: '${pageSlug}',
        formTitle: 'お問い合わせ',
        formFields: fields
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('送信完了しました');
      this.reset();
    } else {
      alert(data.error || '送信に失敗しました');
    }
  } catch (err) {
    alert('送信に失敗しました');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});
</script>

元のフォームのデザインは一切変更せず、上記のスクリプトを</body>の前に追加してください。`,
          layoutMode,
          designContext: designDefinition || null,
          templateType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'フォーム有効化に失敗しました');
        return;
      }

      setModifiedHtml(data.html);
      setHasChanges(true);
      toast.success('フォームを有効化しました。設定画面でResend APIキーを設定すると、メール通知が届きます。');

      const successMsg: ChatMessage = {
        role: 'assistant',
        content: 'フォームを有効化しました。送信データは管理画面で確認でき、Resend APIキーを設定するとメール通知も届きます。',
      };
      setMessages(prev => [...prev, successMsg]);

    } catch (error) {
      toast.error('フォーム有効化に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-gray-600" />
            <span className="font-semibold text-gray-800">HTML編集</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col border-r border-gray-200 bg-gray-100">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    プレビュー
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'code' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Code2 className="h-3 w-3" />
                    コード
                  </button>
                </div>
                {viewMode === 'preview' && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded-md transition-all ${
                        previewDevice === 'desktop' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded-md transition-all ${
                        previewDevice === 'mobile' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    リセット
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg"
                >
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'コピー済' : 'コピー'}
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4">
              <div
                className={`bg-white rounded-lg shadow-sm overflow-hidden mx-auto transition-all ${
                  previewDevice === 'mobile' ? 'max-w-[375px]' : 'w-full'
                }`}
                style={{ minHeight: '100%' }}
              >
                {viewMode === 'preview' ? (
                  <iframe
                    srcDoc={modifiedHtml}
                    className="w-full h-full min-h-[500px] border-0"
                    sandbox="allow-scripts allow-forms"
                    title="Preview"
                  />
                ) : (
                  <pre className="p-4 text-[11px] leading-relaxed font-mono overflow-auto bg-gray-950 text-gray-300 h-full min-h-[500px]">
                    <code>{modifiedHtml}</code>
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* Right: Chat Panel */}
          <div className="w-[320px] flex flex-col bg-white">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Code2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 font-medium">HTMLを編集</p>
                  <p className="text-xs text-gray-400 mt-1">
                    変更したい内容をチャットで指示してください
                  </p>
                  <div className="mt-4 space-y-1.5 text-[11px] text-gray-400">
                    <p>例: 「ボタンの色を青に」</p>
                    <p>例: 「見出しを大きく」</p>
                    <p>例: 「この画像を追加して」</p>
                  </div>

                  {/* フォーム有効化ボタン */}
                  {pageSlug && (
                    <button
                      onClick={handleEnableFormSubmission}
                      disabled={isGenerating}
                      className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          処理中...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          フォームを有効化
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.images.map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt=""
                              className="h-12 w-12 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    生成中...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Image Preview */}
            {uploadedImages.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Upload ${index + 1}`}
                        className="h-12 w-12 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1 -right-1 p-0.5 bg-gray-800 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors flex-shrink-0"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="修正内容を入力..."
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 pr-10"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isGenerating || (!inputText.trim() && uploadedImages.length === 0)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '変更を保存'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
