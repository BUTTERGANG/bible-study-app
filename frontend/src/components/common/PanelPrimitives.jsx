import { RefreshCw } from 'lucide-react'

export function PanelHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="panel-header min-h-12">
      <div className="min-w-0 flex items-center gap-2">
        {Icon && <Icon size={15} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-800 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="truncate text-[11px] font-normal text-gray-400 dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function PanelState({ icon: Icon, title, description, action, tone = 'muted' }) {
  const tones = {
    muted: 'text-gray-400 dark:text-slate-500',
    error: 'text-red-500 dark:text-red-400',
  }
  return (
    <div className={`flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center ${tones[tone] || tones.muted}`}>
      {Icon && <Icon size={22} strokeWidth={1.5} className="mb-3 opacity-70" />}
      {title && <p className="text-sm font-medium text-gray-600 dark:text-slate-300">{title}</p>}
      {description && <p className="mt-1 max-w-xs text-xs leading-relaxed">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          {action.loading ? <RefreshCw size={13} className="animate-spin" /> : action.label}
        </button>
      )}
    </div>
  )
}

export function PanelSection({ title, children, className = '' }) {
  return (
    <section className={`border-b border-gray-100 dark:border-white/10 ${className}`}>
      {title && <h3 className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">{title}</h3>}
      {children}
    </section>
  )
}

export function Button({ children, variant = 'secondary', className = '', ...props }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    secondary: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    ghost: 'border-transparent text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800',
  }
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${variants[variant] || variants.secondary} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default PanelHeader
