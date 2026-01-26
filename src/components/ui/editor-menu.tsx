"use client"

import * as React from "react"
import { ChevronDown, Search, HelpCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

// ============================================================================
// コンテキスト（キーボードナビゲーション用）
// ============================================================================
interface EditorMenuContextValue {
  focusedIndex: number
  setFocusedIndex: (index: number) => void
  registerItem: (id: string) => number
  unregisterItem: (id: string) => void
  itemCount: number
}

const EditorMenuContext = React.createContext<EditorMenuContextValue | null>(null)

export function EditorMenuProvider({ children }: { children: React.ReactNode }) {
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const itemsRef = React.useRef<string[]>([])

  const registerItem = React.useCallback((id: string) => {
    if (!itemsRef.current.includes(id)) {
      itemsRef.current.push(id)
    }
    return itemsRef.current.indexOf(id)
  }, [])

  const unregisterItem = React.useCallback((id: string) => {
    itemsRef.current = itemsRef.current.filter(item => item !== id)
  }, [])

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    const itemCount = itemsRef.current.length
    if (itemCount === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => (prev + 1) % itemCount)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => (prev - 1 + itemCount) % itemCount)
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(itemCount - 1)
        break
    }
  }, [])

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <EditorMenuContext.Provider value={{
      focusedIndex,
      setFocusedIndex,
      registerItem,
      unregisterItem,
      itemCount: itemsRef.current.length
    }}>
      <TooltipPrimitive.Provider delayDuration={300}>
        {children}
      </TooltipPrimitive.Provider>
    </EditorMenuContext.Provider>
  )
}

// ============================================================================
// ツールチップ
// ============================================================================
interface EditorTooltipProps {
  content: string
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
}

export function EditorTooltip({ content, children, side = "top" }: EditorTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={4}
            className="z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-gray-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

// ============================================================================
// アイコンボックス
// ============================================================================
interface EditorIconBoxProps {
  children: React.ReactNode
  variant?: "default" | "dark" | "primary" | "success" | "warning" | "danger"
  size?: "sm" | "md" | "lg"
  className?: string
}

const iconBoxVariants = {
  default: "bg-gray-100 text-gray-500",
  dark: "bg-gray-900 text-white",
  primary: "bg-indigo-100 text-indigo-600",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
}

const iconBoxSizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
}

export function EditorIconBox({
  children,
  variant = "default",
  size = "md",
  className
}: EditorIconBoxProps) {
  return (
    <div className={cn(
      "rounded flex items-center justify-center flex-shrink-0 transition-colors",
      iconBoxVariants[variant],
      iconBoxSizes[size],
      className
    )}>
      {children}
    </div>
  )
}

// ============================================================================
// バッジ
// ============================================================================
interface EditorBadgeProps {
  children: React.ReactNode
  variant?: "default" | "dark" | "primary" | "success" | "warning" | "new" | "pro"
  className?: string
}

const badgeVariants = {
  default: "bg-gray-100 text-gray-600",
  dark: "bg-gray-900 text-white",
  primary: "bg-indigo-100 text-indigo-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  new: "bg-gradient-to-r from-pink-500 to-violet-500 text-white",
  pro: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
}

export function EditorBadge({ children, variant = "default", className }: EditorBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-sm font-medium",
      badgeVariants[variant],
      className
    )}>
      {children}
    </span>
  )
}

// ============================================================================
// 検索ボックス
// ============================================================================
interface EditorMenuSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function EditorMenuSearch({
  value,
  onChange,
  placeholder = "メニューを検索...",
  className
}: EditorMenuSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <span className="text-xs">×</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// メニューセクション（カテゴリヘッダー）
// ============================================================================
interface EditorMenuSectionProps {
  title: string
  color?: "indigo" | "emerald" | "amber" | "rose" | "purple"
  children: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

const colorMap = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  purple: "bg-purple-500",
}

export function EditorMenuSection({
  title,
  color = "indigo",
  children,
  className,
  collapsible = false,
  defaultOpen = true
}: EditorMenuSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <motion.div
      className={cn("space-y-3", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 pb-1 border-b border-gray-100 mt-8",
          collapsible && "cursor-pointer hover:border-gray-200 transition-colors"
        )}
        disabled={!collapsible}
      >
        <motion.span
          className={cn("w-1 h-4 rounded-full", colorMap[color])}
          whileHover={{ scale: 1.2 }}
        />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex-1 text-left">
          {title}
        </p>
        {collapsible && (
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </motion.div>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// メニューアイテム（折りたたみ可能）
// ============================================================================
interface EditorMenuItemProps {
  icon: React.ReactNode
  title: React.ReactNode
  description: string
  tooltip?: string
  children?: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  action?: React.ReactNode
  badge?: React.ReactNode
  iconVariant?: "default" | "dark" | "primary" | "success" | "warning" | "danger"
  className?: string
  id?: string
}

export function EditorMenuItem({
  icon,
  title,
  description,
  tooltip,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  action,
  badge,
  iconVariant = "default",
  className,
  id
}: EditorMenuItemProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen
  const itemRef = React.useRef<HTMLDivElement>(null)
  const context = React.useContext(EditorMenuContext)
  const generatedId = React.useId()
  const itemId = id || generatedId

  // キーボードナビゲーション用の登録
  React.useEffect(() => {
    if (context) {
      context.registerItem(itemId)
      return () => context.unregisterItem(itemId)
    }
  }, [context, itemId])

  // フォーカス管理
  React.useEffect(() => {
    if (context && itemRef.current) {
      const itemIndex = context.registerItem(itemId)
      if (context.focusedIndex === itemIndex) {
        itemRef.current.focus()
      }
    }
  }, [context, itemId])

  const content = (
    <motion.div
      ref={itemRef}
      tabIndex={0}
      className={cn(
        "border border-gray-200 rounded-lg overflow-hidden bg-white",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1",
        "transition-shadow hover:shadow-sm",
        className
      )}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
    >
      {action && !children ? (
        // 折りたたみなしのシンプルなアイテム
        <div className="p-3">
          <div className="flex items-center gap-3 mb-2">
            <EditorIconBox variant={iconVariant}>
              {icon}
            </EditorIconBox>
            <div className="text-left flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-gray-900">{title}</h4>
                {badge}
                {tooltip && (
                  <EditorTooltip content={tooltip}>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <HelpCircle className="h-3 w-3" />
                    </button>
                  </EditorTooltip>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
          </div>
          {action}
        </div>
      ) : (
        // 折りたたみ可能なアイテム
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <EditorIconBox variant={iconVariant}>
                {icon}
              </EditorIconBox>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-900">{title}</h4>
                  {badge}
                  {tooltip && (
                    <EditorTooltip content={tooltip}>
                      <span className="text-gray-400 hover:text-gray-600 transition-colors">
                        <HelpCircle className="h-3 w-3" />
                      </span>
                    </EditorTooltip>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 border-t border-gray-100">
                  <div className="pt-2">
                    {children}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )

  return content
}

// ============================================================================
// セクション選択リスト（ブロックを選ぶ）
// ============================================================================
interface Section {
  id: string | number
  image?: { filePath?: string }
  mobileImage?: { filePath?: string }
  role?: string
  config?: {
    overlays?: unknown[]
  }
}

interface EditorSectionListProps {
  sections: Section[]
  onSelect: (section: Section, index: number) => void
  emptyMessage?: string
  showOverlayCount?: boolean
  className?: string
}

export function EditorSectionList({
  sections,
  onSelect,
  emptyMessage = "画像がありません",
  showOverlayCount = false,
  className
}: EditorSectionListProps) {
  const filteredSections = sections.filter(s => s.image?.filePath)

  if (filteredSections.length === 0) {
    return (
      <motion.p
        className="text-xs text-gray-400 text-center py-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {emptyMessage}
      </motion.p>
    )
  }

  return (
    <div className={cn("space-y-1 max-h-48 overflow-y-auto", className)}>
      {filteredSections.map((section, idx) => (
        <motion.button
          key={section.id}
          onClick={() => onSelect(section, idx)}
          className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition-all text-left group"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-6 h-6 rounded bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200 group-hover:border-indigo-300 transition-colors">
            <img
              src={section.image?.filePath}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-600 truncate block group-hover:text-gray-900 transition-colors">
              {section.role || `セクション ${idx + 1}`}
            </span>
            {showOverlayCount && (
              <span className="text-[9px] text-gray-400 block -mt-0.5">
                {section.config?.overlays?.length || 0}件の重ね要素
              </span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 text-gray-300 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.button>
      ))}
    </div>
  )
}

// ============================================================================
// アクションボタン
// ============================================================================
interface EditorActionButtonProps {
  onClick: () => void
  disabled?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: "default" | "primary" | "danger" | "success"
  size?: "sm" | "md"
  loading?: boolean
  className?: string
}

const buttonVariants = {
  default: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300",
  primary: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300",
  danger: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
}

const buttonSizes = {
  sm: "py-1.5 text-[10px]",
  md: "py-2 text-xs",
}

export function EditorActionButton({
  onClick,
  disabled = false,
  icon,
  children,
  variant = "default",
  size = "md",
  loading = false,
  className
}: EditorActionButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "w-full font-medium rounded transition-all flex items-center justify-center gap-2 border",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
    >
      {loading ? (
        <motion.div
          className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      ) : icon}
      {children}
    </motion.button>
  )
}

// ============================================================================
// 情報表示
// ============================================================================
interface EditorInfoBoxProps {
  children: React.ReactNode
  variant?: "default" | "info" | "warning" | "success"
  className?: string
}

const infoBoxVariants = {
  default: "text-gray-500 bg-gray-50",
  info: "text-indigo-600 bg-indigo-50",
  warning: "text-amber-600 bg-amber-50",
  success: "text-emerald-600 bg-emerald-50",
}

export function EditorInfoBox({ children, variant = "default", className }: EditorInfoBoxProps) {
  return (
    <motion.div
      className={cn(
        "text-[10px] rounded p-1.5 text-center",
        infoBoxVariants[variant],
        className
      )}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// ディバイダー
// ============================================================================
interface EditorDividerProps {
  label?: string
  className?: string
}

export function EditorDivider({ label, className }: EditorDividerProps) {
  return (
    <div className={cn("flex items-center gap-2 my-3", className)}>
      <div className="flex-1 h-px bg-gray-200" />
      {label && <span className="text-[10px] text-gray-400 uppercase">{label}</span>}
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// ============================================================================
// 空状態
// ============================================================================
interface EditorEmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EditorEmptyState({
  icon,
  title,
  description,
  action,
  className
}: EditorEmptyStateProps) {
  return (
    <motion.div
      className={cn("text-center py-6", className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {icon && (
        <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  )
}
