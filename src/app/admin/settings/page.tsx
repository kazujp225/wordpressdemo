"use client";

import React, { useState, useEffect } from 'react';
import { Save, Globe, Shield, Bell, Database, Github, Loader2, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
    const [config, setConfig] = useState<any>({
        siteName: 'マイ・ランディングページ',
        language: 'ja',
        github: { token: '', owner: '', repo: '', branch: 'main', path: 'public/lp' }
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                const data = await res.json();
                if (data.siteName) setConfig(data);
            } catch (e) {
                console.error('Failed to fetch config', e);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch (e) {
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-10 max-w-4xl mx-auto pb-32">
            <div className="mb-10">
                <h1 className="text-3xl font-black tracking-tight text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">サイト全体の基本設定と外部サービスとの連携管理を行います。</p>
            </div>

            <div className="space-y-8">
                {/* General Settings */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                            <Globe className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">一般設定</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest mb-2">サイト名</label>
                            <input
                                type="text"
                                value={config.siteName}
                                onChange={e => setConfig({ ...config, siteName: e.target.value })}
                                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all font-bold"
                            />
                        </div>
                    </div>
                </div>

                {/* GitHub Integration */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="rounded-xl bg-gray-900 p-2 text-white">
                            <Github className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">GitHub連携 (一括デプロイ)</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest mb-2">Personal Access Token</label>
                            <input
                                type="password"
                                value={config.github?.token || ''}
                                placeholder="ghp_..."
                                onChange={e => setConfig({ ...config, github: { ...config.github, token: e.target.value } })}
                                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-900/10 focus:bg-white focus:border-gray-900 transition-all font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest mb-2">Owner / Org</label>
                            <input
                                type="text"
                                value={config.github?.owner || ''}
                                onChange={e => setConfig({ ...config, github: { ...config.github, owner: e.target.value } })}
                                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-900/10 focus:bg-white focus:border-gray-900 transition-all font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest mb-2">Repository</label>
                            <input
                                type="text"
                                value={config.github?.repo || ''}
                                onChange={e => setConfig({ ...config, github: { ...config.github, repo: e.target.value } })}
                                className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-gray-900/10 focus:bg-white focus:border-gray-900 transition-all font-bold"
                            />
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 p-6 flex justify-center items-center z-50">
                <div className="max-w-4xl w-full flex justify-between items-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {isSaving ? 'Saving changes...' : saveStatus === 'success' ? 'Settings saved!' : 'Unsaved changes'}
                    </p>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-3 rounded-2xl bg-gray-900 px-10 py-4 text-sm font-black text-white shadow-xl shadow-gray-200 transition-all hover:bg-black hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : saveStatus === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Save className="h-5 w-5" />}
                        設定を保存
                    </button>
                </div>
            </div>
        </div>
    );
}
