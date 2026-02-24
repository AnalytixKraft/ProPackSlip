import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type TabsProps = HTMLAttributes<HTMLDivElement>
type TabProps = HTMLAttributes<HTMLButtonElement> & {
  active?: boolean
}

export function Tabs({ className, ...props }: TabsProps) {
  return <div className={cn('ui-tabs', className)} {...props} />
}

export function Tab({ className, active, ...props }: TabProps) {
  return (
    <button
      className={cn('ui-tab', active && 'ui-tab--active', className)}
      type="button"
      {...props}
    />
  )
}

