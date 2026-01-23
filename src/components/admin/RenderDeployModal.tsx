"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, ExternalLink, Copy, Trash2, Globe, ArrowUpRight, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';

interface RenderDeployModalProps {
  onClose: () => void;
  html: string;
  templateType: string;
  prompt: string;
}

interface Deployment {
  id: number;
  serviceName: string;
  status: string;
  siteUrl?: string;
  githubRepoUrl?: string;
  createdAt: string;
  errorMessage?: string;
}

export default function RenderDeployModal({ onClose, html, templateType, prompt }: RenderDeployModalProps) {
  const [serviceName, setServiceName] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      const response = await fetch('/api/deploy/render');
      if (response.ok) {
        const data = await response.json();
        setDeployments(data.deployments || []);
      }
    } catch (error) {}
  };

  const pollStatus = useCallback(async (deploymentId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/deploy/${deploymentId}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentDeployment(prev => prev ? { ...prev, ...data } : data);

          if (data.status === 'live' || data.status === 'failed') {
            clearInterval(interval);
            fetchDeployments();
          }
        }
      } catch (error) {}
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleDeploy = async () => {
    if (!serviceName.trim()) {
      toast.error('Enter a site name');
      return;
    }

    setDeploying(true);

    try {
      const response = await fetch('/api/deploy/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, serviceName: serviceName.trim(), templateType, prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Deploy failed');
        setDeploying(false);
        return;
      }

      setCurrentDeployment(data.deployment);
      pollStatus(data.deployment.id);
    } catch (error) {
      toast.error('Connection error');
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async (deploymentId: number) => {
    if (!confirm('Delete this deployment?')) return;

    try {
      const response = await fetch(`/api/deploy/${deploymentId}`, { method: 'DELETE' });
      if (response.ok) {
        setDeployments(prev => prev.filter(d => d.id !== deploymentId));
        if (currentDeployment?.id === deploymentId) setCurrentDeployment(null);
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return <span className="text-[10px] font-mono font-bold text-green-400">LIVE</span>;
      case 'building': return <span className="text-[10px] font-mono font-bold text-yellow-400 animate-pulse">BUILDING</span>;
      case 'failed': return <span className="text-[10px] font-mono font-bold text-red-400">FAILED</span>;
      default: return <span className="text-[10px] font-mono font-bold text-gray-500">PENDING</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
      <div className="bg-[#0a0a0a] border border-[#222] w-full max-w-lg max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#222] bg-[#111]">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-mono font-semibold text-gray-200">deploy</span>
            <span className="text-[10px] font-mono text-gray-600">--target render</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#222] transition-colors">
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Deploy form */}
          {!currentDeployment && (
            <div>
              <label className="block text-xs font-mono font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Service Name
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-3 bg-[#111] border border-[#222] text-sm font-mono text-gray-200 focus:outline-none focus:border-[#444] transition-colors placeholder:text-gray-700"
                placeholder="my-landing-page"
                disabled={deploying}
                autoFocus
              />
              <p className="text-[10px] font-mono text-gray-700 mt-2">
                alphanumeric + hyphens | used in render URL
              </p>
              <button
                onClick={handleDeploy}
                disabled={deploying || !serviceName.trim()}
                className="mt-4 w-full py-3 bg-white text-black font-mono font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deploying ? (
                  <>
                    <Terminal className="h-4 w-4 animate-pulse" />
                    DEPLOYING...
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-4 w-4" />
                    DEPLOY
                  </>
                )}
              </button>
            </div>
          )}

          {/* Current deployment status */}
          {currentDeployment && (
            <div className="border border-[#222] bg-[#111]">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono font-semibold text-gray-200">{currentDeployment.serviceName}</span>
                  {getStatusLabel(currentDeployment.status)}
                </div>

                {currentDeployment.status === 'building' && (
                  <div className="space-y-2">
                    <div className="h-1 w-full bg-[#222] overflow-hidden">
                      <div className="h-full bg-yellow-400 animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <p className="text-[10px] font-mono text-gray-600">Waiting for build to complete...</p>
                  </div>
                )}

                {currentDeployment.status === 'live' && currentDeployment.siteUrl && (
                  <div className="flex items-center gap-2 p-3 bg-[#0a0a0a] border border-[#222]">
                    <span className="h-2 w-2 bg-green-400" />
                    <a
                      href={currentDeployment.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-gray-300 hover:text-white truncate flex-1 transition-colors"
                    >
                      {currentDeployment.siteUrl}
                    </a>
                    <button onClick={() => handleCopyUrl(currentDeployment.siteUrl!)} className="p-1 hover:bg-[#222]">
                      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-gray-600" />}
                    </button>
                    <a href={currentDeployment.siteUrl} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-[#222]">
                      <ExternalLink className="h-3 w-3 text-gray-600" />
                    </a>
                  </div>
                )}

                {currentDeployment.status === 'failed' && (
                  <p className="text-[10px] font-mono text-red-400 mt-1">
                    {currentDeployment.errorMessage || 'ERR: Deployment failed'}
                  </p>
                )}
              </div>

              {currentDeployment.githubRepoUrl && (
                <div className="px-4 py-2 border-t border-[#222]">
                  <a
                    href={currentDeployment.githubRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    github: {currentDeployment.githubRepoUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Past deployments */}
          {deployments.length > 0 && (
            <div>
              <p className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-wider mb-3">History</p>
              <div className="space-y-1">
                {deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="group flex items-center justify-between p-3 bg-[#111] border border-[#1a1a1a] hover:border-[#333] transition-colors"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {getStatusLabel(deployment.status)}
                      <span className="text-xs font-mono text-gray-400 truncate">{deployment.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-gray-700">
                        {new Date(deployment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        onClick={() => handleDelete(deployment.id)}
                        className="p-1 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
