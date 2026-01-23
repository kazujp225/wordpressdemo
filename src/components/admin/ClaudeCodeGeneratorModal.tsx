"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Copy, Check, Eye, Code2, ArrowRight, Plus, Trash2, ChevronDown, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { TEMPLATES } from '@/lib/claude-templates';
import type { FormField, DesignContext } from '@/lib/claude-templates';
import toast from 'react-hot-toast';

interface Section {
  id: number | string;
  order: number;
  role: string;
  image?: { filePath: string; width?: number; height?: number } | null;
  config?: any;
}

interface ClaudeCodeGeneratorModalProps {
  onClose: () => void;
  sections: Section[];
  designDefinition?: DesignContext | null;
  layoutMode: 'desktop' | 'responsive';
  onInsertHtml: (html: string, insertIndex: number, meta: { templateType: string; prompt: string }) => void;
}

type Step = 'template' | 'fields' | 'prompt' | 'generating' | 'preview' | 'insert';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'system';
}

const FIELD_TYPES: { value: FormField['type']; label: string; icon: string }[] = [
  { value: 'text', label: 'テキスト', icon: 'Aa' },
  { value: 'email', label: 'メール', icon: '@' },
  { value: 'tel', label: '電話番号', icon: '#' },
  { value: 'number', label: '数値', icon: '123' },
  { value: 'textarea', label: 'テキストエリア', icon: '¶' },
  { value: 'select', label: 'セレクト', icon: '▾' },
  { value: 'radio', label: 'ラジオ', icon: '◉' },
  { value: 'checkbox', label: 'チェックボックス', icon: '☑' },
  { value: 'date', label: '日付', icon: '日' },
  { value: 'time', label: '時間', icon: '時' },
];

const PRESET_FIELDS: { label: string; fields: FormField[] }[] = [
  {
    label: '氏名',
    fields: [
      { id: 'pre-sei', label: '姓', type: 'text', required: true, placeholder: '山田', halfWidth: true },
      { id: 'pre-mei', label: '名', type: 'text', required: true, placeholder: '太郎', halfWidth: true },
    ],
  },
  {
    label: 'メール',
    fields: [{ id: 'pre-email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'info@example.com' }],
  },
  {
    label: '電話',
    fields: [{ id: 'pre-tel', label: '電話番号', type: 'tel', required: false, placeholder: '090-0000-0000' }],
  },
  {
    label: '会社名',
    fields: [{ id: 'pre-company', label: '会社名', type: 'text', required: false, placeholder: '株式会社〇〇' }],
  },
  {
    label: '日時',
    fields: [
      { id: 'pre-date', label: '希望日', type: 'date', required: true, halfWidth: true },
      { id: 'pre-time', label: '希望時間', type: 'time', required: false, halfWidth: true },
    ],
  },
  {
    label: '備考',
    fields: [{ id: 'pre-remarks', label: '備考・ご要望', type: 'textarea', required: false, placeholder: '自由にご記入ください' }],
  },
];

const FIELD_TYPE_COLOR: Record<FormField['type'], string> = {
  text: 'bg-gray-100 text-gray-600',
  email: 'bg-blue-50 text-blue-600',
  tel: 'bg-green-50 text-green-600',
  number: 'bg-orange-50 text-orange-600',
  textarea: 'bg-purple-50 text-purple-600',
  select: 'bg-cyan-50 text-cyan-600',
  radio: 'bg-pink-50 text-pink-600',
  checkbox: 'bg-yellow-50 text-yellow-700',
  date: 'bg-teal-50 text-teal-600',
  time: 'bg-indigo-50 text-indigo-600',
};

const TEMPLATE_ICONS: Record<string, { bg: string; text: string }> = {
  'contact-form': { bg: 'bg-blue-50', text: 'text-blue-600' },
  'booking-form': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'landing-page': { bg: 'bg-violet-50', text: 'text-violet-600' },
  'portfolio': { bg: 'bg-amber-50', text: 'text-amber-600' },
  'custom': { bg: 'bg-gray-50', text: 'text-gray-600' },
};

function getTimestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

const GENERATING_LOGS: { message: string; type: LogEntry['type']; delay: number }[] = [
  { message: 'Initializing Claude Sonnet 4 engine...', type: 'system', delay: 200 },
  { message: 'Loading model weights: claude-sonnet-4-20250514', type: 'info', delay: 600 },
  { message: 'Template context loaded successfully', type: 'success', delay: 400 },
  { message: 'Tokenizing user prompt...', type: 'info', delay: 300 },
  { message: 'Estimated input tokens: calculating...', type: 'info', delay: 500 },
  { message: 'Establishing connection to Anthropic API', type: 'system', delay: 700 },
  { message: 'TLS handshake complete', type: 'info', delay: 300 },
  { message: 'Sending request payload (max_tokens: 8192)', type: 'info', delay: 400 },
  { message: 'Awaiting model response...', type: 'system', delay: 1200 },
  { message: 'Stream started: receiving chunks...', type: 'success', delay: 800 },
  { message: 'Generating HTML document structure', type: 'info', delay: 1000 },
  { message: 'Writing responsive CSS rules', type: 'info', delay: 1200 },
  { message: 'Applying layout breakpoints', type: 'info', delay: 800 },
  { message: 'Adding JavaScript event handlers', type: 'info', delay: 1000 },
  { message: 'Injecting form validation logic', type: 'info', delay: 900 },
  { message: 'Applying design definition palette...', type: 'system', delay: 700 },
  { message: 'Validating HTML5 semantics', type: 'info', delay: 500 },
  { message: 'Accessibility checks: ARIA labels applied', type: 'success', delay: 600 },
];

export default function ClaudeCodeGeneratorModal({ onClose, sections, designDefinition, layoutMode, onInsertHtml }: ClaudeCodeGeneratorModalProps) {
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apiDone, setApiDone] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const [editingFieldOptions, setEditingFieldOptions] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (step !== 'generating') return;

    abortRef.current = false;
    let totalDelay = 0;
    const timers: NodeJS.Timeout[] = [];

    GENERATING_LOGS.forEach((log) => {
      totalDelay += log.delay;
      const timer = setTimeout(() => {
        if (abortRef.current) return;
        setLogs(prev => [...prev, { time: getTimestamp(), message: log.message, type: log.type }]);
      }, totalDelay);
      timers.push(timer);
    });

    const extraInterval = setTimeout(() => {
      const interval = setInterval(() => {
        if (abortRef.current) {
          clearInterval(interval);
          return;
        }
        const msgs = [
          'Processing output buffer...',
          'Chunk received: parsing content block',
          'Token count accumulating...',
          'Streaming delta content...',
          'Assembling response fragments...',
        ];
        setLogs(prev => [...prev, { time: getTimestamp(), message: msgs[Math.floor(Math.random() * msgs.length)], type: 'info' }]);
      }, 1500);
      timers.push(interval as any);
    }, totalDelay + 500);
    timers.push(extraInterval);

    return () => {
      timers.forEach(t => clearTimeout(t));
      abortRef.current = true;
    };
  }, [step]);

  useEffect(() => {
    if (apiDone && step === 'generating') {
      abortRef.current = true;
      setLogs(prev => [
        ...prev,
        { time: getTimestamp(), message: 'Response complete. Extracting HTML...', type: 'success' },
        { time: getTimestamp(), message: `Output: ${generatedHtml.length} bytes generated`, type: 'success' },
        { time: getTimestamp(), message: 'BUILD SUCCESSFUL', type: 'success' },
      ]);
      setTimeout(() => setStep('preview'), 800);
      setApiDone(false);
    }
  }, [apiDone, step, generatedHtml]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      if (template.defaultUserPrompt) setPrompt(template.defaultUserPrompt);
      if (template.hasFormFields && template.defaultFields) {
        setFormFields([...template.defaultFields]);
        setStep('fields');
        return;
      }
    }
    setStep('prompt');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLogs([]);
    setStep('generating');

    try {
      const template = TEMPLATES.find(t => t.id === selectedTemplate);
      const response = await fetch('/api/ai/claude-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          prompt: prompt.trim(),
          layoutMode,
          designContext: designDefinition || null,
          formFields: template?.hasFormFields ? formFields : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        abortRef.current = true;
        setLogs(prev => [...prev, { time: getTimestamp(), message: `ERROR: ${data.message || 'Failed'}`, type: 'warn' }]);
        setTimeout(() => setStep('prompt'), 1500);
        toast.error(data.message || 'Generation failed');
        return;
      }

      setGeneratedHtml(data.html);
      setEstimatedCost(data.estimatedCost || 0);
      setApiDone(true);
    } catch (error) {
      abortRef.current = true;
      setLogs(prev => [...prev, { time: getTimestamp(), message: 'FATAL: Connection error', type: 'warn' }]);
      setTimeout(() => setStep('prompt'), 1500);
      toast.error('Connection error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertAt = (index: number) => {
    onInsertHtml(generatedHtml, index, { templateType: selectedTemplate, prompt });
    toast.success(`セクション ${index + 1} の位置に配置しました`);
    onClose();
  };

  // Form field management
  const addField = () => {
    setFormFields(prev => [
      ...prev,
      { id: `field-${Date.now()}`, label: '', type: 'text', required: false, placeholder: '' }
    ]);
  };

  const removeField = (id: string) => {
    setFormFields(prev => prev.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFormFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formFields.length) return;
    const updated = [...formFields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFormFields(updated);
  };

  const addOption = (fieldId: string) => {
    if (!newOptionText.trim()) return;
    updateField(fieldId, {
      options: [...(formFields.find(f => f.id === fieldId)?.options || []), newOptionText.trim()]
    });
    setNewOptionText('');
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = formFields.find(f => f.id === fieldId);
    if (!field?.options) return;
    updateField(fieldId, { options: field.options.filter((_, i) => i !== optionIndex) });
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'warn': return 'text-red-400';
      case 'system': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplate);
  const allSteps: Step[] = currentTemplate?.hasFormFields
    ? ['template', 'fields', 'prompt', 'generating', 'preview', 'insert']
    : ['template', 'prompt', 'generating', 'preview', 'insert'];

  const goBack = () => {
    if (step === 'fields') setStep('template');
    else if (step === 'prompt') {
      setStep(currentTemplate?.hasFormFields ? 'fields' : 'template');
    }
    else if (step === 'preview') setStep('prompt');
    else if (step === 'insert') setStep('preview');
  };

  const stepIndex = allSteps.indexOf(step);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[88vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {(step === 'fields' || step === 'prompt' || step === 'preview' || step === 'insert') && (
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-4 w-4 text-gray-400" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 leading-none">AI Code Generator</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Claude Sonnet 4</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Layout & design badges */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                {layoutMode === 'desktop' ? 'Desktop' : 'Responsive'}
              </span>
              {designDefinition && (
                <span className="text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                  Design
                </span>
              )}
            </div>
            {/* Step progress dots */}
            <div className="hidden sm:flex items-center gap-1">
              {allSteps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    i < stepIndex ? 'w-1.5 bg-gray-800' :
                    i === stepIndex ? 'w-4 bg-gray-800' :
                    'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Template Selection */}
          {step === 'template' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">テンプレートを選択</h3>
                <p className="text-sm text-gray-500 mt-1">生成するコンポーネントのタイプを選んでください</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TEMPLATES.map((template) => {
                  const colors = TEMPLATE_ICONS[template.id] || { bg: 'bg-gray-50', text: 'text-gray-600' };
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className="group relative p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-9 w-9 rounded-lg ${colors.bg} flex items-center justify-center`}>
                          <span className={`text-sm font-bold ${colors.text}`}>{template.icon}</span>
                        </div>
                        {template.hasFormFields && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">フォーム</span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                        {template.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{template.description}</p>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
                <span>~$0.03-0.10 / 生成</span>
                <span>model: claude-sonnet-4-20250514</span>
              </div>
            </div>
          )}

          {/* Form Fields Builder */}
          {step === 'fields' && (
            <div className="p-6">
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-6 w-6 rounded ${TEMPLATE_ICONS[selectedTemplate]?.bg || 'bg-gray-50'} flex items-center justify-center`}>
                    <span className={`text-[10px] font-bold ${TEMPLATE_ICONS[selectedTemplate]?.text || 'text-gray-600'}`}>
                      {currentTemplate?.icon}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{currentTemplate?.name}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">フォームフィールド設定</h3>
                <p className="text-sm text-gray-500 mt-1">フィールドの追加・並び替え・設定を行ってください</p>
              </div>

              {/* Preset quick-add */}
              <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">クイック追加</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_FIELDS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const newFields = preset.fields.map(f => ({
                          ...f,
                          id: `${f.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                        }));
                        setFormFields(prev => [...prev, ...newFields]);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:text-gray-800 hover:shadow-sm transition-all"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 mb-4 max-h-[360px] overflow-y-auto pr-1">
                {formFields.map((field, index) => (
                  <div key={field.id} className={`bg-white border rounded-xl p-3.5 transition-all ${field.halfWidth ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-start gap-2.5">
                      {/* Type badge + Reorder */}
                      <div className="flex flex-col items-center gap-1 pt-0.5">
                        <div className={`h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold ${FIELD_TYPE_COLOR[field.type]}`}>
                          {FIELD_TYPES.find(ft => ft.value === field.type)?.icon || '?'}
                        </div>
                        <button
                          onClick={() => moveField(index, -1)}
                          disabled={index === 0}
                          className="text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveField(index, 1)}
                          disabled={index === formFields.length - 1}
                          className="text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Field config */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="ラベル名を入力..."
                            className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 placeholder:text-gray-400"
                          />
                          <div className="relative">
                            <select
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'], options: undefined })}
                              className="appearance-none px-2.5 py-1.5 pr-7 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none cursor-pointer hover:border-gray-300"
                            >
                              {FIELD_TYPES.map(ft => (
                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(field.id, { required: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-gray-800 focus:ring-gray-300"
                            />
                            <span className="text-xs text-gray-600">必須</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="デスクトップ表示時に50%幅（2列配置）">
                            <input
                              type="checkbox"
                              checked={field.halfWidth || false}
                              onChange={(e) => updateField(field.id, { halfWidth: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                            />
                            <span className="text-xs text-blue-600">半幅</span>
                          </label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            placeholder="プレースホルダー"
                            className="flex-1 min-w-[120px] px-2.5 py-1 bg-gray-50 border border-gray-150 rounded-lg text-xs text-gray-500 focus:outline-none focus:border-gray-300 placeholder:text-gray-300"
                          />
                        </div>

                        {/* Options for select/radio */}
                        {(field.type === 'select' || field.type === 'radio') && (
                          <div className="pl-3 border-l-2 border-gray-100">
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {(field.options || []).map((opt, optIdx) => (
                                <span key={optIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {opt}
                                  <button onClick={() => removeOption(field.id, optIdx)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                                </span>
                              ))}
                            </div>
                            {editingFieldOptions === field.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={newOptionText}
                                  onChange={(e) => setNewOptionText(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { addOption(field.id); } }}
                                  placeholder="選択肢を入力"
                                  className="flex-1 px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                                  autoFocus
                                />
                                <button onClick={() => addOption(field.id)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">追加</button>
                                <button onClick={() => { setEditingFieldOptions(null); setNewOptionText(''); }} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">完了</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingFieldOptions(field.id)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                + 選択肢を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeField(field.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addField}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 group"
              >
                <Plus className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                <span className="text-sm text-gray-400 group-hover:text-gray-600 font-medium">フィールドを追加</span>
              </button>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{formFields.length} フィールド</span>
                  {formFields.filter(f => f.halfWidth).length > 0 && (
                    <span className="text-blue-500">{formFields.filter(f => f.halfWidth).length} 半幅</span>
                  )}
                </div>
                <button
                  onClick={() => setStep('prompt')}
                  disabled={formFields.filter(f => f.label.trim()).length === 0}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  次へ
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Prompt Input */}
          {step === 'prompt' && (
            <div className="p-6">
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-6 w-6 rounded ${TEMPLATE_ICONS[selectedTemplate]?.bg || 'bg-gray-50'} flex items-center justify-center`}>
                    <span className={`text-[10px] font-bold ${TEMPLATE_ICONS[selectedTemplate]?.text || 'text-gray-600'}`}>
                      {currentTemplate?.icon}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{currentTemplate?.name}</span>
                  {formFields.length > 0 && (
                    <span className="text-xs text-gray-400">({formFields.length} fields)</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900">プロンプト入力</h3>
                <p className="text-sm text-gray-500 mt-1">生成するコンポーネントの詳細を記述してください</p>
              </div>

              {/* Context pills */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                  {layoutMode === 'desktop' ? 'Desktop' : 'Responsive'}
                </span>
                {designDefinition?.colorPalette && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    カラー:
                    <span className="inline-block w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: designDefinition.colorPalette.primary }} />
                    <span className="inline-block w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: designDefinition.colorPalette.accent }} />
                    <span className="inline-block w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: designDefinition.colorPalette.background }} />
                  </span>
                )}
                {designDefinition?.vibe && (
                  <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                    {designDefinition.vibe}
                  </span>
                )}
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-44 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all placeholder:text-gray-400"
                placeholder="生成したいコンポーネントの詳細を記述してください..."
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{prompt.length} 文字</span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="mt-4 w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                生成する
              </button>
            </div>
          )}

          {/* Generating - Terminal Log (keep dark for contrast) */}
          {step === 'generating' && (
            <div className="flex flex-col h-full">
              <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-900 flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-mono text-gray-400">
                  Building | claude-sonnet-4 | {layoutMode}
                </span>
              </div>
              <div
                ref={logContainerRef}
                className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed bg-gray-950"
                style={{ minHeight: '380px', maxHeight: '450px' }}
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-700 shrink-0">[{log.time}]</span>
                    <span className={getLogColor(log.type)}>{log.message}</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <span className="text-gray-700">[{getTimestamp()}]</span>
                  <span className="text-gray-600 animate-pulse">_</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Eye className="h-3 w-3" />
                      プレビュー
                    </button>
                    <button
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'code' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Code2 className="h-3 w-3" />
                      コード
                    </button>
                  </div>
                  {/* Device toggle for responsive preview */}
                  {layoutMode === 'responsive' && viewMode === 'preview' && (
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setPreviewDevice('desktop')}
                        className={`flex items-center px-2 py-1.5 rounded-md transition-all ${
                          previewDevice === 'desktop' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Desktop"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewDevice('mobile')}
                        className={`flex items-center px-2 py-1.5 rounded-md transition-all ${
                          previewDevice === 'mobile' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Mobile (375px)"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {estimatedCost > 0 && (
                    <span className="text-xs text-gray-400">${estimatedCost.toFixed(4)}</span>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'コピー済' : 'コピー'}
                  </button>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100 flex items-start justify-center" style={{ height: '420px' }}>
                {viewMode === 'preview' ? (
                  <div
                    className="h-full transition-all duration-300 ease-out bg-white"
                    style={{
                      width: previewDevice === 'mobile' && layoutMode === 'responsive' ? '375px' : '100%',
                      boxShadow: previewDevice === 'mobile' && layoutMode === 'responsive' ? '0 0 0 1px rgba(0,0,0,0.05), 0 4px 24px rgba(0,0,0,0.08)' : 'none',
                      borderRadius: previewDevice === 'mobile' && layoutMode === 'responsive' ? '0' : '0',
                    }}
                  >
                    <iframe srcDoc={generatedHtml} className="w-full h-full bg-white" sandbox="allow-scripts" title="Preview" />
                  </div>
                ) : (
                  <div className="h-full w-full bg-gray-950 overflow-auto rounded-xl">
                    <pre className="p-4 text-[11px] leading-relaxed text-gray-400 font-mono"><code>{generatedHtml}</code></pre>
                  </div>
                )}
              </div>
              {previewDevice === 'mobile' && layoutMode === 'responsive' && viewMode === 'preview' && (
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-gray-400">375px viewport</span>
                </div>
              )}
            </div>
          )}

          {/* Insert Position */}
          {step === 'insert' && (
            <div className="p-6">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900">配置位置の選択</h3>
                <p className="text-sm text-gray-500 mt-1">LP内のどこに挿入するか選択してください</p>
              </div>
              <div className="space-y-0">
                {/* Insert at top */}
                <button
                  onClick={() => handleInsertAt(0)}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-t-xl hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group"
                >
                  <Plus className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500" />
                  <span className="text-xs text-gray-400 group-hover:text-blue-600 font-medium">ここに挿入（先頭）</span>
                </button>

                {sortedSections.map((section, index) => (
                  <React.Fragment key={section.id}>
                    {/* Section preview */}
                    <div className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 border-x border-gray-200">
                      <span className="text-xs font-mono text-gray-400 w-5">{String(index + 1).padStart(2, '0')}</span>
                      {section.image?.filePath ? (
                        <div className="h-10 w-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={section.image.filePath.startsWith('http') ? section.image.filePath : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${section.image.filePath}`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-medium text-gray-400">{section.role === 'html-embed' ? 'HTML' : 'IMG'}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-600">{section.role || 'content'}</span>
                        {section.config?.htmlContent && (
                          <span className="ml-2 text-[10px] font-medium text-violet-500">Embed</span>
                        )}
                      </div>
                    </div>

                    {/* Insert point after this section */}
                    <button
                      onClick={() => handleInsertAt(index + 1)}
                      className="w-full py-2.5 border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group"
                    >
                      <Plus className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500" />
                      <span className="text-xs text-gray-400 group-hover:text-blue-600 font-medium">ここに挿入</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <button
              onClick={() => { setStep('prompt'); setGeneratedHtml(''); setLogs([]); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              再生成
            </button>
            <button
              onClick={() => setStep('insert')}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              LPに配置
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
