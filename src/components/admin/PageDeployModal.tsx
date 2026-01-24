"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Globe, Loader2, ExternalLink, Copy, ArrowRight, Check, Rocket, Github, Server, FileCode, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeploymentInfo {
  id: number;
  serviceName: string;
  status: string;
  siteUrl?: string;
  githubRepoUrl?: string;
  errorMessage?: string;
}

type DeployPhase = 'idle' | 'generating' | 'uploading' | 'deploying' | 'done' | 'failed';

interface PageDeployModalProps {
  pageId: string;
  pageTitle: string;
  onClose: () => void;
}

const DEPLOY_STEPS = [
  { phase: 'generating' as const, icon: FileCode, label: 'HTML生成', description: 'ページを静的HTMLに変換中' },
  { phase: 'uploading' as const, icon: Github, label: 'リポジトリ作成', description: 'GitHubにソースコードをアップロード' },
  { phase: 'deploying' as const, icon: Server, label: 'デプロイ', description: 'Renderにサイトを構築中' },
  { phase: 'done' as const, icon: Globe, label: '公開完了', description: 'サイトがインターネットに公開されました' },
];

export default function PageDeployModal({ pageId, pageTitle, onClose }: PageDeployModalProps) {
  const [serviceName, setServiceName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [settingsReady, setSettingsReady] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<DeployPhase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => setSettingsReady(!!data.hasRenderApiKey && !!data.hasGithubToken))
      .catch(() => setSettingsReady(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (pageTitle) {
      const sanitized = pageTitle
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 30);
      setServiceName(sanitized || 'my-page');
    }
  }, [pageTitle]);

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleDeploy = async () => {
    if (!serviceName.trim()) {
      toast.error('サイト名を入力してください');
      return;
    }

    setDeploying(true);
    setPhase('generating');
    setErrorMsg('');
    startTimer();

    try {
      // Phase 1: Generate HTML
      const htmlRes = await fetch(`/api/pages/${pageId}/deploy-html`);
      if (!htmlRes.ok) {
        const err = await htmlRes.json();
        throw new Error(err.error || 'HTML生成に失敗しました');
      }
      const { html } = await htmlRes.json();

      // Phase 2: Upload to GitHub + Deploy
      setPhase('uploading');

      const deployRes = await fetch('/api/deploy/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          serviceName: serviceName.trim(),
          templateType: 'page-deploy',
          prompt: `Page: ${pageTitle}`,
          pageId: parseInt(pageId),
        }),
      });

      const data = await deployRes.json();

      if (!deployRes.ok) {
        throw new Error(data.message || 'デプロイに失敗しました');
      }

      // Phase 3: Deploying (waiting for build)
      setPhase('deploying');
      setDeployment(data.deployment);
      pollDeployStatus(data.deployment.id);
    } catch (error: any) {
      setPhase('failed');
      setErrorMsg(error.message || '予期しないエラー');
      stopTimer();
      setDeploying(false);
    }
  };

  const pollDeployStatus = (deploymentId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deploy/${deploymentId}`);
        if (res.ok) {
          const data = await res.json();
          setDeployment(prev => prev ? { ...prev, ...data } : data);

          if (data.status === 'live') {
            setPhase('done');
            stopTimer();
            setDeploying(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          } else if (data.status === 'failed') {
            setPhase('failed');
            setErrorMsg(data.errorMessage || 'ビルドに失敗しました');
            stopTimer();
            setDeploying(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch {}
    }, 4000);
  };

  const handleRetry = () => {
    setPhase('idle');
    setDeployment(null);
    setDeploying(false);
    setErrorMsg('');
    setElapsedSeconds(0);
  };

  const getPhaseIndex = (p: DeployPhase) => {
    if (p === 'idle') return -1;
    if (p === 'failed') return DEPLOY_STEPS.findIndex(s => s.phase === 'deploying');
    return DEPLOY_STEPS.findIndex(s => s.phase === p);
  };

  const currentPhaseIdx = getPhaseIndex(phase);
  const previewUrl = serviceName.trim() ? `${serviceName.trim()}.onrender.com` : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget && phase === 'idle') onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden border border-gray-200/60 animate-in zoom-in-95 fade-in duration-200">

        {/* Header - Premium gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 opacity-[0.03]" />
          <div className="relative flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                  <Rocket className="h-5 w-5 text-white" />
                </div>
                {phase === 'done' && (
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-400 rounded-full flex items-center justify-center ring-2 ring-white">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 tracking-tight">ページを公開</h2>
                <p className="text-xs text-gray-400 mt-0.5">ワンクリックでWebサイトとしてデプロイ</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <X className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading state */}
          {settingsReady === null && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">設定を確認中...</p>
            </div>
          )}

          {/* Settings not ready */}
          {settingsReady === false && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-gray-300" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">初回セットアップが必要です</h3>
                <p className="text-xs text-gray-500 max-w-[300px] mx-auto leading-relaxed">
                  GitHub連携とRender APIキーを設定すると、ワンクリックでデプロイできるようになります。
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <Github className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">GitHub連携</p>
                    <p className="text-[11px] text-gray-400">OAuth認証で自動接続</p>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">未設定</span>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">Render APIキー</p>
                    <p className="text-[11px] text-gray-400">無料のStatic Siteホスティング</p>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">未設定</span>
                </div>
              </div>

              <a
                href="/admin/settings"
                className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all shadow-sm"
              >
                設定画面を開く
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}

          {/* Ready to deploy - Input phase */}
          {settingsReady && phase === 'idle' && (
            <div className="space-y-5">
              {/* Service name input */}
              <div>
                <label className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-gray-700">サイト名</span>
                  {previewUrl && (
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">
                      {previewUrl}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase())}
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition-all placeholder:text-gray-400 font-medium"
                    placeholder="my-landing-page"
                    autoFocus
                  />
                  {serviceName.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">英数字とハイフンのみ使用可能</p>
              </div>

              {/* Deploy info card */}
              <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/80 to-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100/80">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">デプロイ概要</span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">ページ</span>
                    <span className="text-xs font-bold text-gray-800 truncate max-w-[220px]">{pageTitle}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">ホスティング</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 rounded bg-teal-100 flex items-center justify-center">
                        <Globe className="h-2 w-2 text-teal-600" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">Render</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">FREE</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">SSL</span>
                    <span className="text-xs font-bold text-gray-800">自動 (HTTPS)</span>
                  </div>
                </div>
              </div>

              {/* Deploy button */}
              <button
                onClick={handleDeploy}
                disabled={!serviceName.trim()}
                className="group relative w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-xl text-sm font-bold hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-200/40 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <Rocket className="h-4.5 w-4.5 relative" />
                <span className="relative">デプロイを開始</span>
              </button>
            </div>
          )}

          {/* Deploying - Progress view */}
          {settingsReady && (phase === 'generating' || phase === 'uploading' || phase === 'deploying') && (
            <div className="space-y-6">
              {/* Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-gray-600">デプロイ中</span>
                </div>
                <span className="text-xs font-mono text-gray-400 tabular-nums">
                  {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* Progress steps */}
              <div className="space-y-0">
                {DEPLOY_STEPS.map((step, idx) => {
                  const isActive = idx === currentPhaseIdx;
                  const isComplete = idx < currentPhaseIdx;
                  const isPending = idx > currentPhaseIdx;
                  const Icon = step.icon;

                  return (
                    <div key={step.phase} className="flex items-start gap-4">
                      {/* Vertical line + icon */}
                      <div className="flex flex-col items-center">
                        <div className={`
                          h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-500
                          ${isComplete ? 'bg-emerald-500 shadow-lg shadow-emerald-200/50 scale-100' : ''}
                          ${isActive ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200/50 scale-110' : ''}
                          ${isPending ? 'bg-gray-100 scale-95' : ''}
                        `}>
                          {isComplete ? (
                            <Check className="h-4 w-4 text-white" strokeWidth={3} />
                          ) : isActive ? (
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        {idx < DEPLOY_STEPS.length - 1 && (
                          <div className={`w-0.5 h-6 my-1 rounded-full transition-all duration-500 ${
                            isComplete ? 'bg-emerald-300' : 'bg-gray-100'
                          }`} />
                        )}
                      </div>
                      {/* Text */}
                      <div className="pt-1.5 pb-4">
                        <p className={`text-sm font-bold transition-colors duration-300 ${
                          isActive ? 'text-gray-900' : isComplete ? 'text-emerald-700' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </p>
                        <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                          isActive ? 'text-gray-500' : isComplete ? 'text-emerald-500' : 'text-gray-300'
                        }`}>
                          {isComplete ? '完了' : step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Service name reminder */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <Globe className="h-3 w-3 text-gray-400" />
                <span className="text-[11px] text-gray-500 font-mono truncate">{serviceName}.onrender.com</span>
              </div>
            </div>
          )}

          {/* Success state */}
          {phase === 'done' && deployment?.siteUrl && (
            <div className="space-y-5">
              {/* Success header */}
              <div className="text-center pt-2 pb-1">
                <div className="relative inline-flex">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-200/50 mx-auto mb-4">
                    <Check className="h-8 w-8 text-white" strokeWidth={2.5} />
                  </div>
                  {/* Decorative dots */}
                  <div className="absolute -top-1 -left-1 h-3 w-3 bg-emerald-200 rounded-full animate-ping opacity-75" />
                  <div className="absolute -bottom-1 -right-1 h-2 w-2 bg-teal-200 rounded-full animate-ping opacity-75 animation-delay-300" />
                </div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">公開されました</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {elapsedSeconds > 0 && `${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒で完了`}
                </p>
              </div>

              {/* Live URL card */}
              <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-4">
                <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-100/50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 bg-emerald-400 rounded-full shadow-sm shadow-emerald-300 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">LIVE</span>
                  </div>
                  <a
                    href={deployment.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-bold text-emerald-800 hover:text-emerald-900 transition-colors break-all leading-relaxed"
                  >
                    {deployment.siteUrl}
                  </a>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={deployment.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  サイトを開く
                </a>
                <button
                  onClick={() => { navigator.clipboard.writeText(deployment.siteUrl!); toast.success('URLをコピーしました'); }}
                  className="flex items-center justify-center gap-2 py-3 bg-white text-gray-700 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  URLをコピー
                </button>
              </div>

              {/* GitHub repo link */}
              {deployment.githubRepoUrl && (
                <a
                  href={deployment.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group"
                >
                  <Github className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />
                  <span className="text-[11px] text-gray-500 group-hover:text-gray-700 truncate flex-1 font-medium">
                    {deployment.githubRepoUrl.replace('https://github.com/', '')}
                  </span>
                  <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
                </a>
              )}
            </div>
          )}

          {/* Failed state */}
          {phase === 'failed' && (
            <div className="space-y-5">
              <div className="text-center pt-2 pb-1">
                <div className="h-14 w-14 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center mx-auto mb-4">
                  <X className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900">デプロイに失敗しました</h3>
                <p className="text-xs text-gray-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">{errorMsg}</p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={handleRetry}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  再試行
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-gray-600 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer subtle branding */}
        {phase === 'idle' && settingsReady && (
          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <div className="h-1 w-1 rounded-full bg-emerald-300" />
                  <div className="h-1 w-1 rounded-full bg-teal-300" />
                  <div className="h-1 w-1 rounded-full bg-cyan-300" />
                </div>
                <span className="text-[10px] text-gray-400">GitHub → Render → HTTPS</span>
              </div>
              <span className="text-[10px] text-gray-300">Powered by Render</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
