"use client";

import React, { useState } from 'react';
import {
  Trash2,
  Sparkles,
  Plus,
  X,
  Upload,
  Type,
  Maximize2,
  Layout,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Palette,
  Image as ImageIcon,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Section {
  id: string;
  type: string;
  data: any;
}

interface Props {
  section: Section;
  onChange: (data: any) => void;
  onDelete: () => void;
  onAIGenerate: (field: string) => void;
}

// --- UI Components ---

const Group = ({ title, children, defaultOpen = true, action }: { title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</span>
        </div>
        {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, children, aiAction }: { label?: string; children: React.ReactNode; aiAction?: () => void }) => (
  <div className="space-y-1.5">
    {label && (
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</label>
        {aiAction && (
          <button
            onClick={aiAction}
            className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium transition-colors bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100"
          >
            <Sparkles className="w-2.5 h-2.5" />
            AI Create
          </button>
        )}
      </div>
    )}
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 transition-all ${className}`}
    {...props}
  />
);

const TextArea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={`w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 transition-all resize-none ${className}`}
    {...props}
  />
);

const IconButton = ({ active, children, ...props }: any) => (
  <button
    className={`p-2 rounded-md transition-colors ${active ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
    {...props}
  >
    {children}
  </button>
);

const ListColors = {
  blue: "bg-blue-50 border-blue-100 hover:border-blue-200",
  gray: "bg-gray-50 border-gray-100 hover:border-gray-200"
}

const ListItem = ({ title, onDelete, onClick, children, active }: any) => (
  <div className={`group border rounded-md transition-all duration-200 ${active ? 'border-black/20 shadow-sm bg-white' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
    <div
      className="flex items-center justify-between p-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <GripVertical className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        <span className="text-xs font-medium text-gray-700 truncate select-none">{title || <span className="text-gray-300 italic">No Title</span>}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        {active ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </div>
    </div>
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="p-3 pt-0 border-t border-gray-50 space-y-3">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);


export default function PropertiesPanel({ section, onChange, onDelete, onAIGenerate }: Props) {
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');
  const [expandedItems, setExpandedItems] = useState<Record<string, number | null>>({});

  const updateData = (updates: any) => {
    onChange({ ...section.data, ...updates });
  };

  const updateStyle = (updates: any) => {
    onChange({
      ...section.data,
      style: { ...section.data.style, ...updates }
    });
  };

  const toggleItem = (listKey: string, index: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [listKey]: prev[listKey] === index ? null : index
    }));
  };

  // --- Content Renderers ---

  const renderHero = () => (
    <>
      <Group title="Text Content" defaultOpen={true}>
        <Field label="Headline" aiAction={() => onAIGenerate('headline')}>
          <TextArea
            value={section.data.headline || ''}
            onChange={e => updateData({ headline: e.target.value })}
            rows={3}
            placeholder="Enter a catchy headline..."
          />
        </Field>
        <Field label="Subheadline" aiAction={() => onAIGenerate('subheadline')}>
          <TextArea
            value={section.data.subheadline || ''}
            onChange={e => updateData({ subheadline: e.target.value })}
            rows={4}
            placeholder="Detailed description..."
          />
        </Field>
      </Group>

      <Group title="Call to Action">
        <Field label="Button Text">
          <Input
            value={section.data.ctaText || ''}
            onChange={e => updateData({ ctaText: e.target.value })}
            placeholder="e.g., Get Started"
          />
        </Field>
        <Field label="Button Link">
          <Input
            value={section.data.ctaLink || ''}
            onChange={e => updateData({ ctaLink: e.target.value })}
            placeholder="e.g., /contact"
          />
        </Field>
      </Group>
    </>
  );

  const renderFeatures = () => {
    const features = section.data.features || [];
    return (
      <>
        <Group title="Layout">
          <Field label="Columns">
            <div className="flex gap-2">
              {[3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => updateData({ columnCount: num })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border ${section.data.columnCount === num || (!section.data.columnCount && num === 3)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {num} Columns
                </button>
              ))}
            </div>
          </Field>
        </Group>

        <Group
          title={`Items (${features.length})`}
          action={
            <button
              onClick={() => {
                const newItems = [...features, { icon: '✨', title: '', description: '' }];
                updateData({ features: newItems });
                toggleItem('features', newItems.length - 1);
              }}
              className="p-1 hover:bg-black/5 rounded text-gray-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="space-y-2">
            {features.map((item: any, idx: number) => (
              <ListItem
                key={idx}
                title={item.title}
                active={expandedItems['features'] === idx}
                onClick={() => toggleItem('features', idx)}
                onDelete={() => {
                  const newItems = features.filter((_: any, i: number) => i !== idx);
                  updateData({ features: newItems });
                }}
              >
                <Field label="Icon / Emoji">
                  <Input
                    value={item.icon || ''}
                    onChange={e => {
                      const newItems = [...features];
                      newItems[idx].icon = e.target.value;
                      updateData({ features: newItems });
                    }}
                    className="text-lg w-12 text-center"
                  />
                </Field>
                <Field label="Title">
                  <Input
                    value={item.title || ''}
                    onChange={e => {
                      const newItems = [...features];
                      newItems[idx].title = e.target.value;
                      updateData({ features: newItems });
                    }}
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    value={item.description || ''}
                    onChange={e => {
                      const newItems = [...features];
                      newItems[idx].description = e.target.value;
                      updateData({ features: newItems });
                    }}
                    rows={3}
                  />
                </Field>
              </ListItem>
            ))}
          </div>
        </Group>
      </>
    );
  };

  const renderPricing = () => {
    const plans = section.data.plans || [];
    return (
      <Group
        title={`Plans (${plans.length})`}
        action={
          <button
            onClick={() => {
              const newItems = [...plans, { name: 'New Plan', price: '¥0', features: [] }];
              updateData({ plans: newItems });
              toggleItem('plans', newItems.length - 1);
            }}
            className="p-1 hover:bg-black/5 rounded text-gray-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="space-y-2">
          {plans.map((plan: any, idx: number) => (
            <ListItem
              key={idx}
              title={plan.name}
              active={expandedItems['plans'] === idx}
              onClick={() => toggleItem('plans', idx)}
              onDelete={() => {
                const newItems = plans.filter((_: any, i: number) => i !== idx);
                updateData({ plans: newItems });
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={plan.highlighted}
                    onChange={() => {
                      const newItems = [...plans];
                      newItems[idx].highlighted = !newItems[idx].highlighted;
                      updateData({ plans: newItems });
                    }}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  Highlight Plan
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan Name">
                  <Input
                    value={plan.name || ''}
                    onChange={e => {
                      const newItems = [...plans];
                      newItems[idx].name = e.target.value;
                      updateData({ plans: newItems });
                    }}
                  />
                </Field>
                <Field label="Price">
                  <Input
                    value={plan.price || ''}
                    onChange={e => {
                      const newItems = [...plans];
                      newItems[idx].price = e.target.value;
                      updateData({ plans: newItems });
                    }}
                  />
                </Field>
              </div>
              <Field label="Features (One per line)">
                <TextArea
                  value={Array.isArray(plan.features) ? plan.features.join('\n') : plan.features || ''}
                  onChange={e => {
                    const newItems = [...plans];
                    newItems[idx].features = e.target.value.split('\n');
                    updateData({ plans: newItems });
                  }}
                  rows={5}
                  className="font-mono text-xs"
                />
              </Field>
            </ListItem>
          ))}
        </div>
      </Group>
    );
  };

  const renderFAQ = () => {
    const faqs = section.data.faqs || [];
    return (
      <Group
        title={`Questions (${faqs.length})`}
        action={
          <button
            onClick={() => {
              const newItems = [...faqs, { question: '', answer: '' }];
              updateData({ faqs: newItems });
              toggleItem('faqs', newItems.length - 1);
            }}
            className="p-1 hover:bg-black/5 rounded text-gray-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="space-y-2">
          {faqs.map((faq: any, idx: number) => (
            <ListItem
              key={idx}
              title={faq.question}
              active={expandedItems['faqs'] === idx}
              onClick={() => toggleItem('faqs', idx)}
              onDelete={() => {
                const newItems = faqs.filter((_: any, i: number) => i !== idx);
                updateData({ faqs: newItems });
              }}
            >
              <Field label="Question">
                <Input
                  value={faq.question || ''}
                  onChange={e => {
                    const newItems = [...faqs];
                    newItems[idx].question = e.target.value;
                    updateData({ faqs: newItems });
                  }}
                />
              </Field>
              <Field label="Answer">
                <TextArea
                  value={faq.answer || ''}
                  onChange={e => {
                    const newItems = [...faqs];
                    newItems[idx].answer = e.target.value;
                    updateData({ faqs: newItems });
                  }}
                  rows={3}
                />
              </Field>
            </ListItem>
          ))}
        </div>
      </Group>
    );
  }

  const renderCTA = () => (
    <>
      <Group title="Content">
        <Field label="Headline" aiAction={() => onAIGenerate('headline')}>
          <Input
            value={section.data.headline || ''}
            onChange={e => updateData({ headline: e.target.value })}
          />
        </Field>
        <Field label="Description" aiAction={() => onAIGenerate('description')}>
          <TextArea
            value={section.data.description || ''}
            onChange={e => updateData({ description: e.target.value })}
            rows={3}
          />
        </Field>
      </Group>
      <Group title="Button">
        <Field label="Label">
          <Input
            value={section.data.buttonText || ''}
            onChange={e => updateData({ buttonText: e.target.value })}
          />
        </Field>
        <Field label="Link">
          <Input
            value={section.data.buttonLink || ''}
            onChange={e => updateData({ buttonLink: e.target.value })}
          />
        </Field>
      </Group>
    </>
  );

  const renderTestimonials = () => {
    const testimonials = section.data.testimonials || [];
    return (
      <Group
        title={`Testimonials (${testimonials.length})`}
        action={
          <button
            onClick={() => {
              const newItems = [...testimonials, { name: 'Customer', quote: '' }];
              updateData({ testimonials: newItems });
              toggleItem('testimonials', newItems.length - 1);
            }}
            className="p-1 hover:bg-black/5 rounded text-gray-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="space-y-2">
          {testimonials.map((t: any, idx: number) => (
            <ListItem
              key={idx}
              title={t.name}
              active={expandedItems['testimonials'] === idx}
              onClick={() => toggleItem('testimonials', idx)}
              onDelete={() => {
                const newItems = testimonials.filter((_: any, i: number) => i !== idx);
                updateData({ testimonials: newItems });
              }}
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-full overflow-hidden self-start mt-4 relative group cursor-pointer border border-gray-200">
                  {t.avatar ? (
                    <img src={t.avatar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const newItems = [...testimonials];
                          newItems[idx].avatar = e.target?.result as string;
                          updateData({ testimonials: newItems });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <Field label="Name">
                    <Input
                      value={t.name || ''}
                      onChange={e => {
                        const newItems = [...testimonials];
                        newItems[idx].name = e.target.value;
                        updateData({ testimonials: newItems });
                      }}
                    />
                  </Field>
                  <Field label="Role / Company">
                    <Input
                      value={t.company || ''}
                      onChange={e => {
                        const newItems = [...testimonials];
                        newItems[idx].company = e.target.value;
                        updateData({ testimonials: newItems });
                      }}
                    />
                  </Field>
                </div>
              </div>
              <Field label="Quote">
                <TextArea
                  value={t.quote || ''}
                  onChange={e => {
                    const newItems = [...testimonials];
                    newItems[idx].quote = e.target.value;
                    updateData({ testimonials: newItems });
                  }}
                  rows={3}
                />
              </Field>
            </ListItem>
          ))}
        </div>
      </Group>
    );
  };


  // --- Main Render ---

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 w-80 shadow-[-1px_0_20px_0_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-black rounded-full" />
          <h2 className="font-bold text-sm text-gray-900 tracking-tight">Properties</h2>
        </div>
        <div className="flex gap-1">
          <IconButton
            active={activeTab === 'content'}
            onClick={() => setActiveTab('content')}
            title="Edit Content"
          >
            <Type className="w-4 h-4" />
          </IconButton>
          <IconButton
            active={activeTab === 'style'}
            onClick={() => setActiveTab('style')}
            title="Edit Styles"
          >
            <Palette className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Section Type</div>
            <div className="text-sm font-semibold capitalize">{section.type}</div>
          </div>
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {activeTab === 'content' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {section.type === 'hero' && renderHero()}
            {section.type === 'features' && renderFeatures()}
            {section.type === 'pricing' && renderPricing()}
            {section.type === 'faq' && renderFAQ()}
            {section.type === 'cta' && renderCTA()}
            {section.type === 'testimonials' && renderTestimonials()}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <Group title="Background">
              <Field label="Color">
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded border border-gray-200 overflow-hidden relative">
                    <input
                      type="color"
                      value={section.data.style?.backgroundColor || '#ffffff'}
                      onChange={e => updateStyle({ backgroundColor: e.target.value })}
                      className="absolute inset-0 w-20 h-20 -top-2 -left-2 cursor-pointer"
                    />
                  </div>
                  <Input
                    value={section.data.style?.backgroundColor || '#ffffff'}
                    onChange={e => updateStyle({ backgroundColor: e.target.value })}
                    className="flex-1 font-mono"
                  />
                </div>
              </Field>

              <Field label="Image">
                {section.data.style?.backgroundImage ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={section.data.style.backgroundImage} className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => updateStyle({ backgroundImage: null })}
                        className="text-white hover:text-red-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors text-center relative">
                    <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <span className="text-xs text-gray-400 font-medium">Upload Image</span>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            updateStyle({ backgroundImage: e.target?.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                )}
              </Field>
            </Group>

            <Group title="Spacing">
              <Field label="Padding (Vertical)">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      value={section.data.style?.paddingY || 0}
                      onChange={e => updateStyle({ paddingY: parseInt(e.target.value) || 0 })}
                      className="pl-8"
                    />
                    <span className="absolute left-3 top-2 text-gray-400 text-xs font-mono">Y</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={section.data.style?.paddingX || 0}
                      onChange={e => updateStyle({ paddingX: parseInt(e.target.value) || 0 })}
                      className="pl-8"
                    />
                    <span className="absolute left-3 top-2 text-gray-400 text-xs font-mono">X</span>
                  </div>
                </div>
              </Field>
              <Field label="Margin (Vertical)">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      value={section.data.style?.marginY || 0}
                      onChange={e => updateStyle({ marginY: parseInt(e.target.value) || 0 })}
                      className="pl-8"
                    />
                    <span className="absolute left-3 top-2 text-gray-400 text-xs font-mono">Y</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={section.data.style?.marginX || 0}
                      onChange={e => updateStyle({ marginX: parseInt(e.target.value) || 0 })}
                      className="pl-8"
                    />
                    <span className="absolute left-3 top-2 text-gray-400 text-xs font-mono">X</span>
                  </div>
                </div>
              </Field>
            </Group>
          </div>
        )}
      </div>
    </div>
  );
}
