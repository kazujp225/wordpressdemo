"use client";

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, Eye, EyeOff, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Inquiry {
    id: number;
    userId: string;
    email: string | null;
    subject: string;
    body: string;
    isRead: boolean;
    status: string;
    adminNote: string | null;
    createdAt: string;
    updatedAt: string;
}

export default function InquiriesPage() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

    useEffect(() => {
        fetchInquiries();
    }, []);

    const fetchInquiries = async () => {
        try {
            const res = await fetch('/api/inquiries');
            if (res.ok) {
                const data = await res.json();
                setInquiries(data);
            }
        } catch (e) {
            console.error('Failed to fetch inquiries', e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleRead = async (id: number, currentIsRead: boolean) => {
        try {
            const res = await fetch(`/api/inquiries/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: !currentIsRead }),
            });
            if (res.ok) {
                setInquiries(prev => prev.map(inq =>
                    inq.id === id ? { ...inq, isRead: !currentIsRead } : inq
                ));
            }
        } catch {
            toast.error('更新に失敗しました');
        }
    };

    const toggleStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        try {
            const res = await fetch(`/api/inquiries/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setInquiries(prev => prev.map(inq =>
                    inq.id === id ? { ...inq, status: newStatus } : inq
                ));
                toast.success(newStatus === 'closed' ? 'クローズしました' : '再オープンしました');
            }
        } catch {
            toast.error('更新に失敗しました');
        }
    };

    const filtered = inquiries.filter(inq => {
        if (filter === 'all') return true;
        return inq.status === filter;
    });

    const unreadCount = inquiries.filter(inq => !inq.isRead && inq.status === 'open').length;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <Mail className="h-5 w-5 text-gray-900" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">お問い合わせ管理</h1>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">ユーザーからのお問い合わせ一覧</p>
                </div>

                {/* Filter */}
                <div className="flex gap-2 mb-6">
                    {(['all', 'open', 'closed'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                filter === f
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {f === 'all' ? `すべて (${inquiries.length})` :
                             f === 'open' ? `未対応 (${inquiries.filter(i => i.status === 'open').length})` :
                             `対応済み (${inquiries.filter(i => i.status === 'closed').length})`}
                        </button>
                    ))}
                </div>

                {/* List */}
                {filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">お問い合わせはありません</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(inq => {
                            const isExpanded = expandedId === inq.id;
                            return (
                                <div
                                    key={inq.id}
                                    className={`rounded-xl border bg-white transition-all ${
                                        !inq.isRead ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                                    }`}
                                >
                                    {/* Header row */}
                                    <button
                                        onClick={() => {
                                            setExpandedId(isExpanded ? null : inq.id);
                                            if (!inq.isRead) toggleRead(inq.id, false);
                                        }}
                                        className="w-full flex items-center gap-3 p-4 text-left"
                                    >
                                        {/* Unread dot */}
                                        <div className="flex-shrink-0 w-2">
                                            {!inq.isRead && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                            )}
                                        </div>

                                        {/* Status badge */}
                                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            inq.status === 'open'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {inq.status === 'open' ? '未対応' : '対応済み'}
                                        </span>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate ${!inq.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                {inq.subject}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {inq.email || inq.userId} · {new Date(inq.createdAt).toLocaleString('ja-JP')}
                                            </p>
                                        </div>

                                        {/* Expand icon */}
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        )}
                                    </button>

                                    {/* Expanded body */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-gray-100">
                                            <div className="pt-4 pb-3">
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                    {inq.body}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                                <button
                                                    onClick={() => toggleRead(inq.id, inq.isRead)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    {inq.isRead ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    {inq.isRead ? '未読にする' : '既読にする'}
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(inq.id, inq.status)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                        inq.status === 'open'
                                                            ? 'text-white bg-gray-900 hover:bg-gray-800'
                                                            : 'text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {inq.status === 'open' ? (
                                                        <><CheckCircle className="h-3 w-3" /> 対応済みにする</>
                                                    ) : (
                                                        <><Clock className="h-3 w-3" /> 再オープン</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
