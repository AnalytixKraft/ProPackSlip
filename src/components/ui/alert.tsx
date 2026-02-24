import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type AlertVariant = 'info' | 'danger' | 'success'

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant
}

export default function Alert({
  className,
  variant = 'info',
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('ui-alert', `ui-alert--${variant}`, className)}
      {...props}
    />
  )
}

