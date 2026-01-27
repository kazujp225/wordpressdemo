import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Target,
  FileText,
  Code,
  Lightbulb,
  TrendingUp,
  MessageSquare,
  ExternalLink
} from 'lucide-react';

type AnalysisMode = 'seo' | 'llmo' | 'combined';

interface SEOLLMOOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
  pageId?: number | null; // 保存先のページID
  currentScreenshot?: string; // 現在のLPスクリーンショット
  onApplyMetadata?: (metadata: {
    title: string;
    description: string;
    h1: string;
    keywords: string[];
  }) => void;
  onSaved?: () => void; // 保存完了時のコールバック
}

interface AnalysisResult {
  success: boolean;
  mode: AnalysisMode;
  data: any;
}

export const SEOLLMOOptimizer: React.FC<SEOLLMOOptimizerProps> = ({
  isOpen,
  onClose,
  pageId,
  currentScreenshot,
  onApplyMetadata,
  onSaved
}) => {
  const [mode, setMode] = useState<AnalysisMode>('combined');
  const [imageUrl, setImageUrl] = useState<string | null>(currentScreenshot || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['keywords', 'metadata']);
  const [additionalContext, setAdditionalContext] = useState('');

  // 画像アップロード処理
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // 分析実行
  const handleAnalyze = useCallback(async () => {
    if (!imageUrl) {
      setError('画像をアップロードしてください');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/seo-llmo-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          pageId: pageId || undefined, // ページIDを送信してテキストコンテンツを抽出
          mode,
          additionalContext: additionalContext || undefined
        })
      });

      if (!response.ok) {
        throw new Error('分析に失敗しました');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : '分析中にエラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageUrl, mode, additionalContext]);

  // セクション展開/折りたたみ
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  }, []);

  // クリップボードにコピー
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // メタデータを適用
  const handleApplyMetadata = useCallback(() => {
    if (!result?.data || !onApplyMetadata) return;

    const seoData = result.data.seo || result.data;
    onApplyMetadata({
      title: seoData.title || seoData.metadata?.title || '',
      description: seoData.description || seoData.metadata?.description || '',
      h1: seoData.h1 || seoData.contentRecommendations?.h1 || '',
      keywords: [
        seoData.primaryKeyword || seoData.keywords?.primary || '',
        ...(seoData.secondaryKeywords || seoData.keywords?.secondary || [])
      ].filter(Boolean)
    });
    onClose();
  }, [result, onApplyMetadata, onClose]);

  // ステルスSEO/LLMOデータをDBに保存
  const handleSaveToPage = useCallback(async () => {
    if (!result?.data || !pageId) {
      setError('ページが保存されていないか、分析結果がありません');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const response = await fetch(`/api/pages/${pageId}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seoData: result.data })
      });

      if (!response.ok) {
        throw new Error('保存に失敗しました');
      }

      setSaveSuccess(true);
      onSaved?.();

      // 3秒後に成功メッセージをクリア
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : '保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  }, [result, pageId, onSaved]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-white/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">SEO / LLMO 最適化</h2>
                <p className="text-white/80 text-sm">LPを分析し、検索エンジン最適化を実行</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分析モード
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'seo', label: 'SEO分析', icon: Search, desc: 'Google検索向け' },
                  { id: 'llmo', label: 'LLMO分析', icon: MessageSquare, desc: '対話検索向け' },
                  { id: 'combined', label: '統合分析', icon: TrendingUp, desc: '両方を網羅' }
                ].map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setMode(id as AnalysisMode)}
                    className={`p-4 rounded-md border-2 transition-all text-left ${
                      mode === id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${mode === id ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className={`font-medium ${mode === id ? 'text-blue-900' : 'text-gray-700'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LP画像をアップロード
              </label>
              <div className="relative">
                {imageUrl ? (
                  <div className="relative rounded-md overflow-hidden border-2 border-gray-200">
                    <img
                      src={imageUrl}
                      alt="LP Preview"
                      className="w-full max-h-64 object-contain bg-gray-50"
                    />
                    <button
                      onClick={() => {
                        setImageUrl(null);
                        setResult(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded bg-red-500 hover:bg-red-600 flex items-center justify-center text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">クリックして画像をアップロード</span>
                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP対応</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Additional Context */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                追加コンテキスト（任意）
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="業種、ターゲット層、競合情報など、分析精度を上げるための情報を入力..."
                className="w-full h-24 px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {/* Results */}
            {result?.success && result.data && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-700">分析完了</span>
                </div>

                {/* Keywords Section */}
                {(result.data.keywords || result.data.seo?.primaryKeyword) && (
                  <ResultSection
                    title="キーワード分析"
                    icon={Target}
                    isExpanded={expandedSections.includes('keywords')}
                    onToggle={() => toggleSection('keywords')}
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">メインキーワード</div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                            {result.data.seo?.primaryKeyword || result.data.keywords?.primary}
                          </span>
                          <button
                            onClick={() => copyToClipboard(result.data.seo?.primaryKeyword || result.data.keywords?.primary)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">サブキーワード</div>
                        <div className="flex flex-wrap gap-2">
                          {(result.data.seo?.secondaryKeywords || result.data.keywords?.secondary || []).map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">ロングテールキーワード</div>
                        <div className="flex flex-wrap gap-2">
                          {(result.data.seo?.longTailKeywords || result.data.keywords?.longTail || []).map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ResultSection>
                )}

                {/* Metadata Section */}
                {(result.data.metadata || result.data.seo) && (
                  <ResultSection
                    title="メタデータ"
                    icon={FileText}
                    isExpanded={expandedSections.includes('metadata')}
                    onToggle={() => toggleSection('metadata')}
                  >
                    <div className="space-y-3">
                      <MetadataItem
                        label="Title"
                        value={result.data.seo?.title || result.data.metadata?.title}
                        onCopy={copyToClipboard}
                      />
                      <MetadataItem
                        label="Description"
                        value={result.data.seo?.description || result.data.metadata?.description}
                        onCopy={copyToClipboard}
                      />
                      <MetadataItem
                        label="H1"
                        value={result.data.seo?.h1 || result.data.contentRecommendations?.h1}
                        onCopy={copyToClipboard}
                      />
                    </div>
                  </ResultSection>
                )}

                {/* LLMO Section */}
                {result.data.llmo && (
                  <ResultSection
                    title="LLMO最適化"
                    icon={MessageSquare}
                    isExpanded={expandedSections.includes('llmo')}
                    onToggle={() => toggleSection('llmo')}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-2">検索される質問</div>
                        <div className="space-y-2">
                          {result.data.llmo.targetQuestions?.map((q: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                              <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5" />
                              <span className="text-sm text-gray-700">{q}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {result.data.llmo.summaryForAI && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">引用用サマリー</div>
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-gray-700">
                            {result.data.llmo.summaryForAI}
                          </div>
                        </div>
                      )}
                      {result.data.llmo.faqItems && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2">FAQ構造化データ</div>
                          <div className="space-y-2">
                            {result.data.llmo.faqItems.map((faq: { q: string; a: string }, i: number) => (
                              <div key={i} className="p-3 bg-gray-50 rounded-md">
                                <div className="font-medium text-sm text-gray-800 mb-1">Q: {faq.q}</div>
                                <div className="text-sm text-gray-600">A: {faq.a}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ResultSection>
                )}

                {/* Structured Data Section */}
                {result.data.structuredData && (
                  <ResultSection
                    title="構造化データ"
                    icon={Code}
                    isExpanded={expandedSections.includes('structuredData')}
                    onToggle={() => toggleSection('structuredData')}
                  >
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        推奨スキーマ: <span className="font-medium">{result.data.structuredData.schemaType || result.data.structuredData.type}</span>
                      </div>
                      {result.data.structuredData.jsonLd && (
                        <div className="relative">
                          <pre className="p-3 bg-gray-900 text-green-400 rounded-md text-xs overflow-x-auto">
                            {JSON.stringify(result.data.structuredData.jsonLd, null, 2)}
                          </pre>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(result.data.structuredData.jsonLd, null, 2))}
                            className="absolute top-2 right-2 p-1 bg-gray-700 hover:bg-gray-600 rounded-sm text-white"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </ResultSection>
                )}

                {/* Implementation Section */}
                {result.data.implementation && (
                  <ResultSection
                    title="実装アクション"
                    icon={Lightbulb}
                    isExpanded={expandedSections.includes('implementation')}
                    onToggle={() => toggleSection('implementation')}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          すぐに実装できる改善
                        </div>
                        <ul className="space-y-2">
                          {result.data.implementation.quickWins?.map((action: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-2">長期的な改善</div>
                        <ul className="space-y-2">
                          {result.data.implementation.longTermActions?.map((action: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <ExternalLink className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </ResultSection>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                閉じる
              </button>
              {/* 保存成功メッセージ */}
              {saveSuccess && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  ステルス対策を保存しました
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {/* ステルス保存ボタン */}
              {result?.success && pageId && (
                <button
                  onClick={handleSaveToPage}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-md transition-all flex items-center gap-2 shadow-lg"
                  title="見た目を変えずにSEO/LLMO対策を適用"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Code className="w-4 h-4" />
                  )}
                  ステルス保存
                </button>
              )}
              {result?.success && onApplyMetadata && (
                <button
                  onClick={handleApplyMetadata}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  メタデータを適用
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={!imageUrl || isAnalyzing}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    分析実行
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

// Result Section Component
const ResultSection: React.FC<{
  title: string;
  icon: React.FC<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, isExpanded, onToggle, children }) => (
  <div className="border border-gray-200 rounded-md overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-gray-800">{title}</span>
      </div>
      {isExpanded ? (
        <ChevronUp className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      )}
    </button>
    {isExpanded && <div className="p-4 border-t">{children}</div>}
  </div>
);

// Metadata Item Component
const MetadataItem: React.FC<{
  label: string;
  value?: string;
  onCopy: (text: string) => void;
}> = ({ label, value, onCopy }) => {
  if (!value) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <button
          onClick={() => onCopy(value)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Copy className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      <div className="p-2 bg-gray-50 rounded-md text-sm text-gray-700">{value}</div>
    </div>
  );
};

export default SEOLLMOOptimizer;
