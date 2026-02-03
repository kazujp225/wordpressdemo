"use client";

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, Eye, Plus, FileText, ChevronDown, Sparkles, Layout, Settings, Type, ExternalLink, Box, Trash2, MonitorPlay, MousePointer, Search, Bot, Image, PenTool } from 'lucide-react';
import { GeminiGeneratorModal } from '@/components/lp-builder/GeminiGeneratorModal';
import { TextBasedLPGenerator } from '@/components/lp-builder/TextBasedLPGenerator';
import { SEOLLMOOptimizer } from '@/components/lp-builder/SEOLLMOOptimizer';
import { SortableSection } from '@/components/lp-builder/SortableSection';
import { ImageInpaintEditor } from '@/components/lp-builder/ImageInpaintEditor';
import { SECTION_TEMPLATES, SectionTemplate } from '@/components/lp-builder/constants';
import toast from 'react-hot-toast';
import type { LPSection, ExistingPage, ClickableArea } from '@/types';

// Button Editor Wrapper Component
function ButtonEditorWrapper({
    sectionId,
    sections,
    onClose,
    onSave,
}: {
    sectionId: string;
    sections: LPSection[];
    onClose: () => void;
    onSave: (sectionId: string, areas: ClickableArea[]) => void;
}) {
    const editingSection = sections.find(s => s.id === sectionId);
    const imageUrl = editingSection?.properties.image as string | undefined;

    // If no image, show a placeholder canvas
    // Use encodeURIComponent instead of btoa to handle non-ASCII characters (Japanese, etc.)
    const svgContent = `
        <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#f3f4f6" width="100%" height="100%"/>
            <text x="50%" y="45%" font-family="system-ui" font-size="24" fill="#9ca3af" text-anchor="middle">
                ${editingSection?.properties.title || 'Section Preview'}
            </text>
            <text x="50%" y="55%" font-family="system-ui" font-size="14" fill="#d1d5db" text-anchor="middle">
                Drag to define clickable button areas
            </text>
        </svg>
    `;
    const placeholderImage = 'data:image/svg+xml,' + encodeURIComponent(svgContent);

    // Callback for saving clickable areas
    const handleSaveClickableAreas = React.useCallback((areas: ClickableArea[]) => {
        onSave(sectionId, areas);
    }, [sectionId, onSave]);

    return (
        <ImageInpaintEditor
            imageUrl={imageUrl || placeholderImage}
            onClose={onClose}
            onSave={onClose}
            clickableAreas={(editingSection?.properties.clickableAreas as ClickableArea[]) || []}
            onSaveClickableAreas={handleSaveClickableAreas}
            initialMode="button"
            sectionId={sectionId}
        />
    );
}

function DroppableTemplate({ template, onAdd }: { template: SectionTemplate; onAdd: () => void }) {
    return (
        <button
            onClick={onAdd}
            className="group relative flex flex-col items-center gap-3 rounded-2xl border border-transparent bg-white/40 p-5 transition-all duration-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-100/50 hover:-translate-y-0.5"
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 text-2xl text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors duration-300 shadow-sm border border-transparent group-hover:border-indigo-100/50">
                {template.icon}
            </div>
            <div className="text-center w-full">
                <p className="text-xs font-bold text-foreground tracking-wide font-manrope">{template.name}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
                <div className="bg-indigo-50 p-1 rounded-md">
                    <Plus className="h-3 w-3 text-indigo-500" />
                </div>
            </div>
        </button>
    );
}

export default function LPBuilderPage() {
    const [sections, setSections] = useState<LPSection[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [showPageSelector, setShowPageSelector] = useState(false);
    const [existingPages, setExistingPages] = useState<ExistingPage[]>([]);
    const [currentPageId, setCurrentPageId] = useState<number | null>(null);
    const [currentPageTitle, setCurrentPageTitle] = useState<string>('Untitled Page');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
    const [isTextBasedModalOpen, setIsTextBasedModalOpen] = useState(false);
    const [showGeneratorSelector, setShowGeneratorSelector] = useState(false);
    const [isSEOModalOpen, setIsSEOModalOpen] = useState(false);
    const [buttonEditorSectionId, setButtonEditorSectionId] = useState<string | null>(null);
    const [headerConfig, setHeaderConfig] = useState<{
        logoText: string;
        navItems: { label: string; href: string }[];
        ctaText: string;
        ctaLink: string;
        sticky: boolean;
    }>({
        logoText: 'My Brand',
        navItems: [],
        ctaText: 'お問い合わせ',
        ctaLink: '#contact',
        sticky: true,
    });
    const [isGeneratingNav, setIsGeneratingNav] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fetch existing pages
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

    // Load existing page
    const loadPage = async (page: ExistingPage) => {
        setIsLoading(true);
        try {
            const loadedSections: LPSection[] = page.sections.map((s: any, idx: number) => {
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

    // Create new page
    const createNew = () => {
        setSections([]);
        setCurrentPageId(null);
        setCurrentPageTitle('Untitled Page');
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

    // Generate navigation/header from sections using AI
    const generateNavigation = async () => {
        if (sections.length === 0) {
            toast.error('セクションがありません');
            return;
        }

        setIsGeneratingNav(true);
        try {
            // Prepare sections data with images
            const sectionsData = sections.map(s => ({
                role: s.type,
                base64: s.properties.image,
                image: s.properties.image ? { filePath: s.properties.image } : null,
            }));

            const res = await fetch('/api/ai/generate-nav', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: sectionsData }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'ナビゲーション生成に失敗しました');
            }

            const navData = await res.json();
            if (navData && !navData.error) {
                setHeaderConfig(prev => ({
                    ...prev,
                    logoText: navData.logoText || prev.logoText,
                    navItems: navData.navItems || prev.navItems,
                    ctaText: navData.ctaText || prev.ctaText,
                }));
                toast.success('ヘッダーを生成しました');
            }
        } catch (error: any) {
            console.error('Navigation generation error:', error);
            toast.error(error.message || 'ヘッダー生成に失敗しました');
        } finally {
            setIsGeneratingNav(false);
        }
    };

    const addSection = (type: string) => {
        const template = SECTION_TEMPLATES.find(t => t.type === type);
        if (!template) return;

        const newSection: LPSection = {
            id: `section-${Date.now()}`,
            type: template.type,
            name: template.name,
            properties: {
                title: `${template.name}`,
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

    const updateSectionProperty = (id: string, key: keyof LPSection['properties'], value: string) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === id
                    ? { ...s, properties: { ...s.properties, [key]: value } }
                    : s
            )
        );
    };

    // Save clickable areas for a section
    const saveClickableAreas = (sectionId: string, areas: ClickableArea[]) => {
        setSections((prev) =>
            prev.map((s) =>
                s.id === sectionId
                    ? { ...s, properties: { ...s.properties, clickableAreas: areas } }
                    : s
            )
        );
        setButtonEditorSectionId(null);
        toast.success(`${areas.length}個のボタンを保存しました`);
    };

    // Apply Gemini Generated Result
    const handleGeminiGenerated = (generatedSections: any[], meta?: { duration: number, estimatedCost: number }) => {
        const newSections = generatedSections.map((s: any, idx: number) => ({
            id: `section-${Date.now()}-${idx}`,
            type: s.type,
            name: SECTION_TEMPLATES.find(t => t.type === s.type)?.name || s.type,
            properties: {
                ...s.properties,
            },
            imageId: s.imageId || null,
        }));

        setSections((prev) => [...prev, ...newSections]);

        if (newSections.length > 0) {
            setSelectedSectionId(newSections[0].id);
        }
        setIsGeminiModalOpen(false);

        if (meta) {
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Sparkles className="h-10 w-10 text-indigo-500" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                    Generation Complete
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Generated {newSections.length} sections in {(meta.duration / 1000).toFixed(1)}s.
                                </p>
                                <div className="mt-2 flex items-center text-xs text-gray-400 font-mono">
                                    <span className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-600 mr-2">
                                        ¥{meta.estimatedCost} est.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 5000 });
        }
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
                toast.success('Saved successfully');
            } else {
                toast.error('Failed to save: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f4f4f5] font-sans text-[#1c1c1c] overflow-hidden">

            {/* 1. Left Sidebar: Navigation & Elements */}
            <div className="w-[300px] flex flex-col bg-white/80 backdrop-blur-xl border-r border-gray-100 z-20 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.02)]">
                <div className="h-16 flex items-center px-6 border-b border-gray-100/50">
                    <div className="flex items-center gap-2 font-bold text-lg tracking-tight font-manrope">
                        <div className="w-5 h-5 bg-black rounded-md shadow-sm shadow-black/20"></div>
                        そっくりLP
                    </div>
                </div>

                <div className="p-4 relative">
                    <button
                        onClick={() => setShowGeneratorSelector(!showGeneratorSelector)}
                        className="group w-full relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-px shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02]"
                    >
                        <div className="relative flex items-center justify-between rounded-[11px] bg-black/10 px-4 py-3 backdrop-blur-sm transition-all group-hover:bg-transparent">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-medium text-indigo-100">AI Generator</div>
                                    <div className="text-sm font-bold text-white">Generate Page</div>
                                </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${showGeneratorSelector ? 'rotate-180' : ''}`} />
                        </div>
                    </button>

                    {/* Generator Mode Selector Dropdown */}
                    {showGeneratorSelector && (
                        <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-xl shadow-2xl shadow-black/10 border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-2">
                                <button
                                    onClick={() => {
                                        setIsGeminiModalOpen(true);
                                        setShowGeneratorSelector(false);
                                    }}
                                    className="w-full flex items-start gap-3 rounded-lg p-3 hover:bg-indigo-50 transition-all text-left group"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors shrink-0">
                                        <Image className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900">参考サイトから作成</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                            スクリーンショットをアップロードして<br />デザインを参考にLP作成
                                        </div>
                                    </div>
                                </button>

                                <div className="h-px bg-gray-100 my-1" />

                                <button
                                    onClick={() => {
                                        setIsTextBasedModalOpen(true);
                                        setShowGeneratorSelector(false);
                                    }}
                                    className="w-full flex items-start gap-3 rounded-lg p-3 hover:bg-green-50 transition-all text-left group"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 group-hover:bg-green-200 transition-colors shrink-0">
                                        <PenTool className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900">テキストから作成</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                                            商材情報を入力して<br />ゼロからLP作成
                                        </div>
                                        <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full uppercase tracking-wider">
                                            New
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="mb-4 flex items-center gap-2 mt-4">
                        <Box className="h-3 w-3 text-gray-400" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Components</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {SECTION_TEMPLATES.map((template) => (
                            <DroppableTemplate
                                key={template.type}
                                template={template}
                                onAdd={() => addSection(template.type)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Middle: Canvas Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f4f4f5] relative">

                {/* Top Toolbar */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200/50 bg-white/60 backdrop-blur-xl z-10 sticky top-0 supports-[backdrop-filter]:bg-white/60">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <button
                                onClick={() => setShowPageSelector(!showPageSelector)}
                                className="flex items-center gap-2 text-sm font-bold hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                {currentPageTitle}
                                <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-black transition-colors" />
                            </button>

                            {/* Page Selector Dropdown */}
                            {showPageSelector && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl shadow-black/5 border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-2 border-b border-gray-50">
                                        <button
                                            onClick={createNew}
                                            className="w-full flex items-center gap-2 rounded-lg bg-black px-3 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition-all"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Create New Page
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-1">
                                        {existingPages.map((page) => (
                                            <button
                                                key={page.id}
                                                onClick={() => loadPage(page)}
                                                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all hover:bg-gray-50 ${currentPageId === page.id ? 'bg-gray-50' : ''}`}
                                            >
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="font-medium text-gray-900 truncate text-xs">{page.title}</div>
                                                    <div className="text-[10px] text-gray-400">
                                                        {new Date(page.updatedAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <input
                                type="text"
                                value={currentPageTitle}
                                onChange={(e) => setCurrentPageTitle(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentPageId && (
                            <a
                                href={`/p/${existingPages.find(p => p.id === currentPageId)?.slug || currentPageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                                title="View Live"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        )}
                        <button
                            onClick={() => setIsSEOModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-purple-100 hover:border-blue-300 transition-all"
                            title="SEO / LLMO Optimization"
                        >
                            <Search className="h-3 w-3 text-blue-600" />
                            <Bot className="h-3 w-3 text-purple-600" />
                            <span className="hidden lg:inline">SEO/LLMO</span>
                        </button>
                        <button
                            onClick={generateNavigation}
                            disabled={isGeneratingNav || sections.length === 0}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
                            title="AIでヘッダーを自動生成"
                        >
                            {isGeneratingNav ? (
                                <div className="h-3 w-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            ) : (
                                <Layout className="h-3 w-3" />
                            )}
                            Header
                        </button>
                        <button
                            onClick={() => {
                                // Save sections and header to localStorage and open preview in new tab
                                localStorage.setItem('lp-builder-preview', JSON.stringify({ sections, headerConfig }));
                                window.open('/preview/lp-builder', '_blank');
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                            <Eye className="h-3 w-3" />
                            Preview
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || sections.length === 0}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/5"
                        >
                            <Save className="h-3 w-3" />
                            {isSaving ? 'Saving...' : 'Save Page'}
                        </button>
                    </div>
                </div>

                {/* Canvas Content */}
                <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative">
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    <div className="relative mx-auto max-w-3xl min-h-[500px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-32">
                                <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
                                <p className="text-xs font-medium text-gray-400 tracking-widest uppercase">Loading Canvas</p>
                            </div>
                        ) : sections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="bg-white/50 backdrop-blur-md p-8 rounded-3xl shadow-2xl shadow-indigo-100/50 border border-white/60 mb-8 max-w-sm relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-1 ring-gray-100 group-hover:scale-110 transition-transform duration-300">
                                        <Layout className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight relative z-10">Start Building</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed mb-6 relative z-10 font-medium">
                                        AIジェネレーターを使って自動生成、<br />または左のコンポーネントをドラッグ
                                    </p>
                                    <div className="space-y-2 relative z-10">
                                        <button
                                            onClick={() => setIsGeminiModalOpen(true)}
                                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all"
                                        >
                                            <Image className="w-4 h-4" />
                                            参考サイトから作成
                                        </button>
                                        <button
                                            onClick={() => setIsTextBasedModalOpen(true)}
                                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-green-700 transition-all"
                                        >
                                            <PenTool className="w-4 h-4" />
                                            テキストから作成
                                        </button>
                                    </div>
                                </div>
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
                                    <div className="space-y-6 pb-32">
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
                                        <div className="rounded-xl bg-white shadow-2xl p-4 border border-indigo-100 opacity-90 scale-105 rotate-1 cursor-grabbing">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-500">
                                                    {SECTION_TEMPLATES.find(t => t.type === sections.find(s => s.id === activeId)?.type)?.icon}
                                                </div>
                                                <div className="font-bold text-sm">
                                                    {sections.find(s => s.id === activeId)?.name}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Right Sidebar: Properties */}
            <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col z-20">
                {selectedSection ? (
                    <>
                        <div className="h-16 flex items-center px-6 border-b border-gray-100 justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Properties</span>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                <span className="text-xs font-bold text-gray-900">{selectedSection.name}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Content Group */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-900">
                                    <Type className="h-3 w-3 text-gray-400" />
                                    Content
                                </label>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={selectedSection.properties.title || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'title', e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all placeholder:font-normal"
                                        placeholder="Section Title"
                                    />
                                    <input
                                        type="text"
                                        value={selectedSection.properties.subtitle || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'subtitle', e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                                        placeholder="Subtitle"
                                    />
                                    <textarea
                                        value={selectedSection.properties.description || ''}
                                        onChange={(e) => updateSectionProperty(selectedSection.id, 'description', e.target.value)}
                                        rows={4}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all resize-none leading-relaxed"
                                        placeholder="Description text..."
                                    />
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Appearance Group */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-900">
                                    <Settings className="h-3 w-3 text-gray-400" />
                                    Appearance
                                </label>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Background</span>
                                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                            <input
                                                type="color"
                                                value={selectedSection.properties.backgroundColor || '#ffffff'}
                                                onChange={(e) => updateSectionProperty(selectedSection.id, 'backgroundColor', e.target.value)}
                                                className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedSection.properties.backgroundColor || '#ffffff'}
                                                onChange={(e) => updateSectionProperty(selectedSection.id, 'backgroundColor', e.target.value)}
                                                className="flex-1 bg-transparent text-xs font-mono text-gray-600 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Text Color</span>
                                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                            <input
                                                type="color"
                                                value={selectedSection.properties.textColor || '#000000'}
                                                onChange={(e) => updateSectionProperty(selectedSection.id, 'textColor', e.target.value)}
                                                className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedSection.properties.textColor || '#000000'}
                                                onChange={(e) => updateSectionProperty(selectedSection.id, 'textColor', e.target.value)}
                                                className="flex-1 bg-transparent text-xs font-mono text-gray-600 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Button Settings */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-900">
                                    <MousePointer className="h-3 w-3 text-gray-400" />
                                    Interactive Buttons
                                </label>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => setButtonEditorSectionId(selectedSection.id)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100/80 transition-all"
                                    >
                                        <MousePointer className="h-3 w-3" />
                                        {(selectedSection.properties.clickableAreas as ClickableArea[] | undefined)?.length
                                            ? `Edit Buttons (${(selectedSection.properties.clickableAreas as ClickableArea[]).length})`
                                            : 'Add Clickable Buttons'}
                                    </button>
                                    {(selectedSection.properties.clickableAreas as ClickableArea[] | undefined)?.length ? (
                                        <p className="text-[10px] text-gray-500 text-center">
                                            {(selectedSection.properties.clickableAreas as ClickableArea[]).length} buttons configured
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="pt-8">
                                <button
                                    onClick={() => deleteSection(selectedSection.id)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-100 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100/80 transition-all"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Delete Section
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
                        <MonitorPlay className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-sm font-medium text-gray-900">No Selection</p>
                        <p className="text-xs text-gray-500 mt-1">Select a section to edit properties</p>
                    </div>
                )}
            </div>

            {/* Gemini Modal - Screenshot Based */}
            <GeminiGeneratorModal
                isOpen={isGeminiModalOpen}
                onClose={() => setIsGeminiModalOpen(false)}
                onGenerated={handleGeminiGenerated}
            />

            {/* Text-Based LP Generator Modal */}
            <TextBasedLPGenerator
                isOpen={isTextBasedModalOpen}
                onClose={() => setIsTextBasedModalOpen(false)}
                onGenerated={handleGeminiGenerated}
            />

            {/* SEO/LLMO Optimizer Modal - ステルス対策 */}
            <SEOLLMOOptimizer
                isOpen={isSEOModalOpen}
                onClose={() => setIsSEOModalOpen(false)}
                pageId={currentPageId}
                onSaved={() => {
                    toast.success('ステルスSEO/LLMO対策を保存しました');
                }}
            />

            {/* Button Editor Modal */}
            {buttonEditorSectionId && (
                <ButtonEditorWrapper
                    sectionId={buttonEditorSectionId}
                    sections={sections}
                    onClose={() => setButtonEditorSectionId(null)}
                    onSave={saveClickableAreas}
                />
            )}

        </div>
    );
}
