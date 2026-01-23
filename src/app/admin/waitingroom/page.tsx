'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Check, X, RefreshCw, Inbox, Clock, Mail, Building2, User, Phone,
    MessageSquare, Send, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle
} from 'lucide-react';

interface WaitingRoomReply {
    id: number;
    message: string;
    adminId: string;
    adminName: string | null;
    isRead: boolean;
    createdAt: string;
}

interface WaitingRoomEntry {
    id: number;
    accountType: string;
    companyName: string | null;
    name: string;
    email: string;
    phone: string | null;
    remarks: string | null;
    status: string;
    plan: string | null;
    adminNotes: string | null;
    processedAt: string | null;
    processedBy: string | null;
    createdAt: string;
    updatedAt: string;
    replies: WaitingRoomReply[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: '未対応', color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> },
    approved: { label: '承認済', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    rejected: { label: '却下', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    invited: { label: '招待済', color: 'bg-blue-100 text-blue-700', icon: <Mail className="w-3 h-3" /> },
    registered: { label: '登録済', color: 'bg-purple-100 text-purple-700', icon: <Check className="w-3 h-3" /> },
};

const PLAN_OPTIONS = [
    { value: 'pro', label: 'Pro', description: '¥20,000/月（10万トークン）' },
    { value: 'business', label: 'Business', description: '¥40,000/月（30万トークン・35%お得）' },
    { value: 'enterprise', label: 'Enterprise', description: '¥100,000/月（100万トークン・50%お得）' },
];

export default function WaitingRoomPage() {
    const [entries, setEntries] = useState<WaitingRoomEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<number | null>(null);
    const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
    const [replyMessage, setReplyMessage] = useState<Record<number, string>>({});
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedPlan, setSelectedPlan] = useState<Record<number, string>>({});

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/waitingroom');
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch entries');
            }
            const data = await res.json();
            setEntries(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleStatusChange = async (entryId: number, status: string) => {
        // 承認時はプラン選択が必要
        if (status === 'approved' && !selectedPlan[entryId]) {
            alert('承認する場合はプランを選択してください');
            return;
        }

        try {
            setProcessing(entryId);
            const res = await fetch('/api/admin/waitingroom', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entryId,
                    status,
                    plan: status === 'approved' ? selectedPlan[entryId] : undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update status');
            }

            const { entry } = await res.json();
            setEntries(prev => prev.map(e => e.id === entryId ? entry : e));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleSendReply = async (entryId: number) => {
        const message = replyMessage[entryId]?.trim();
        if (!message) return;

        try {
            setProcessing(entryId);
            const res = await fetch('/api/admin/waitingroom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryId, message }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send reply');
            }

            const { reply } = await res.json();
            setEntries(prev => prev.map(e =>
                e.id === entryId
                    ? { ...e, replies: [...e.replies, reply] }
                    : e
            ));
            setReplyMessage(prev => ({ ...prev, [entryId]: '' }));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (entryId: number) => {
        if (!window.confirm('この申請を削除しますか？この操作は取り消せません。')) return;

        try {
            setProcessing(entryId);
            const res = await fetch(`/api/admin/waitingroom?entryId=${entryId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete entry');
            }

            setEntries(prev => prev.filter(e => e.id !== entryId));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const filteredEntries = entries.filter(e =>
        statusFilter === 'all' || e.status === statusFilter
    );

    const pendingCount = entries.filter(e => e.status === 'pending').length;

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <p className="font-medium">エラー</p>
                    <p className="text-sm mt-1">{error}</p>
                    <button
                        onClick={fetchEntries}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                        再試行
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Inbox className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                        <span className="truncate">申請管理</span>
                    </h1>
                    <p className="text-sm text-gray-600 mt-1 hidden sm:block">
                        ウェイティングリストの申請を管理・返信します
                    </p>
                </div>
                <button
                    onClick={fetchEntries}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">更新</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setStatusFilter('all')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">全て</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{entries.length}</p>
                </div>
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'pending' ? 'ring-2 ring-amber-500' : ''}`}
                    onClick={() => setStatusFilter('pending')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">未対応</p>
                    <p className="text-lg sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setStatusFilter('approved')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">承認済</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-600">{entries.filter(e => e.status === 'approved').length}</p>
                </div>
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
                    onClick={() => setStatusFilter('rejected')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">却下</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{entries.filter(e => e.status === 'rejected').length}</p>
                </div>
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'invited' ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setStatusFilter('invited')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">招待済</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">{entries.filter(e => e.status === 'invited').length}</p>
                </div>
                <div
                    className={`bg-white rounded-lg border p-2 sm:p-4 cursor-pointer transition-all min-h-[44px] ${statusFilter === 'registered' ? 'ring-2 ring-purple-500' : ''}`}
                    onClick={() => setStatusFilter('registered')}
                >
                    <p className="text-xs sm:text-sm text-gray-500">登録済</p>
                    <p className="text-lg sm:text-2xl font-bold text-purple-600">{entries.filter(e => e.status === 'registered').length}</p>
                </div>
            </div>

            {/* Entry List */}
            <div className="bg-white rounded-lg border overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>読み込み中...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>申請がありません</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredEntries.map((entry) => (
                            <div key={entry.id} className={entry.status === 'pending' ? 'bg-amber-50' : ''}>
                                {/* Main Row */}
                                <div
                                    className="px-3 sm:px-4 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
                                    onClick={() => {
                                        const newExpandedId = expandedEntry === entry.id ? null : entry.id;
                                        setExpandedEntry(newExpandedId);
                                        if (newExpandedId && entry.plan && !selectedPlan[entry.id]) {
                                            setSelectedPlan(prev => ({ ...prev, [entry.id]: entry.plan! }));
                                        }
                                    }}
                                >
                                    {/* Mobile: stacked card */}
                                    <div className="flex items-start gap-3 sm:hidden">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[entry.status]?.color || STATUS_CONFIG.pending.color}`}>
                                                    {STATUS_CONFIG[entry.status]?.icon}
                                                    {STATUS_CONFIG[entry.status]?.label || entry.status}
                                                </span>
                                                {entry.accountType === 'corporate' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                                        <Building2 className="w-3 h-3" />法人
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                                        <User className="w-3 h-3" />個人
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {entry.companyName && <span className="text-gray-500">{entry.companyName} / </span>}
                                                {entry.name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{entry.email}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                <span>{formatDate(entry.createdAt)}</span>
                                                {entry.replies.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3" />{entry.replies.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {expandedEntry === entry.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Desktop: horizontal row */}
                                    <div className="hidden sm:flex items-center gap-4">
                                        <div className="w-24 flex-shrink-0">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[entry.status]?.color || STATUS_CONFIG.pending.color}`}>
                                                {STATUS_CONFIG[entry.status]?.icon}
                                                {STATUS_CONFIG[entry.status]?.label || entry.status}
                                            </span>
                                        </div>
                                        <div className="w-16 flex-shrink-0">
                                            {entry.accountType === 'corporate' ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                                    <Building2 className="w-3 h-3" />法人
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                                    <User className="w-3 h-3" />個人
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900 truncate">
                                                    {entry.companyName && <span className="text-gray-500">{entry.companyName} / </span>}
                                                    {entry.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Mail className="w-3 h-3 text-gray-400" />
                                                <span className="text-xs text-gray-500 truncate">{entry.email}</span>
                                            </div>
                                        </div>
                                        <div className="w-20 flex-shrink-0 text-center">
                                            {entry.plan ? (
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
                                                    {PLAN_OPTIONS.find(p => p.value === entry.plan)?.label || entry.plan}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </div>
                                        <div className="w-16 flex-shrink-0 text-center">
                                            {entry.replies.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                                                    <MessageSquare className="w-3 h-3" />{entry.replies.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-36 flex-shrink-0 text-right">
                                            <p className="text-xs text-gray-500">{formatDate(entry.createdAt)}</p>
                                        </div>
                                        <div className="w-8 flex-shrink-0 text-center">
                                            {expandedEntry === entry.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedEntry === entry.id && (
                                    <div className="px-3 sm:px-4 py-4 bg-gray-50 border-t">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            {/* Details */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 mb-3">申請内容</h4>
                                                <div className="bg-white rounded-lg border p-4 space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs text-gray-500">お名前</p>
                                                            <p className="text-sm text-gray-900">{entry.name}</p>
                                                        </div>
                                                    </div>
                                                    {entry.companyName && (
                                                        <div className="flex items-start gap-3">
                                                            <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                                                            <div>
                                                                <p className="text-xs text-gray-500">会社名</p>
                                                                <p className="text-sm text-gray-900">{entry.companyName}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start gap-3">
                                                        <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs text-gray-500">メールアドレス</p>
                                                            <p className="text-sm text-gray-900">{entry.email}</p>
                                                        </div>
                                                    </div>
                                                    {entry.phone && (
                                                        <div className="flex items-start gap-3">
                                                            <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                                                            <div>
                                                                <p className="text-xs text-gray-500">電話番号</p>
                                                                <p className="text-sm text-gray-900">{entry.phone}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {entry.plan && (
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-4 h-4 text-gray-400 mt-0.5">★</div>
                                                            <div>
                                                                <p className="text-xs text-gray-500">希望プラン</p>
                                                                <p className="text-sm font-medium text-amber-600">
                                                                    {PLAN_OPTIONS.find(p => p.value === entry.plan)?.label || entry.plan}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {entry.remarks && (
                                                        <div className="pt-3 border-t">
                                                            <p className="text-xs text-gray-500 mb-1">備考</p>
                                                            <p className="text-sm text-gray-900 whitespace-pre-wrap">{entry.remarks}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Plan Selection */}
                                                <h4 className="text-sm font-medium text-gray-900 mt-4 mb-3">プラン選択</h4>
                                                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mb-4">
                                                    {PLAN_OPTIONS.map((plan) => (
                                                        <button
                                                            key={plan.value}
                                                            onClick={() => setSelectedPlan(prev => ({ ...prev, [entry.id]: plan.value }))}
                                                            className={`px-3 py-2 text-left text-xs font-medium rounded-lg border transition-all ${
                                                                selectedPlan[entry.id] === plan.value
                                                                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200'
                                                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <span className="font-bold">{plan.label}</span>
                                                            <span className="block text-gray-500 font-normal">{plan.description}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Status Change */}
                                                <h4 className="text-sm font-medium text-gray-900 mb-3">ステータス変更</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusChange(entry.id, status)}
                                                            disabled={processing === entry.id || entry.status === status}
                                                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all min-h-[36px] ${
                                                                entry.status === status
                                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                                                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                            } ${processing === entry.id ? 'opacity-50' : ''}`}
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                {config.icon}
                                                                {config.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                                {!selectedPlan[entry.id] && (
                                                    <p className="text-xs text-amber-600 mt-2">※ 承認する場合はプランを先に選択してください</p>
                                                )}

                                                {/* Delete */}
                                                <div className="mt-4 pt-4 border-t">
                                                    <button
                                                        onClick={() => handleDelete(entry.id)}
                                                        disabled={processing === entry.id}
                                                        className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        削除
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Reply Section */}
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 mb-3">返信履歴</h4>
                                                <div className="bg-white rounded-lg border p-4">
                                                    {/* Reply List */}
                                                    {entry.replies.length > 0 ? (
                                                        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                                                            {entry.replies.map((reply) => (
                                                                <div key={reply.id} className="bg-blue-50 rounded-lg p-3">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-xs font-medium text-blue-700">
                                                                            {reply.adminName || 'Admin'}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500">
                                                                            {formatDate(reply.createdAt)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                                                        {reply.message}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 mb-4">まだ返信はありません</p>
                                                    )}

                                                    {/* Reply Input */}
                                                    <div className="border-t pt-3">
                                                        <textarea
                                                            value={replyMessage[entry.id] || ''}
                                                            onChange={(e) => setReplyMessage(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                                            placeholder="返信メッセージを入力..."
                                                            className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            rows={3}
                                                        />
                                                        <div className="flex justify-end mt-2">
                                                            <button
                                                                onClick={() => handleSendReply(entry.id)}
                                                                disabled={processing === entry.id || !replyMessage[entry.id]?.trim()}
                                                                className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px]"
                                                            >
                                                                <Send className="w-4 h-4" />
                                                                返信を保存
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2">
                                                            ※ 返信はDBに保存されます。申請者はログイン後に確認できます。
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Additional Info */}
                                        <div className="mt-4 pt-4 border-t text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                                            <p>申請ID: {entry.id}</p>
                                            <p>最終更新: {formatDate(entry.updatedAt)}</p>
                                            {entry.processedAt && <p>処理日時: {formatDate(entry.processedAt)}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
