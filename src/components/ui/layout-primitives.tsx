import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

type AppShellProps = {
  sidebar: ReactNode
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

type PageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

type BaseProps<T> = T & { className?: string }

export function AppShell({ sidebar, header, children, footer }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="app-sidebar no-print">{sidebar}</aside>
        <div className="app-main">
          {header ? <header className="top-bar no-print">{header}</header> : null}
          <main>{children}</main>
          {footer}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header', className)}>
      <div>
        <h1 className="section-title">{title}</h1>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  )
}

export function SectionCard({ className, ...props }: BaseProps<HTMLAttributes<HTMLElement>>) {
  return <section className={cn('page-card', className)} {...props} />
}

export function FormRow({ className, ...props }: BaseProps<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('form-grid', className)} {...props} />
}

export function FieldGroup({ className, ...props }: BaseProps<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('field-group', className)} {...props} />
}

