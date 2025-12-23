"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Save, Eye, Trash2, GripVertical, Plus, Maximize2, X, FolderOpen, FileText, ChevronDown, Sparkles, Layout, Settings, Type, ExternalLink } from 'lucide-react';
import { GeminiGeneratorModal } from '@/components/lp-builder/GeminiGeneratorModal';

const SECTION_TEMPLATES = [
    { type: 'hero', name: 'ヒーロー', icon: '🎯', description: 'メインビジュアル' },
    { type: 'features', name: '特徴', icon: '✨', description: '製品の特徴' },
    { type: 'pricing', name: '料金', icon: '💰', description: '価格プラン' },
    { type: 'faq', name: 'FAQ', icon: '❓', description: 'よくある質問' },
    { type: 'cta', name: 'CTA', icon: '🚀', description: '行動喚起' },
    { type: 'testimonials', name: 'お客様の声', icon: '💬', description: 'レビュー' },
];

interface Section {
    id: string;
    type: string;
    name: string;
    properties: {
        title?: string;
        subtitle?: string;
        description?: string;
        image?: string;
        backgroundColor?: string;
        textColor?: string;
        [key: string]: any;
    };
    imageId?: number | null;
}

interface ExistingPage {
    id: number;
    title: string;
    slug: string;
    status: string;
    updatedAt: string;
    sections: any[];
}

interface SortableSectionProps {
    section: Section;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    isSelected: boolean;
}

function SortableSection({ section, onSelect, onDelete, isSelected }: SortableSectionProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const template = SECTION_TEMPLATES.find(t => t.type === section.type);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative rounded-2xl border-2 transition-all duration-200 ${isSelected
                ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-100'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                }`}
        >
            <div className="flex items-center gap-4 p-4">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <GripVertical className="h-5 w-5" />
                </button>

                <button
                    onClick={() => onSelect(section.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl shadow-md">
                        {template?.icon || '📄'}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900">{section.name}</h3>
                        <p className="text-xs text-gray-500">{template?.description || section.type}</p>
                    </div>
                </button>

                <button
                    onClick={() => onDelete(section.id)}
                    className="opacity-0 group-hover:opacity-100 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <div
                className="px-4 pb-4"
                style={{
                    backgroundColor: section.properties.backgroundColor || '#ffffff',
                    color: section.properties.textColor || '#000000',
                }}
            >
                <div className="rounded-xl border border-gray-200 bg-white/50 p-6 backdrop-blur-sm">
                    {section.properties.title && (
                        <h2 className="text-xl font-bold mb-2">{section.properties.title}</h2>
                    )}
                    {section.properties.subtitle && (
                        <h3 className="text-sm font-medium text-gray-600 mb-2">{section.properties.subtitle}</h3>
                    )}
                    {section.properties.description && (
                        <p className="text-sm text-gray-500">{section.properties.description}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function DroppableTemplate({ template, onAdd }: { template: typeof SECTION_TEMPLATES[0]; onAdd: () => void }) {
    return (
        <button
            onClick={onAdd}
            className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-4 transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md"
        >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-2xl shadow-sm group-hover:from-blue-500 group-hover:to-purple-600 transition-all">
                {template.icon}
            </div>
            <div className="text-center">
                <p className="text-sm font-bold text-gray-900">{template.name}</p>
                <p className="text-xs text-gray-500">{template.description}</p>
            </div>
            <Plus className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </button>
    );
}

export default function LPBuilderPage() {
    const [sections, setSections] = useState<Section[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [showPageSelector, setShowPageSelector] = useState(false);
    const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
    const [currentPageId, setCurrentPageId] = useState<number | null>(null);
    const [currentPageTitle, setCurrentPageTitle] = useState<string>('新規LP');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // 既存ページ一覧を取得
    useEffect(() => {
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            const res = await fetch('/api/lp-builder');
            const data = await res.json();
            if (data.pages) {
                setExistingPages(data.pages);
            }
        } catch (error) {
            console.error('Failed to fetch pages:', error);
        }
    };

    // 既存ページを読み込む
    const loadPage = async (page: ExistingPage) => {
        setIsLoading(true);
        try {
            const loadedSections: Section[] = page.sections.map((s: any, idx: number) => {
                let config: any = {};
                try {
                    config = s.config ? JSON.parse(s.config) : {};
                } catch { }

                return {
                    id: `section-${s.id || idx}`,
                    type: config.type || s.role || 'custom',
                    name: config.name || SECTION_TEMPLATES.find(t => t.type === (config.type || s.role))?.name || s.role,
                    properties: config.properties || {
                        title: '',
                        subtitle: '',
                        description: '',
                        backgroundColor: '#ffffff',
                        textColor: '#000000',
                    },
                    imageId: s.image?.id || null,
                };
            });

            setSections(loadedSections);
            setCurrentPageId(page.id);
            setCurrentPageTitle(page.title);
            setShowPageSelector(false);
        } catch (error) {
            console.error('Failed to load page:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 新規作成
    const createNew = () => {
        setSections([]);
        setCurrentPageId(null);
        setCurrentPageTitle('新規LP');
        setShowPageSelector(false);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setSections((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }

        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const addSection = (type: string) => {
        const template = SECTION_TEMPLATES.find(t => t.type === type);
        if (!template) return;

        const newSection: Section = {
            id: `section-${Date.now()}`,
            type: template.type,
            name: template.name,
            properties: {
                title: `${template.name}セクション`,
                subtitle: '',
                description: '',
                backgroundColor: '#ffffff',
                textColor: '#000000',
            },
        };

        setSections((prev) => [...prev, newSection]);
        setSelectedSectionId(newSection.id);
    };

    const deleteSection = (id: string) => {
        setSections((prev) => prev.filter((s) => s.id !== id));
        if (selectedSectionId === id) {
            setSelectedSectionId(null);
        }
    };

    const updateSectionProperty = (id: string, key: keyof Section['properties'], value: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === id
                    ? { ...s, properties: { ...s.properties, [key]: value } }
                    : s
            )
        );
    };

    // Gemini AI生成結果を適用
    const handleGeminiGenerated = (generatedSections: any[]) => {
        const newSections = generatedSections.map((s: any, idx: number) => ({
            id: `section-${Date.now()}-${idx}`,
            type: s.type,
            name: SECTION_TEMPLATES.find(t => t.type === s.type)?.name || s.type,
            properties: {
                ...s.properties,
            },
        }));

        setSections((prev) => [...prev, ...newSections]);

        if (newSections.length > 0) {
            setSelectedSectionId(newSections[0].id);
        }
        setIsGeminiModalOpen(false);
    };

    const selectedSection = sections.find((s) => s.id === selectedSectionId);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/lp-builder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: currentPageId,
                    title: currentPageTitle,
                    sections: sections,
                }),
            });

            const data = await res.json();
            if (data.success) {
                if (!currentPageId && data.pageId) {
                    setCurrentPageId(data.pageId);
                }
                await fetchPages();
                alert('保存しました！');
            } else {
                alert('保存に失敗しました: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen flex-col bg-gray-50">
            {/* Top Bar */}
            <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-black tracking-tight text-gray-900">ZettAI LP Builder</h1>
                    <div className="h-4 w-px bg-gray-200" />

                    {/* Page Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPageSelector(!showPageSelector)}
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            <FileText className="h-4 w-4" />
                            {currentPageTitle}
                            <ChevronDown className="h-4 w-4" />
                        </button>

                        {showPageSelector && (
                            <div className="absolute top-full left-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50">
                                <div className="p-4 border-b border-gray-100">
                                    <button
                                        onClick={createNew}
                                        className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all"
                                    >
                                        <Plus className="h-5 w-5" />
                                        新規LPを作成
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto p-2">
                                    <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                                        既存のLP
                                    </div>
                                    {existingPages.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                                            まだLPがありません
                                        </div>
                                    ) : (
                                        existingPages.map((page) => (
                                            <button
                                                key={page.id}
                                                onClick={() => loadPage(page)}
                                                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-gray-50 ${currentPageId === page.id ? 'bg-blue-50 border border-blue-200' : ''
                                                    }`}
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
                                                    📄
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="font-bold text-gray-900 truncate">{page.title}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {page.sections.length}セクション • {new Date(page.updatedAt).toLocaleDateString('ja-JP')}
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${page.status === 'published'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {page.status === 'published' ? '公開' : '下書き'}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Edit Title */}
                    <input
                        type="text"
                        value={currentPageTitle}
                        onChange={(e) => setCurrentPageTitle(e.target.value)}
                        className="rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-gray-700 hover:border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                        placeholder="LP名を入力"
                    />
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/lp-builder"
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                    >
                        <Layout className="h-4 w-4" />
                        紹介ページ
                    </Link>
                    {currentPageId && (
                        <a
                            href={`/p/${existingPages.find(p => p.id === currentPageId)?.slug || currentPageId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                        >
                            <ExternalLink className="h-4 w-4" />
                            公開ページ
                        </a>
                    )}
                    <button
                        onClick={() => setShowPreview(true)}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300"
                    >
                        <Eye className="h-4 w-4" />
                        プレビュー
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || sections.length === 0}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Section Templates */}
                <div className="w-72 border-r border-gray-200 bg-white p-6 overflow-y-auto">
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Layout className="h-5 w-5 text-gray-700" />
                            <h2 className="text-lg font-bold text-gray-900">セクション</h2>
                        </div>
                        <p className="text-xs text-gray-500">クリックして追加</p>
                    </div>

                    <div className="space-y-3">
                        {SECTION_TEMPLATES.map((template) => (
                            <DroppableTemplate
                                key={template.type}
                                template={template}
                                onAdd={() => addSection(template.type)}
                            />
                        ))}
                    </div>

                    {/* Gemini Generation Section */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            <h3 className="text-sm font-bold text-gray-900">AI生成</h3>
                        </div>
                        <button
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all"
                            onClick={() => setIsGeminiModalOpen(true)}
                        >
                            <Sparkles className="h-4 w-4" />
                            Geminiで生成
                        </button>
                    </div>
                </div>

                {/* Center - Canvas Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="mx-auto max-w-4xl">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-16 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                                <p className="text-sm text-gray-500">読み込み中...</p>
                            </div>
                        ) : sections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-16 text-center">
                                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-xl">
                                    ✨
                                </div>
                                <h3 className="mb-2 text-xl font-bold text-gray-900">LPを作り始めましょう</h3>
                                <p className="mb-6 text-sm text-gray-500">
                                    左のサイドバーからセクションを選んで追加、<br />
                                    または既存のLPを選択して編集
                                </p>
                                <button
                                    onClick={() => setShowPageSelector(true)}
                                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                                >
                                    <FolderOpen className="h-4 w-4" />
                                    既存LPを開く
                                </button>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragCancel={handleDragCancel}
                            >
                                <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-4">
                                        {sections.map((section) => (
                                            <SortableSection
                                                key={section.id}
                                                section={section}
                                                onSelect={setSelectedSectionId}
                                                onDelete={deleteSection}
                                                isSelected={selectedSectionId === section.id}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>

                                <DragOverlay>
                                    {activeId ? (
                                        <div className="rounded-2xl border-2 border-blue-500 bg-white p-4 shadow-2xl opacity-90">
                                            <div className="flex items-center gap-3">
                                                <GripVertical className="h-5 w-5 text-gray-400" />
                                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl shadow-md">
                                                    {SECTION_TEMPLATES.find(t => t.type === sections.find(s => s.id === activeId)?.type)?.icon}
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-gray-900">
                                                        {sections.find(s => s.id === activeId)?.name}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        )}

                        {sections.length > 0 && (
                            <div className="mt-8 flex justify-center">
                                <div className="text-xs font-medium text-gray-400">
                                    左のサイドバーから追加のセクションを選択
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Properties Panel */}
                <div className="w-96 border-l border-gray-200 bg-white p-6 overflow-y-auto">
                    {selectedSection ? (
                        <>
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Settings className="h-5 w-5 text-gray-700" />
                                    <h2 className="text-lg font-bold text-gray-900">プロパティ</h2>
                                </div>
                                <p className="text-xs text-gray-500">選択したセクションの設定</p>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        セクション名
                                    </label>
                                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-xl">
                                            {SECTION_TEMPLATES.find(t => t.type === selectedSection.type)?.icon || '📄'}
                                        </div>
                                        <span className="font-bold text-gray-900">{selectedSection.name}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        <Type className="inline h-3 w-3 mr-1" />
                                        タイトル
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedSection.properties.title || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'title', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                        placeholder="セクションのタイトル"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        サブタイトル
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedSection.properties.subtitle || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'subtitle', e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                        placeholder="サブタイトル（オプション）"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        説明文
                                    </label>
                                    <textarea
                                        value={selectedSection.properties.description || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'description', e.target.value)}
                                        rows={4}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 resize-none"
                                        placeholder="セクションの説明文"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        背景色
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            type="color"
                                            value={selectedSection.properties.backgroundColor || '#ffffff'}
                                            onChange={(e) => updateSectionProperty(selectedSection.id, 'backgroundColor', e.target.value)}
                                            className="h-12 w-12 rounded-xl border-2 border-gray-200 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedSection.properties.backgroundColor || '#ffffff'}
                                            onChange={(e) => updateSectionProperty(selectedSection.id, 'backgroundColor', e.target.value)}
                                            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                            placeholder="#ffffff"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-400">
                                        文字色
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            type="color"
                                            value={selectedSection.properties.textColor || '#000000'}
                                            onChange={(e) => updateSectionProperty(selectedSection.id, 'textColor', e.target.value)}
                                            className="h-12 w-12 rounded-xl border-2 border-gray-200 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={selectedSection.properties.textColor || '#000000'}
                                            onChange={(e) => updateSectionProperty(selectedSection.id, 'textColor', e.target.value)}
                                            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => deleteSection(selectedSection.id)}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        セクションを削除
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
                                👈
                            </div>
                            <h3 className="mb-2 text-base font-bold text-gray-900">セクションを選択</h3>
                            <p className="text-sm text-gray-500">
                                編集するセクションをクリックしてください
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-6">
                    <div className="relative h-full w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                            <div className="flex items-center gap-3">
                                <Maximize2 className="h-5 w-5 text-gray-700" />
                                <h2 className="text-lg font-bold text-gray-900">プレビュー</h2>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="h-[calc(100%-64px)] overflow-y-auto">
                            {sections.map((section) => (
                                <div
                                    key={section.id}
                                    className="p-12"
                                    style={{
                                        backgroundColor: section.properties.backgroundColor,
                                        color: section.properties.textColor,
                                    }}
                                >
                                    <div className="mx-auto max-w-4xl">
                                        {section.properties.title && (
                                            <h2 className="mb-4 text-4xl font-black">{section.properties.title}</h2>
                                        )}
                                        {section.properties.subtitle && (
                                            <h3 className="mb-6 text-xl font-bold opacity-80">{section.properties.subtitle}</h3>
                                        )}
                                        {section.properties.description && (
                                            <p className="text-lg leading-relaxed opacity-90">{section.properties.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close page selector */}
            {showPageSelector && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPageSelector(false)}
                />
            )}
            {/* Gemini Generator Modal */}
            <GeminiGeneratorModal
                isOpen={isGeminiModalOpen}
                onClose={() => setIsGeminiModalOpen(false)}
                onGenerated={handleGeminiGenerated}
            />
        </div>
    );
}
