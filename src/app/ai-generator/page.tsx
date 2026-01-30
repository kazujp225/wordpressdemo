"use client";

import { useState, useEffect } from "react";
import { TEMPLATES } from "@/lib/claude-templates";
import {
  Sparkles,
  Check,
  Copy,
  Smartphone,
  Tablet,
  Monitor,
  Download,
  Code2,
  Eye,
  RefreshCw,
  Zap,
  Palette,
  Type,
  Layout,
  Globe,
  Plus
} from "lucide-react";
import { toast } from "react-hot-toast";

const GENERATION_STEPS = [
  "要件を分析中...",
  "構造設計を行っています...",
  "HTMLをコーディング中...",
  "CSSでスタイリング中...",
  "レスポンシブ対応を確認中...",
  "仕上げを行っています..."
];

const QUICK_MODIFIERS = [
  { label: "ダークモード", icon: <Palette className="w-3 h-3" />, value: "ダークモードで作成してください。" },
  { label: "ミニマル", icon: <Layout className="w-3 h-3" />, value: "ミニマルなデザインにしてください。" },
  { label: "日本語フォント", icon: <Type className="w-3 h-3" />, value: "美しい日本語フォント（Noto Sans JPなど）を使用してください。" },
  { label: "アニメーション", icon: <Sparkles className="w-3 h-3" />, value: "適度なマイクロインタラクションとアニメーションを追加してください。" },
  { label: "カラフル", icon: <Palette className="w-3 h-3" />, value: "鮮やかでポップな配色にしてください。" },
  { label: "英語サイト", icon: <Globe className="w-3 h-3" />, value: "英語のコンテンツで作成してください。" },
];

export default function AiGeneratorPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setPrompt(template.defaultUserPrompt);
    }
  };

  const addModifier = (modifierValue: string) => {
    setPrompt((prev) => {
      if (prev.includes(modifierValue)) return prev;
      return prev + (prev.endsWith("\n") ? "" : "\n") + modifierValue;
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationStep(0);
      interval = setInterval(() => {
        setGenerationStep((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error("テンプレートを選択してください");
      return;
    }
    if (!prompt.trim()) {
      toast.error("プロンプトを入力してください");
      return;
    }

    setIsGenerating(true);
    setGeneratedCode(null);

    try {
      const response = await fetch("/api/ai/claude-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "生成に失敗しました");
      }

      if (data.html) {
        setTimeout(() => {
          setGeneratedCode(data.html);
          setIsGenerating(false);
          toast.success("生成が完了しました！");
        }, 800);
      } else {
        throw new Error("HTMLが生成されませんでした");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "エラーが発生しました");
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      toast.success("コードをコピーしました");
    }
  };

  const handleDownload = () => {
    if (generatedCode) {
      const blob = new Blob([generatedCode], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-site.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-24 font-sans">
      {/* Navbarish Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5 text-white shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">AI Code Gen</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-20">
        {/* Hero */}
        <div className="text-center space-y-4 sm:space-y-6">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tight text-slate-900">
            Design to Code, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Instantly.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed">
            Claude Sonnet 4 Engine搭載。<br className="hidden sm:block" />
            プロフェッショナルなWebサイトを、わずか数秒で構築します。
          </p>
        </div>

        {/* 1. Template Selection */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-lg shadow-md shadow-blue-600/20">1</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">テンプレートを選択</h2>
              <p className="text-slate-500 text-sm">作成したいサイトの種類のベースを選んでください</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={`group relative flex flex-col p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left h-full min-h-[44px] ${selectedTemplateId === template.id
                  ? "ring-2 ring-blue-600 border-transparent shadow-lg shadow-blue-600/10"
                  : "border-slate-200 hover:border-blue-400"
                  }`}
              >
                <div className={`text-2xl sm:text-3xl mb-3 sm:mb-5 p-3 sm:p-4 rounded-lg sm:rounded-xl w-fit transition-all duration-300 ${selectedTemplateId === template.id ? "bg-blue-600 text-white scale-110" : "bg-slate-50 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:scale-110"
                  }`}>
                  {template.icon}
                </div>
                <h3 className={`text-sm sm:text-lg font-bold mb-1 sm:mb-2 transition-colors ${selectedTemplateId === template.id ? "text-blue-700" : "text-slate-900"}`}>
                  {template.name}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                  {template.description}
                </p>
                {selectedTemplateId === template.id && (
                  <div className="absolute top-4 right-4 text-blue-600 bg-blue-50 rounded-full p-1.5 animate-enter">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Prompt Configuration (Polished UI) */}
        {selectedTemplateId && (
          <section className="space-y-8 animate-enter">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-lg shadow-md shadow-blue-600/20">2</div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">詳細をカスタマイズ</h2>
                <p className="text-slate-500 text-sm">AIへの指示を調整して、理想のデザインに近づけましょう</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Main Input Area */}
              <div className="flex-1 w-full space-y-4">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden transition-all focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400">
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Prompt Editor
                    </span>
                    {selectedTemplate && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        {selectedTemplate.name}
                      </span>
                    )}
                  </div>
                  <textarea
                    id="prompt"
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="block w-full border-0 resize-y p-6 text-slate-800 placeholder:text-slate-300 focus:ring-0 text-base leading-relaxed"
                    placeholder="例: 背景は白を基調にして、アクセントカラーに鮮やかな青を使ってください。ヒーローセクションには大きなキャッチコピーと、右側にイラストを配置してください..."
                  />
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-slate-400 w-full mb-1">クイック追加:</span>
                    {QUICK_MODIFIERS.map((mod) => (
                      <button
                        key={mod.label}
                        onClick={() => addModifier(mod.value)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all active:scale-95 min-h-[36px]"
                      >
                        {mod.icon}
                        {mod.label}
                        <Plus className="w-3 h-3 ml-0.5 opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Sidebar */}
              <div className="w-full lg:w-80 space-y-6 lg:pt-0">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Model Configuration
                    </h3>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Model</span>
                        <span className="font-semibold text-slate-900">Claude 3.5 Sonnet</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">消費クレジット</span>
                        <span className="font-medium text-slate-900">約300〜1,000</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full group relative inline-flex items-center justify-center px-6 py-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="animate-spin -ml-1 mr-2 h-5 w-5" />
                        Generating Code...
                      </>
                    ) : (
                      <>
                        <Sparkles className="-ml-1 mr-2 h-5 w-5 group-hover:animate-pulse" />
                        Generate Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State Visualization */}
            {isGenerating && (
              <div className="bg-white/80 backdrop-blur rounded-2xl p-8 border border-blue-100 shadow-xl animate-enter max-w-2xl mx-auto mt-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-progress"></div>
                <div className="space-y-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-2">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">AI is building your website...</h3>

                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="flex justify-between text-sm font-medium text-slate-500 px-1">
                      <span>Progress</span>
                      <span>{Math.min((generationStep + 1) * 20, 99)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm font-medium text-blue-600 h-6 animate-pulse">
                      {GENERATION_STEPS[generationStep]}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. Result Area */}
        {generatedCode && !isGenerating && (
          <section className="space-y-8 animate-enter">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white font-bold text-lg shadow-md shadow-green-500/20">3</div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">生成結果</h2>
                  <p className="text-slate-500 text-sm">右上のボタンでデバイスを切り替えて確認できます</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-3 sm:px-4 py-2.5 border border-slate-200 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all min-h-[44px]"
                >
                  <Download className="h-4 w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden xs:inline">HTML</span>保存
                </button>
                <button
                  onClick={handleCopyCode}
                  className="button-shine inline-flex items-center px-4 sm:px-5 py-2.5 border border-transparent shadow-lg shadow-slate-900/20 text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-all hover:-translate-y-0.5 active:translate-y-0 min-h-[44px]"
                >
                  <Copy className="h-4 w-4 mr-1.5 sm:mr-2" />
                  コピー
                </button>
              </div>
            </div>

            {/* Browser Shell Container */}
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden ring-1 ring-white/10">
              {/* Browser Toolbar UI ... (Similar to before but with minor polish if needed) */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2 w-1/4">
                  <div className="flex gap-2 group">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                  </div>
                </div>

                <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/50 backdrop-blur">
                  <button
                    onClick={() => setPreviewMode("preview")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${previewMode === "preview"
                      ? "bg-slate-700 text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => setPreviewMode("code")}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${previewMode === "code"
                      ? "bg-slate-700 text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Code
                  </button>
                </div>

                <div className="flex justify-end w-1/4 items-center gap-3">
                  {previewMode === "preview" && (
                    <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button
                        onClick={() => setDeviceView("mobile")}
                        className={`p-1.5 rounded transition-all ${deviceView === "mobile" ? "bg-slate-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                          }`}
                        title="Mobile View"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeviceView("tablet")}
                        className={`p-1.5 rounded transition-all ${deviceView === "tablet" ? "bg-slate-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                          }`}
                        title="Tablet View"
                      >
                        <Tablet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeviceView("desktop")}
                        className={`p-1.5 rounded transition-all ${deviceView === "desktop" ? "bg-slate-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                          }`}
                        title="Desktop View"
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Viewport Area */}
              <div className="bg-slate-950 min-h-[600px] relative overflow-hidden flex justify-center py-8">
                {previewMode === "preview" ? (
                  <div
                    className={`bg-white transition-all duration-500 ease-in-out shadow-2xl overflow-hidden ${deviceView === "mobile" ? "w-[375px] h-[700px] rounded-[2.5rem] border-[6px] border-slate-800 ring-1 ring-slate-700"
                      : deviceView === "tablet" ? "w-[768px] h-[800px] rounded-xl border-4 border-slate-800 ring-1 ring-slate-700"
                        : "w-full h-full rounded-none border-t border-slate-800"
                      }`}
                  >
                    <iframe
                      srcDoc={generatedCode}
                      className="w-full h-full border-none bg-white"
                      title="Generated Preview"
                      sandbox="allow-scripts"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full absolute inset-0 overflow-auto bg-[#0d1117]">
                    <pre className="p-6 text-xs sm:text-sm font-mono text-slate-300 leading-relaxed tab-4">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        .button-shine {
          position: relative;
          overflow: hidden;
        }
        .button-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            to right,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          transform: skewX(-20deg);
          animation: shine 3s infinite;
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }
        @keyframes progress {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-progress {
          background-size: 200% 200%;
          animation: progress 2s ease infinite;
        }
      `}</style>
    </div>
  );
}
