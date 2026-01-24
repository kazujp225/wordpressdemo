"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Globe, Loader2, ExternalLink, Copy, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeploymentInfo {
  id: number;
  serviceName: string;
  status: string;
  siteUrl?: string;
  githubRepoUrl?: string;
  errorMessage?: string;
}

interface PageDeployModalProps {
  pageId: string;
  pageTitle: string;
  onClose: () => void;
}

export default function PageDeployModal({ pageId, pageTitle, onClose }: PageDeployModalProps) {
  const [serviceName, setServiceName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [settingsReady, setSettingsReady] = useState<boolean | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if deploy settings are configured
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        setSettingsReady(!!data.hasRenderApiKey && !!data.hasGithubToken);
      })
      .catch(() => setSettingsReady(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Set default service name from page title
  useEffect(() => {
    if (pageTitle) {
      const sanitized = pageTitle
        .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g, '-')
        .replace(/[^\x00-\x7F]/g, '') // remove non-ASCII for URL
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 30);
      setServiceName(sanitized || 'my-page');
    }
  }, [pageTitle]);

  const handleDeploy = async () => {
    if (!serviceName.trim()) {
      toast.error('サイト名を入力してください');
      return;
    }

    setDeploying(true);
    setLoadingHtml(true);

    try {
      // 1. Generate deploy-ready HTML
      const htmlRes = await fetch(`/api/pages/${pageId}/deploy-html`);
      if (!htmlRes.ok) {
        const err = await htmlRes.json();
        toast.error(err.error || 'HTML生成に失敗しました');
        setDeploying(false);
        setLoadingHtml(false);
        return;
      }
      const { html } = await htmlRes.json();
      setLoadingHtml(false);

      // 2. Deploy to Render
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
        toast.error(data.message || 'デプロイに失敗しました');
        setDeploying(false);
        return;
      }

      setDeployment(data.deployment);
      pollDeployStatus(data.deployment.id);
    } catch (error) {
      toast.error('接続エラー');
      setLoadingHtml(false);
    } finally {
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

          if (data.status === 'live' || data.status === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            if (data.status === 'live') {
              toast.success('デプロイ完了！');
            }
          }
        }
      } catch {}
    }, 5000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">ページをデプロイ</h2>
              <p className="text-[10px] text-gray-400">Render Static Site</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {settingsReady === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : settingsReady === false ? (
            <div className="space-y-4">
              <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-sm font-semibold text-gray-800 mb-1">デプロイ設定が必要です</p>
                <p className="text-xs text-gray-500 mb-3">GitHub連携とRender APIキーを設定してください。</p>
                <a
                  href="/admin/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                >
                  設定画面を開く
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          ) : !deployment ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                  サイト名
                </label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase())}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 transition-all placeholder:text-gray-400"
                  placeholder="my-landing-page"
                  disabled={deploying}
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1.5">英数字とハイフンのみ。RenderのURLに使用されます。</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">デプロイ内容</h4>
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>ページ</span>
                    <span className="font-medium text-gray-800 truncate ml-2 max-w-[200px]">{pageTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ホスティング</span>
                    <span className="font-medium text-gray-800">Render Static Site (Free)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDeploy}
                disabled={deploying || !serviceName.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                {deploying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {loadingHtml ? 'HTML生成中...' : 'デプロイ中...'}
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    デプロイ実行
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-800">{deployment.serviceName}</span>
                  {deployment.status === 'building' && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">BUILDING</span>
                  )}
                  {deployment.status === 'live' && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">LIVE</span>
                  )}
                  {deployment.status === 'failed' && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">FAILED</span>
                  )}
                </div>

                {deployment.status === 'building' && (
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <p className="text-xs text-gray-500">ビルド中...（通常1〜3分）</p>
                  </div>
                )}

                {deployment.status === 'live' && deployment.siteUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-emerald-100">
                      <span className="h-2 w-2 bg-emerald-400 rounded-full" />
                      <a href={deployment.siteUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-emerald-700 hover:text-emerald-900 font-medium truncate flex-1">
                        {deployment.siteUrl}
                      </a>
                      <a href={deployment.siteUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-emerald-50 rounded-lg">
                        <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                      </a>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(deployment.siteUrl!); toast.success('URLをコピーしました'); }}
                      className="w-full py-2.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
                    >
                      <Copy className="h-3 w-3" />
                      URLをコピー
                    </button>
                  </div>
                )}

                {deployment.status === 'failed' && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600">{deployment.errorMessage || 'デプロイに失敗しました'}</p>
                    <button
                      onClick={() => { setDeployment(null); setDeploying(false); }}
                      className="text-xs font-medium text-gray-600 hover:text-gray-800"
                    >
                      再試行
                    </button>
                  </div>
                )}
              </div>

              {deployment.githubRepoUrl && (
                <a href={deployment.githubRepoUrl} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-gray-400 hover:text-gray-600 truncate">
                  GitHub: {deployment.githubRepoUrl}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
