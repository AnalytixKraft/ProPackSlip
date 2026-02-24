import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type TooltipProps = HTMLAttributes<HTMLSpanElement> & {
  content: string
}

export default function Tooltip({
  className,
  content,
  children,
  ...props
}: TooltipProps) {
  return (
    <span className={cn('ui-tooltip', className)} title={content} {...props}>
      {children}
    </span>
  )
}

