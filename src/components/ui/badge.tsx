import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type BadgeVariant = 'default' | 'success' | 'warning' | 'muted'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

export default function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge--${variant}`, className)} {...props} />
  )
}

